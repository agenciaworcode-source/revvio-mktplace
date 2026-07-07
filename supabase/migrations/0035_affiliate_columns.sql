-- ============================================================
-- 0035_affiliate_columns.sql — colunas e gating do sistema de afiliados
-- ============================================================

-- código curto e estável do afiliado (usado no link público ?ref=)
alter table public.rv_sellers
  add column if not exists ref_code text unique;

-- gating por plano
alter table public.rv_pricing_plans
  add column if not exists affiliates_enabled boolean not null default false;
update public.rv_pricing_plans set affiliates_enabled = true where key = 'profissional';

-- atribuição de venda ao afiliado (exclusivo com vendedor)
alter table public.rv_sales
  add column if not exists affiliate_id uuid references public.rv_sellers(id);
alter table public.rv_sales
  drop constraint if exists rv_sales_vendedor_xor_affiliate;
alter table public.rv_sales
  add constraint rv_sales_vendedor_xor_affiliate
  check (num_nonnulls(vendedor_id, affiliate_id) <= 1);
create index if not exists idx_rv_sales_affiliate_id on public.rv_sales(affiliate_id);

-- beneficiário afiliado na comissão (exclusivo com vendedor)
alter table public.rv_commissions
  add column if not exists affiliate_id uuid references public.rv_sellers(id);
alter table public.rv_commissions
  drop constraint if exists rv_commissions_vendedor_xor_affiliate;
alter table public.rv_commissions
  add constraint rv_commissions_vendedor_xor_affiliate
  check (num_nonnulls(vendedor_id, affiliate_id) <= 1);
create index if not exists idx_rv_commissions_affiliate_id on public.rv_commissions(affiliate_id);

-- tracking: afiliado nos eventos de clique + novos tipos
alter table public.rv_click_events
  add column if not exists affiliate_id uuid references public.rv_sellers(id);
create index if not exists idx_rv_click_events_affiliate on public.rv_click_events(affiliate_id);
alter table public.rv_click_events
  drop constraint if exists rv_click_events_kind_check;
alter table public.rv_click_events
  add constraint rv_click_events_kind_check
  check (kind in (
    'vehicle_interest','store_whatsapp','store_instagram',
    'affiliate_share','affiliate_link_visit'
  ));
