-- ============================================================
-- Admin pode deletar uma mini-loja (garagista) e seu histórico.
--
-- Apagar rv_sellers tem FK misto: cascateia vendedores (parent_id),
-- planos e cobranças; mas rv_sales/rv_commissions não têm cascade (o
-- delete falharia) e rv_vehicles é SET NULL (deixaria veículos órfãos).
-- Por isso a exclusão é feita numa RPC atômica que apaga os filhos na
-- ordem certa. SECURITY DEFINER ignora RLS; o gate é o is_admin() interno.
-- ============================================================
create or replace function public.admin_delete_store(p_seller_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;

  -- ids da loja + seus vendedores (parent_id)
  delete from public.rv_commissions
    where seller_id in (select id from public.rv_sellers
                        where id = p_seller_id or parent_id = p_seller_id);

  delete from public.rv_sales
    where seller_id in (select id from public.rv_sellers
                        where id = p_seller_id or parent_id = p_seller_id);

  delete from public.rv_vehicles
    where seller_id in (select id from public.rv_sellers
                        where id = p_seller_id or parent_id = p_seller_id);

  -- apaga a loja → cascateia vendedores, planos e cobranças
  delete from public.rv_sellers where id = p_seller_id;
end;
$$;

revoke all on function public.admin_delete_store(uuid) from public, anon;
grant execute on function public.admin_delete_store(uuid) to authenticated;
