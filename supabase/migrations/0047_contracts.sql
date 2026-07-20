-- ============================================================
-- REVVIO · Módulo de Contratos e Relatórios Financeiros (Admin)
-- Emissão digital de contratos (intermediação, compra/venda,
-- procuração) com dados financeiros para relatório contábil.
-- Acesso exclusivo do superadmin (leitura e escrita).
-- ============================================================

-- tipo de documento emitido
do $$ begin
  create type public.contract_type as enum ('intermediacao', 'compra_venda', 'procuracao');
exception when duplicate_object then null;
end $$;

create table if not exists public.rv_contracts (
  id                uuid primary key default gen_random_uuid(),
  contract_type     public.contract_type not null,

  -- proprietário / vendedor (outorgante na procuração)
  vendedor_name     text not null,
  vendedor_cpf_cnpj text not null,
  vendedor_address  text not null default '',

  -- comprador (nulo na intermediação; outorgado na procuração)
  comprador_name     text,
  comprador_cpf_cnpj text,
  comprador_address  text,

  -- veículo
  vehicle_brand_model text not null default '',
  vehicle_year_model  text not null default '',
  vehicle_plate       text not null default '',
  vehicle_renavam     text not null default '',
  vehicle_chassi      text,

  -- dados financeiros essenciais p/ relatório contábil
  sale_value       numeric(12,2) not null default 0 check (sale_value >= 0),
  commission_value numeric(12,2) not null default 0 check (commission_value >= 0),

  -- texto de trabalho do editor (cláusulas com as tags [campo] intactas),
  -- permite reabrir e continuar editando com interpolação em tempo real
  template_content  text not null default '',

  -- texto final do documento, já com cláusulas editadas e tags substituídas
  full_text_content text not null default '',

  -- foto do contrato assinado (captura por câmera; path no bucket contract-photos)
  signed_photo_path text,

  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- filtros da listagem: data de emissão, tipo e nome/CPF das partes
create index if not exists idx_rv_contracts_created_at on public.rv_contracts (created_at desc);
create index if not exists idx_rv_contracts_type       on public.rv_contracts (contract_type);
create index if not exists idx_rv_contracts_vend_cpf   on public.rv_contracts (vendedor_cpf_cnpj);

create trigger trg_rv_contracts_updated_at
  before update on public.rv_contracts
  for each row execute function public.set_updated_at();

-- ── RLS: tudo (select/insert/update/delete) só admin ────────
alter table public.rv_contracts enable row level security;

drop policy if exists "rv_contracts_admin_all" on public.rv_contracts;
create policy "rv_contracts_admin_all" on public.rv_contracts
  for all using (public.is_admin()) with check (public.is_admin());

-- ── Storage: bucket PRIVADO p/ fotos de contratos assinados ──
insert into storage.buckets (id, name, public)
values ('contract-photos', 'contract-photos', false)
on conflict (id) do nothing;

drop policy if exists "contract_photos_admin_read" on storage.objects;
create policy "contract_photos_admin_read" on storage.objects
  for select to authenticated using (
    bucket_id = 'contract-photos' and public.is_admin()
  );

drop policy if exists "contract_photos_admin_insert" on storage.objects;
create policy "contract_photos_admin_insert" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'contract-photos' and public.is_admin()
  );

drop policy if exists "contract_photos_admin_update" on storage.objects;
create policy "contract_photos_admin_update" on storage.objects
  for update to authenticated using (
    bucket_id = 'contract-photos' and public.is_admin()
  );

drop policy if exists "contract_photos_admin_delete" on storage.objects;
create policy "contract_photos_admin_delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'contract-photos' and public.is_admin()
  );
