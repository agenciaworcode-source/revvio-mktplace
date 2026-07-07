-- ============================================================
-- Onboarding com criação adiada: os dados do cadastro do garagista
-- ficam aqui até o pagamento confirmar. Só então o webhook cria o
-- usuário do Auth + o seller. Acesso só pelas Edge Functions
-- (service-role); RLS sem policies bloqueia anon/authenticated.
-- ============================================================
create table if not exists public.rv_pending_signups (
  id                     uuid primary key default gen_random_uuid(),
  name                   text not null,
  email                  text not null unique,
  phone                  text,
  cpf_cnpj               text,
  city                   text,
  pricing_plan_key       text not null,
  plan_cycle             text check (plan_cycle in ('monthly','annual')),
  asaas_customer_id      text,
  asaas_subscription_id  text,
  asaas_payment_id       text,
  invoice_url            text,
  created_at             timestamptz not null default now()
);

alter table public.rv_pending_signups enable row level security;
-- sem policies: nem anon nem authenticated acessam; service-role (Edge) bypassa.
