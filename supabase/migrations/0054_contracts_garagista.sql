-- ============================================================
-- 0054_contracts_garagista.sql — contratos para o garagista
-- ============================================================
-- O módulo de contratos era exclusivo do superadmin. O garagista passa a
-- emitir os dele, com duas diferenças: só o contrato de compra e venda (a
-- intermediação e a procuração são atos da Revvio, não da loja) e a folha
-- sai com a identidade visual da própria loja.
--
-- `seller_id` é quem separa: nulo = contrato emitido pelo superadmin (todos
-- os que já existem), preenchido = contrato daquela loja. O RLS passa a
-- deixar cada garagista enxergar apenas os seus; o admin continua vendo tudo.

alter table public.rv_contracts
  add column if not exists seller_id uuid references public.rv_sellers (id) on delete cascade;

comment on column public.rv_contracts.seller_id is
  'Loja que emitiu o contrato. Nulo = emitido pelo superadmin (Revvio). Define o que cada garagista enxerga no RLS.';

create index if not exists idx_rv_contracts_seller on public.rv_contracts (seller_id);

-- Molde de compra e venda da loja: carga inicial do editor de cláusulas, do
-- mesmo jeito que o superadmin tem os modelos padrão. Vazio = usa o modelo
-- padrão do sistema.
alter table public.rv_sellers
  add column if not exists contract_template text;

comment on column public.rv_sellers.contract_template is
  'Molde de contrato de compra e venda da loja, com as tags [campo]. Vazio/nulo = o editor abre com o modelo padrão do sistema.';

-- ── RLS ─────────────────────────────────────────────────────
-- A policy antiga era admin-only; agora convivem os dois donos.
drop policy if exists "rv_contracts_admin_all" on public.rv_contracts;

create policy "rv_contracts_admin_all" on public.rv_contracts
  for all using (public.is_admin()) with check (public.is_admin());

-- O garagista só alcança linha com o seller_id da loja dele — inclusive no
-- insert, então não consegue gravar contrato no nome de outra loja. Contrato
-- é documento da loja: fica com o gestor, não com o vendedor da equipe.
drop policy if exists "rv_contracts_seller_all" on public.rv_contracts;
create policy "rv_contracts_seller_all" on public.rv_contracts
  for all
  using (
    public.is_loja_manager()
    and seller_id is not null
    and seller_id = public.current_loja()
  )
  with check (
    public.is_loja_manager()
    and seller_id is not null
    and seller_id = public.current_loja()
  );

-- ── Storage das fotos de contrato assinado ──────────────────
-- O bucket é privado e já era acessível ao admin. O garagista ganha acesso
-- apenas à pasta da própria loja (primeiro segmento do path = seller_id),
-- mesmo desenho usado em avatars/banners/vehicle-images.
drop policy if exists "contract_photos_seller_read" on storage.objects;
create policy "contract_photos_seller_read" on storage.objects
  for select to authenticated using (
    bucket_id = 'contract-photos'
    and (storage.foldername(name))[1] = public.current_loja()::text
  );

drop policy if exists "contract_photos_seller_insert" on storage.objects;
create policy "contract_photos_seller_insert" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'contract-photos'
    and (storage.foldername(name))[1] = public.current_loja()::text
  );

drop policy if exists "contract_photos_seller_update" on storage.objects;
create policy "contract_photos_seller_update" on storage.objects
  for update to authenticated using (
    bucket_id = 'contract-photos'
    and (storage.foldername(name))[1] = public.current_loja()::text
  );

drop policy if exists "contract_photos_seller_delete" on storage.objects;
create policy "contract_photos_seller_delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'contract-photos'
    and (storage.foldername(name))[1] = public.current_loja()::text
  );

notify pgrst, 'reload schema';
