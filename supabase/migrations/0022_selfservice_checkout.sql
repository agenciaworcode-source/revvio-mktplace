-- ============================================================
-- Checkout ASAAS self-service: ciclo do plano + assinatura no seller
-- ============================================================
alter table public.rv_sellers
  add column if not exists plan_cycle text
    check (plan_cycle in ('monthly','annual')),
  add column if not exists asaas_subscription_id text;
