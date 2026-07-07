-- ============================================================
-- 0043_admin_delete_seller.sql — admin exclui vendedor/afiliado
--
-- Exclusão individual de uma pessoa (role vendedor|afiliado) pelo
-- admin. Garagista continua sendo excluído pela admin_delete_store.
--
-- Regras:
--   • bloqueia se a pessoa tem vendas registradas (histórico
--     financeiro não pode sumir; exclua as vendas antes, se for o caso);
--   • limpa referências não-cascade: comissões órfãs e cliques de
--     afiliado (set null); sinais de venda cascateiam (0039);
--     rv_vehicles.vendedor_id já é ON DELETE SET NULL (0027).
-- ============================================================
create or replace function public.admin_delete_seller(p_seller_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role app_role;
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;

  select role into v_role from public.rv_sellers where id = p_seller_id;
  if v_role is null then
    raise exception 'Pessoa não encontrada.';
  end if;
  if v_role not in ('vendedor', 'afiliado') then
    raise exception 'Para excluir um garagista use a exclusão de mini-loja.';
  end if;

  if exists (select 1 from public.rv_sales
             where vendedor_id = p_seller_id or affiliate_id = p_seller_id) then
    raise exception 'Esta pessoa tem vendas registradas. Exclua ou reatribua as vendas antes.';
  end if;

  delete from public.rv_commissions
    where vendedor_id = p_seller_id or affiliate_id = p_seller_id;

  update public.rv_click_events set affiliate_id = null
    where affiliate_id = p_seller_id;

  delete from public.rv_sellers where id = p_seller_id;
end;
$$;

revoke all on function public.admin_delete_seller(uuid) from public, anon;
grant execute on function public.admin_delete_seller(uuid) to authenticated;
