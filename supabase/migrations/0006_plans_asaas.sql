-- ============================================================
-- REVVIO 2.0 · Fase 5 — Planos de comercialização + ASAAS
-- O gestor monta um plano personalizado por garagista (itens livres:
-- opção + valor + recorrência) e a plataforma cobra o vendedor via ASAAS.
-- ============================================================

-- recorrência de cada item do plano
create type plan_billing_type as enum (
  'mensal',           -- assinatura recorrente mensal
  'por_anuncio',      -- cobrado por anúncio publicado (evento)
  'percentual_venda', -- % sobre cada venda (≈ commission_rate)
  'taxa_unica'        -- cobrança avulsa única
);

-- ASAAS: id do cliente do garagista na plataforma de cobrança
alter table public.rv_sellers
  add column if not exists asaas_customer_id text;

-- ── rv_plans (um plano por garagista) ───────────────────────
create table public.rv_plans (
  id                     uuid primary key default gen_random_uuid(),
  seller_id              uuid not null unique references public.rv_sellers(id) on delete cascade,
  name                   varchar(120) not null default 'Plano personalizado',
  description            text,
  active                 boolean not null default true,
  asaas_subscription_id  text,            -- assinatura mensal no ASAAS
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- ── rv_plan_items (itens livres do plano) ───────────────────
create table public.rv_plan_items (
  id           uuid primary key default gen_random_uuid(),
  plan_id      uuid not null references public.rv_plans(id) on delete cascade,
  label        varchar(160) not null,         -- nome livre da opção
  value        numeric(12,2) not null check (value >= 0),
  billing_type plan_billing_type not null,
  created_at   timestamptz not null default now()
);
create index idx_rv_plan_items_plan_id on public.rv_plan_items(plan_id);

-- ── rv_charges (cobranças geradas no ASAAS) ─────────────────
create table public.rv_charges (
  id                    uuid primary key default gen_random_uuid(),
  seller_id             uuid not null references public.rv_sellers(id) on delete cascade,
  plan_id               uuid references public.rv_plans(id) on delete set null,
  asaas_id              text,              -- payment id no ASAAS
  asaas_subscription_id text,
  description           text,
  value                 numeric(12,2) not null check (value >= 0),
  billing_type          text,             -- PIX | BOLETO | CREDIT_CARD
  status                text not null default 'PENDING', -- status bruto do ASAAS
  due_date              date,
  invoice_url           text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index idx_rv_charges_seller_id on public.rv_charges(seller_id);
create index idx_rv_charges_asaas_id  on public.rv_charges(asaas_id);

-- ── updated_at ──────────────────────────────────────────────
create trigger trg_rv_plans_updated_at
  before update on public.rv_plans
  for each row execute function public.set_updated_at();

create trigger trg_rv_charges_updated_at
  before update on public.rv_charges
  for each row execute function public.set_updated_at();

-- ============================================================
-- RLS
-- ============================================================
alter table public.rv_plans      enable row level security;
alter table public.rv_plan_items enable row level security;
alter table public.rv_charges    enable row level security;

-- ── rv_plans: garagista lê o próprio; admin gerencia tudo ───
create policy "rv_plans_read_own" on public.rv_plans
  for select using (seller_id = public.current_seller() or public.is_admin());

create policy "rv_plans_admin_write" on public.rv_plans
  for all using (public.is_admin()) with check (public.is_admin());

-- ── rv_plan_items: visíveis se o plano-pai for visível ──────
create policy "rv_plan_items_read" on public.rv_plan_items
  for select using (
    exists (
      select 1 from public.rv_plans p
      where p.id = plan_id
        and (p.seller_id = public.current_seller() or public.is_admin())
    )
  );

create policy "rv_plan_items_admin_write" on public.rv_plan_items
  for all using (public.is_admin()) with check (public.is_admin());

-- ── rv_charges: garagista lê as próprias; admin lê todas ────
-- INSERT/UPDATE ocorrem via Edge Function (service role, ignora RLS).
create policy "rv_charges_read_own" on public.rv_charges
  for select using (seller_id = public.current_seller() or public.is_admin());

create policy "rv_charges_admin_write" on public.rv_charges
  for all using (public.is_admin()) with check (public.is_admin());
