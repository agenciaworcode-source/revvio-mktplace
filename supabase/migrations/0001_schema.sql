-- ============================================================
-- REVVIO 2.0 · Fase 1 — Schema base
-- Tabelas: rv_sellers, rv_vehicles, rv_sales, rv_commissions
-- ============================================================

create extension if not exists pgcrypto;          -- gen_random_uuid()

-- ── Enums ───────────────────────────────────────────────────
create type app_role          as enum ('seller', 'admin');
create type seller_status     as enum ('pending', 'active', 'suspended');
create type vehicle_status    as enum ('available', 'reserved', 'sold');
create type payment_method    as enum ('pix', 'financiamento', 'a_vista');
create type commission_status as enum ('pending', 'paid', 'overdue');

-- ── rv_sellers ──────────────────────────────────────────────
create table public.rv_sellers (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null unique references auth.users(id) on delete cascade,
  name            varchar(255) not null,
  slug            varchar(100) not null unique,
  email           varchar(255),
  phone           varchar(20),
  cpf_cnpj        varchar(20),
  bio             text,
  avatar_url      text,
  banner_url      text,
  city            varchar(100),
  state           varchar(2),
  whatsapp        varchar(20),
  instagram       varchar(100),
  commission_rate numeric(5,2) not null default 5.00
                  check (commission_rate >= 0 and commission_rate <= 100),
  status          seller_status not null default 'pending',
  role            app_role not null default 'seller',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ── rv_vehicles ─────────────────────────────────────────────
create table public.rv_vehicles (
  id          bigint generated always as identity primary key,
  seller_id   uuid references public.rv_sellers(id) on delete set null,
  make        varchar(100) not null,
  model       varchar(100) not null,
  year        int,
  price       numeric(12,2) not null check (price >= 0),
  mileage     int,
  color       varchar(50),
  description text,
  status      vehicle_status not null default 'available',
  owner_name  varchar(255),   -- proprietário original do carro (≠ seller)
  owner_phone varchar(20),
  images      text[] not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index idx_rv_vehicles_seller_id on public.rv_vehicles(seller_id);
create index idx_rv_vehicles_status    on public.rv_vehicles(status);

-- ── rv_sales ────────────────────────────────────────────────
create table public.rv_sales (
  id             uuid primary key default gen_random_uuid(),
  vehicle_id     bigint not null references public.rv_vehicles(id),
  seller_id      uuid not null references public.rv_sellers(id),
  buyer_name     varchar(255) not null,
  buyer_phone    varchar(20),
  sale_price     numeric(12,2) not null check (sale_price >= 0),
  sale_date      date not null default current_date,
  payment_method payment_method not null,
  created_at     timestamptz not null default now()
);
create index idx_rv_sales_seller_id on public.rv_sales(seller_id);

-- ── rv_commissions ──────────────────────────────────────────
create table public.rv_commissions (
  id         uuid primary key default gen_random_uuid(),
  sale_id    uuid not null unique references public.rv_sales(id) on delete cascade,
  seller_id  uuid not null references public.rv_sellers(id),
  amount     numeric(12,2) not null check (amount >= 0),
  rate       numeric(5,2)  not null,
  status     commission_status not null default 'pending',
  due_date   date,
  paid_at    timestamptz,
  created_at timestamptz not null default now()
);
create index idx_rv_commissions_seller_id on public.rv_commissions(seller_id);
create index idx_rv_commissions_status    on public.rv_commissions(status);
