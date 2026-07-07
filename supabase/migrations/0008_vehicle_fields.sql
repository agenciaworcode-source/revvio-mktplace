-- ============================================================
-- REVVIO 2.0 · Fase 7 — Campos do veículo + privacidade do dono
-- 1) Novos campos: FIPE, combustível, câmbio, carroceria, blindado,
--    destaque, opcionais.
-- 2) Move owner_name/owner_phone (PII do dono original) para uma tabela
--    separada com RLS — deixa de ser lido publicamente no catálogo.
-- ============================================================

-- ── Enums ───────────────────────────────────────────────────
create type fuel_type as enum (
  'flex', 'gasolina', 'diesel', 'etanol', 'hibrido', 'eletrico', 'gnv'
);
create type transmission_type as enum (
  'manual', 'automatico', 'automatizado', 'cvt'
);
create type vehicle_body_type as enum (
  'hatch', 'sedan', 'suv', 'picape', 'utilitario', 'cupe', 'conversivel', 'minivan'
);

-- ── Novas colunas em rv_vehicles ────────────────────────────
alter table public.rv_vehicles
  add column if not exists fipe_price   numeric(12,2) check (fipe_price >= 0),
  add column if not exists fuel         fuel_type,
  add column if not exists transmission transmission_type,
  add column if not exists body_type    vehicle_body_type,
  add column if not exists armored      boolean not null default false,
  add column if not exists featured     boolean not null default false,
  add column if not exists options      text[] not null default '{}';

create index if not exists idx_rv_vehicles_featured
  on public.rv_vehicles(featured) where featured;

-- ============================================================
-- Privacidade do dono original (owner ≠ seller)
-- ============================================================
create table if not exists public.rv_vehicle_owners (
  vehicle_id  bigint primary key references public.rv_vehicles(id) on delete cascade,
  owner_name  varchar(255),
  owner_phone varchar(20),
  updated_at  timestamptz not null default now()
);

-- migra os dados já existentes para a tabela privada
insert into public.rv_vehicle_owners (vehicle_id, owner_name, owner_phone)
select id, owner_name, owner_phone
from public.rv_vehicles
where owner_name is not null or owner_phone is not null
on conflict (vehicle_id) do nothing;

-- remove as colunas do catálogo público
alter table public.rv_vehicles
  drop column if exists owner_name,
  drop column if exists owner_phone;

-- RLS: só o vendedor dono do veículo (ou admin) acessa o dono original
alter table public.rv_vehicle_owners enable row level security;

create policy "rv_vehicle_owners_read" on public.rv_vehicle_owners
  for select using (
    exists (
      select 1 from public.rv_vehicles v
      where v.id = vehicle_id
        and (v.seller_id = public.current_seller() or public.is_admin())
    )
  );

create policy "rv_vehicle_owners_write" on public.rv_vehicle_owners
  for all using (
    exists (
      select 1 from public.rv_vehicles v
      where v.id = vehicle_id
        and (v.seller_id = public.current_seller() or public.is_admin())
    )
  ) with check (
    exists (
      select 1 from public.rv_vehicles v
      where v.id = vehicle_id
        and (v.seller_id = public.current_seller() or public.is_admin())
    )
  );

create trigger trg_rv_vehicle_owners_updated_at
  before update on public.rv_vehicle_owners
  for each row execute function public.set_updated_at();
