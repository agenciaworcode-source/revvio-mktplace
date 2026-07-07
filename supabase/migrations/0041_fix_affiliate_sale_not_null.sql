-- ============================================================
-- 0041_fix_affiliate_sale_not_null.sql — corrige venda de afiliado
--
-- Bug: 0013 tornou vendedor_id NOT NULL em rv_sales/rv_commissions;
-- 0035 adicionou affiliate_id (exclusivo com vendedor_id) mas esqueceu
-- de relaxar o NOT NULL. Resultado: register_sale com p_affiliate_id
-- falhava sempre com "null value in column vendedor_id".
--
-- Fix: vendedor_id passa a ser nullable e o check vira "exatamente um
-- responsável" (vendedor OU afiliado) — mais forte que o <= 1 anterior.
-- Seguro p/ dados históricos: todos têm vendedor_id preenchido.
-- ============================================================

alter table public.rv_sales alter column vendedor_id drop not null;
alter table public.rv_commissions alter column vendedor_id drop not null;

alter table public.rv_sales
  drop constraint if exists rv_sales_vendedor_xor_affiliate;
alter table public.rv_sales
  add constraint rv_sales_vendedor_xor_affiliate
  check (num_nonnulls(vendedor_id, affiliate_id) = 1);

alter table public.rv_commissions
  drop constraint if exists rv_commissions_vendedor_xor_affiliate;
alter table public.rv_commissions
  add constraint rv_commissions_vendedor_xor_affiliate
  check (num_nonnulls(vendedor_id, affiliate_id) = 1);
