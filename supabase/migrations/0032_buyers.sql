-- ============================================================
-- 0032_buyers.sql — Contas de comprador (end-customer)
-- ============================================================
create table public.rv_buyers (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text not null,
  phone      text,
  city       text,
  email      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_rv_buyers_updated_at
  before update on public.rv_buyers
  for each row execute function public.set_updated_at();

alter table public.rv_buyers enable row level security;

-- comprador gerencia o próprio registro
create policy "rv_buyers_self_select" on public.rv_buyers
  for select using (id = auth.uid());
create policy "rv_buyers_self_insert" on public.rv_buyers
  for insert with check (id = auth.uid());
create policy "rv_buyers_self_update" on public.rv_buyers
  for update using (id = auth.uid()) with check (id = auth.uid());

-- admin e garagista podem ler (para os painéis da Fase 2)
create policy "rv_buyers_staff_read" on public.rv_buyers
  for select using (public.is_admin() or public.is_loja_manager());

-- lead atrelado à conta do comprador
alter table public.rv_leads
  add column if not exists buyer_id uuid references public.rv_buyers(id) on delete set null;
create index if not exists idx_rv_leads_buyer_id on public.rv_leads(buyer_id);
