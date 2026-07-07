-- ============================================================
-- 0042_delete_sale.sql — exclusão de venda pelo garagista/admin
--
-- Apaga a venda e a comissão associada atomicamente e devolve o
-- veículo ao status 'available' (se ainda estiver 'sold').
-- Regras:
--   • só o gestor da loja dona da venda (ou admin) pode excluir;
--   • comissão já paga bloqueia a exclusão (reverta antes, pelo
--     fluxo de comissões, p/ não sumir com histórico financeiro).
-- ============================================================

create or replace function public.delete_sale(p_sale_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_loja uuid := public.current_loja();
  v_sale public.rv_sales%rowtype;
begin
  select * into v_sale from public.rv_sales where id = p_sale_id;
  if not found then
    raise exception 'Venda não encontrada.';
  end if;

  if not public.is_admin()
     and (v_sale.seller_id is distinct from v_loja or not public.is_loja_manager()) then
    raise exception 'Apenas o garagista da loja (ou admin) pode excluir a venda.';
  end if;

  if exists (select 1 from public.rv_commissions
             where sale_id = p_sale_id and status = 'paid') then
    raise exception 'A comissão desta venda já foi paga. Reverta o pagamento antes de excluir.';
  end if;

  delete from public.rv_commissions where sale_id = p_sale_id;
  delete from public.rv_sales where id = p_sale_id;

  update public.rv_vehicles set status = 'available', updated_at = now()
  where id = v_sale.vehicle_id and status = 'sold';
end;
$$;

revoke all on function public.delete_sale(uuid) from public;
grant execute on function public.delete_sale(uuid) to authenticated;
