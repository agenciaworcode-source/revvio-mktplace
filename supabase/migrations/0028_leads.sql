-- ============================================================
-- 0028_leads.sql — Leads + funil + tracking de cliques
-- ============================================================
create type lead_stage as enum ('novo','em_contato','negociando','ganho','perdido');

create table public.rv_leads (
  id          uuid primary key default gen_random_uuid(),
  seller_id   uuid not null references public.rv_sellers(id) on delete cascade,
  vehicle_id  bigint references public.rv_vehicles(id) on delete set null,
  name        text not null,
  phone       text,
  email       text,
  city        text,
  message     text,
  financing   boolean not null default false,
  stage       lead_stage not null default 'novo',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index idx_rv_leads_seller_id  on public.rv_leads(seller_id);
create index idx_rv_leads_stage      on public.rv_leads(stage);
create index idx_rv_leads_created_at on public.rv_leads(created_at desc);

create trigger trg_rv_leads_updated_at
  before update on public.rv_leads
  for each row execute function public.set_updated_at();

-- contador de cliques no anúncio
alter table public.rv_vehicles add column if not exists clicks int not null default 0;

create or replace function public.increment_vehicle_clicks(p_id bigint)
returns void language sql security definer set search_path = public as $$
  update public.rv_vehicles set clicks = clicks + 1 where id = p_id;
$$;
revoke all on function public.increment_vehicle_clicks(bigint) from public;
grant execute on function public.increment_vehicle_clicks(bigint) to anon, authenticated;

-- ── RLS ──
alter table public.rv_leads enable row level security;

-- captura pública: qualquer um insere
create policy "rv_leads_insert_public" on public.rv_leads
  for insert with check (true);

-- leitura/edição: dono da loja ou admin
create policy "rv_leads_read_scope" on public.rv_leads
  for select using (public.is_admin() or seller_id = public.current_loja());
create policy "rv_leads_update_scope" on public.rv_leads
  for update using (public.is_admin() or seller_id = public.current_loja())
  with check (public.is_admin() or seller_id = public.current_loja());
create policy "rv_leads_delete_scope" on public.rv_leads
  for delete using (public.is_admin() or seller_id = public.current_loja());
