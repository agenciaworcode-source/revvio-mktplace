-- ============================================================
-- 0037_affiliate_rls_visit.sql — leitura do afiliado + log de visita por ref
-- ============================================================

-- ── rv_sales: afiliado lê as próprias vendas ──
drop policy if exists "rv_sales_read_scope" on public.rv_sales;
create policy "rv_sales_read_scope" on public.rv_sales
  for select using (
    public.is_admin()
    or (public.is_loja_manager() and seller_id = public.current_loja())
    or vendedor_id = public.current_person()
    or affiliate_id = public.current_person()
  );

-- ── rv_commissions: afiliado lê as próprias comissões ──
drop policy if exists "rv_commissions_read_scope" on public.rv_commissions;
create policy "rv_commissions_read_scope" on public.rv_commissions
  for select using (
    public.is_admin()
    or (public.is_loja_manager() and seller_id = public.current_loja())
    or vendedor_id = public.current_person()
    or affiliate_id = public.current_person()
  );

-- ── log de visita chegada pelo link do afiliado (?ref=) ──
-- security definer: insert público controlado (anon/comprador), no espírito
-- de log_click_event. Ref inválido/afiliado inativo é ignorado em silêncio.
create or replace function public.log_affiliate_visit(
  p_ref_code   text,
  p_vehicle_id bigint default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_aff   uuid;
  v_loja  uuid;
  v_buyer uuid;
begin
  select id, coalesce(parent_id, id) into v_aff, v_loja
    from public.rv_sellers
    where ref_code = p_ref_code and role = 'afiliado' and status = 'active';
  if v_aff is null then
    return;
  end if;
  select id into v_buyer from public.rv_buyers where id = auth.uid();
  insert into public.rv_click_events (seller_id, vehicle_id, buyer_id, kind, affiliate_id)
  values (v_loja, p_vehicle_id, v_buyer, 'affiliate_link_visit', v_aff);
end;
$$;
revoke all on function public.log_affiliate_visit(text, bigint) from public;
grant execute on function public.log_affiliate_visit(text, bigint) to anon, authenticated;
