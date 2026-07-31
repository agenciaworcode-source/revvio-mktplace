-- ============================================================
-- 0050 — Permissões de acesso do vendedor + módulos por plano
-- ============================================================
-- Até aqui o acesso era binário: is_loja_manager() (garagista/admin)
-- via tudo, vendedor via um conjunto fixo cravado no código e na RLS.
--
-- Agora:
--   1. O garagista define, na linha da PRÓPRIA loja, o que os vendedores
--      dela podem ver/fazer (colunas `vend_*`). O padrão reproduz
--      exatamente o comportamento de hoje — nada muda ao aplicar.
--   2. O plano de assinatura libera módulos para a loja inteira
--      (colunas em rv_pricing_plans), na mesma linha do affiliates_enabled.
--   3. As policies passam a consultar essas permissões.
-- ============================================================

-- ── 1 · Permissões do vendedor (definidas na linha da loja) ──
-- Ficam na loja, não no vendedor: a regra vale para a equipe toda.
alter table public.rv_sellers
  add column if not exists vend_ver_leads        boolean not null default false,
  add column if not exists vend_ver_financeiro   boolean not null default false,
  add column if not exists vend_ver_todas_vendas boolean not null default false,
  add column if not exists vend_add_veiculo      boolean not null default true,
  add column if not exists vend_editar_veiculo   boolean not null default false,
  add column if not exists vend_excluir_veiculo  boolean not null default false,
  add column if not exists vend_gerador_whatsapp boolean not null default false;

comment on column public.rv_sellers.vend_ver_leads is
  'Vendedores da loja podem abrir a aba Leads. Default false = comportamento anterior.';
comment on column public.rv_sellers.vend_add_veiculo is
  'Vendedores podem cadastrar veículo. Default true = comportamento anterior.';

-- ── 2 · Módulos liberados por plano ─────────────────────────
-- Default true: os planos que já existem continuam com tudo liberado.
alter table public.rv_pricing_plans
  add column if not exists leads_enabled     boolean not null default true,
  add column if not exists financeiro_enabled boolean not null default true,
  add column if not exists whatsapp_enabled  boolean not null default true,
  add column if not exists equipe_enabled    boolean not null default true;

-- ── 3 · Helper: o vendedor logado tem a permissão X? ────────
-- Devolve false para quem não é vendedor (garagista/admin passam pelo
-- is_loja_manager() nas policies). SECURITY DEFINER porque precisa ler a
-- linha da loja ignorando RLS.
create or replace function public.vendedor_pode(p_perm text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select case p_perm
      when 'ver_leads'        then loja.vend_ver_leads
      when 'ver_financeiro'   then loja.vend_ver_financeiro
      when 'ver_todas_vendas' then loja.vend_ver_todas_vendas
      when 'add_veiculo'      then loja.vend_add_veiculo
      when 'editar_veiculo'   then loja.vend_editar_veiculo
      when 'excluir_veiculo'  then loja.vend_excluir_veiculo
      when 'gerador_whatsapp' then loja.vend_gerador_whatsapp
      else false
    end
    from public.rv_sellers p
    join public.rv_sellers loja on loja.id = p.parent_id
    where p.user_id = auth.uid() and p.role = 'vendedor'
  ), false);
$$;

revoke all on function public.vendedor_pode(text) from public;
grant execute on function public.vendedor_pode(text) to authenticated;

-- ── 4 · RPC: acesso efetivo do usuário logado ───────────────
-- Uma chamada devolve papel + permissões + módulos do plano, para o painel
-- montar menu e rotas sem depender de ler a linha da loja pela RLS.
create or replace function public.meu_acesso()
returns jsonb language sql stable security definer set search_path = public as $$
  with eu as (
    select p.id, p.role, coalesce(p.parent_id, p.id) as loja_id
    from public.rv_sellers p
    where p.user_id = auth.uid()
  ),
  loja as (
    select s.* from public.rv_sellers s join eu on s.id = eu.loja_id
  ),
  plano as (
    select pl.* from public.rv_pricing_plans pl
    join loja on pl.key = loja.pricing_plan_key
  )
  select jsonb_build_object(
    'role', (select role from eu),
    'is_manager', (select role in ('garagista','admin') from eu),
    'perms', jsonb_build_object(
      'ver_leads',        (select vend_ver_leads        from loja),
      'ver_financeiro',   (select vend_ver_financeiro   from loja),
      'ver_todas_vendas', (select vend_ver_todas_vendas from loja),
      'add_veiculo',      (select vend_add_veiculo      from loja),
      'editar_veiculo',   (select vend_editar_veiculo   from loja),
      'excluir_veiculo',  (select vend_excluir_veiculo  from loja),
      'gerador_whatsapp', (select vend_gerador_whatsapp from loja)
    ),
    -- Sem plano associado, a loja mantém tudo liberado (é como funciona hoje).
    'modulos', jsonb_build_object(
      'leads',      coalesce((select leads_enabled      from plano), true),
      'financeiro', coalesce((select financeiro_enabled from plano), true),
      'whatsapp',   coalesce((select whatsapp_enabled   from plano), true),
      'equipe',     coalesce((select equipe_enabled     from plano), true),
      'afiliados',  coalesce((select affiliates_enabled from plano), false)
    )
  )
  where exists (select 1 from eu);
$$;

revoke all on function public.meu_acesso() from public;
grant execute on function public.meu_acesso() to authenticated;

-- ── 5 · Policies passam a respeitar as permissões ───────────

-- rv_leads: antes qualquer membro da loja lia (o menu só escondia no front).
drop policy if exists "rv_leads_read_scope"   on public.rv_leads;
drop policy if exists "rv_leads_update_scope" on public.rv_leads;
drop policy if exists "rv_leads_delete_scope" on public.rv_leads;

create policy "rv_leads_read_scope" on public.rv_leads
  for select using (
    public.is_admin()
    or (seller_id = public.current_loja()
        and (public.is_loja_manager() or public.vendedor_pode('ver_leads')))
  );
create policy "rv_leads_update_scope" on public.rv_leads
  for update using (
    public.is_admin()
    or (seller_id = public.current_loja()
        and (public.is_loja_manager() or public.vendedor_pode('ver_leads')))
  ) with check (
    public.is_admin()
    or (seller_id = public.current_loja()
        and (public.is_loja_manager() or public.vendedor_pode('ver_leads')))
  );
create policy "rv_leads_delete_scope" on public.rv_leads
  for delete using (
    public.is_admin()
    or (seller_id = public.current_loja() and public.is_loja_manager())
  );

-- rv_vehicles: insert deixa de ser liberado a qualquer membro da loja;
-- update/delete ganham a permissão opcional do vendedor.
drop policy if exists "rv_vehicles_insert_loja"     on public.rv_vehicles;
drop policy if exists "rv_vehicles_update_manager"  on public.rv_vehicles;
drop policy if exists "rv_vehicles_delete_manager"  on public.rv_vehicles;

create policy "rv_vehicles_insert_scope" on public.rv_vehicles
  for insert with check (
    seller_id = public.current_loja()
    and (public.is_loja_manager() or public.vendedor_pode('add_veiculo'))
  );
create policy "rv_vehicles_update_scope" on public.rv_vehicles
  for update using (
    public.is_admin()
    or (seller_id = public.current_loja()
        and (public.is_loja_manager() or public.vendedor_pode('editar_veiculo')))
  ) with check (
    public.is_admin()
    or (seller_id = public.current_loja()
        and (public.is_loja_manager() or public.vendedor_pode('editar_veiculo')))
  );
create policy "rv_vehicles_delete_scope" on public.rv_vehicles
  for delete using (
    public.is_admin()
    or (seller_id = public.current_loja()
        and (public.is_loja_manager() or public.vendedor_pode('excluir_veiculo')))
  );

-- rv_sales: vendedor vê as próprias; com permissão, vê as da loja toda.
drop policy if exists "rv_sales_read_scope" on public.rv_sales;
create policy "rv_sales_read_scope" on public.rv_sales
  for select using (
    public.is_admin()
    or (seller_id = public.current_loja()
        and (public.is_loja_manager() or public.vendedor_pode('ver_todas_vendas')))
    or vendedor_id = public.current_person()
  );

-- rv_commissions: idem — a própria comissão sempre; a da loja só com permissão.
drop policy if exists "rv_commissions_read_scope" on public.rv_commissions;
create policy "rv_commissions_read_scope" on public.rv_commissions
  for select using (
    public.is_admin()
    or (seller_id = public.current_loja()
        and (public.is_loja_manager() or public.vendedor_pode('ver_financeiro')))
    or vendedor_id = public.current_person()
  );

-- ── 6 · Trava de escalonamento ──────────────────────────────
-- Um vendedor não pode alterar as permissões (elas moram na linha da loja,
-- que ele não pode atualizar), mas também não pode mexer nas colunas vend_*
-- da própria linha para o caso de um dia virar loja.
create or replace function public.protect_seller_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then
    return new;
  end if;

  -- Só o gestor da loja mexe nas permissões da equipe, e só na própria loja.
  if (new.vend_ver_leads        is distinct from old.vend_ver_leads
   or new.vend_ver_financeiro   is distinct from old.vend_ver_financeiro
   or new.vend_ver_todas_vendas is distinct from old.vend_ver_todas_vendas
   or new.vend_add_veiculo      is distinct from old.vend_add_veiculo
   or new.vend_editar_veiculo   is distinct from old.vend_editar_veiculo
   or new.vend_excluir_veiculo  is distinct from old.vend_excluir_veiculo
   or new.vend_gerador_whatsapp is distinct from old.vend_gerador_whatsapp)
     and not (public.is_loja_manager() and old.id = public.current_loja()) then
    raise exception 'Sem permissão para alterar as permissões da equipe.';
  end if;

  -- garagista pode ajustar comissão/status dos vendedores da própria loja
  if public.is_loja_manager()
     and old.parent_id = public.current_loja()
     and new.role = old.role
     and new.parent_id is not distinct from old.parent_id then
    return new;
  end if;
  if new.commission_rate is distinct from old.commission_rate
     or new.status is distinct from old.status
     or new.role  is distinct from old.role
     or new.parent_id is distinct from old.parent_id then
    raise exception 'Sem permissão para alterar comissão, status, papel ou vínculo.';
  end if;
  return new;
end;
$$;
