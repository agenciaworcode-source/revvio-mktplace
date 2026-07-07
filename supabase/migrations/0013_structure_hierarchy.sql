-- ============================================================
-- Hierarquia · estrutura: parent_id, slug nullable, vendedor_id
-- ============================================================

-- árvore de pessoas
alter table public.rv_sellers
  add column parent_id uuid references public.rv_sellers(id) on delete cascade;
alter table public.rv_sellers alter column slug drop not null;
create index idx_rv_sellers_parent_id on public.rv_sellers(parent_id);

-- venda atribuída ao vendedor (backfill = própria loja, p/ histórico legado)
alter table public.rv_sales
  add column vendedor_id uuid references public.rv_sellers(id);
update public.rv_sales set vendedor_id = seller_id where vendedor_id is null;
alter table public.rv_sales alter column vendedor_id set not null;
create index idx_rv_sales_vendedor_id on public.rv_sales(vendedor_id);

-- comissão direcionada ao vendedor
alter table public.rv_commissions
  add column vendedor_id uuid references public.rv_sellers(id);
update public.rv_commissions set vendedor_id = seller_id where vendedor_id is null;
alter table public.rv_commissions alter column vendedor_id set not null;
create index idx_rv_commissions_vendedor_id on public.rv_commissions(vendedor_id);
