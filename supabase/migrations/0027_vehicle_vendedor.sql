-- ============================================================
-- Todo veículo é atribuído a um vendedor (ou ao próprio garagista).
-- on delete set null: se o vendedor sair, o veículo não é apagado.
-- ============================================================
alter table public.rv_vehicles
  add column if not exists vendedor_id uuid references public.rv_sellers(id) on delete set null;

create index if not exists idx_rv_vehicles_vendedor_id on public.rv_vehicles(vendedor_id);
