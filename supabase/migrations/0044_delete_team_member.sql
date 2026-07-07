-- ============================================================
-- 0044_delete_team_member.sql — garagista exclui vendedor/afiliado
--
-- Exclusão individual de uma pessoa (role vendedor|afiliado) pelo
-- GARAGISTA dono da loja (parent_id = current_loja()) — ou pelo admin.
-- Espelha as mesmas proteções da admin_delete_seller (0043), mas com
-- autorização escopada à loja, para habilitar o CRUD no painel do
-- garagista (/painel/vendedores e /painel/afiliados).
--
-- Regras (idênticas à 0043):
--   • só exclui pessoas com role 'vendedor' ou 'afiliado';
--   • bloqueia se a pessoa tem vendas registradas (histórico
--     financeiro não pode sumir; exclua as vendas antes, se for o caso);
--   • limpa referências não-cascade: comissões órfãs e cliques de
--     afiliado (set null); sinais de venda cascateiam (0039);
--     rv_vehicles.vendedor_id já é ON DELETE SET NULL (0027).
--
-- Autorização: como é SECURITY DEFINER (ignora RLS), a checagem de
-- escopo é feita explicitamente no corpo — o garagista só pode excluir
-- alguém cuja loja (parent_id) seja a sua própria (current_loja()).
-- ============================================================
create or replace function public.delete_team_member(p_seller_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role   app_role;
  v_parent uuid;
begin
  select role, parent_id into v_role, v_parent
    from public.rv_sellers where id = p_seller_id;
  if v_role is null then
    raise exception 'Pessoa não encontrada.';
  end if;
  if v_role not in ('vendedor', 'afiliado') then
    raise exception 'Só é possível excluir vendedores ou afiliados.';
  end if;

  -- admin (global) OU garagista dono da loja dessa pessoa
  if not (
    public.is_admin()
    or (public.is_loja_manager() and v_parent = public.current_loja())
  ) then
    raise exception 'forbidden';
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

revoke all on function public.delete_team_member(uuid) from public, anon;
grant execute on function public.delete_team_member(uuid) to authenticated;
