-- ============================================================
-- 0038_affiliate_share_and_clicks_rls.sql
-- RPC de "compartilhar" do afiliado + aperto da leitura de cliques
-- ============================================================

-- ── log de compartilhamento (afiliado autenticado clica em compartilhar/copiar) ──
create or replace function public.log_affiliate_share(
  p_vehicle_id bigint
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_aff  uuid;
  v_loja uuid;
begin
  select id, coalesce(parent_id, id) into v_aff, v_loja
    from public.rv_sellers
    where id = public.current_person() and role = 'afiliado' and status = 'active';
  if v_aff is null then
    return; -- não é afiliado ativo: ignora
  end if;
  insert into public.rv_click_events (seller_id, vehicle_id, kind, affiliate_id)
  values (v_loja, p_vehicle_id, 'affiliate_share', v_aff);
end;
$$;
revoke all on function public.log_affiliate_share(bigint) from public;
grant execute on function public.log_affiliate_share(bigint) to authenticated;

-- ── aperto da leitura de cliques: garagista (manager) vê a loja; afiliado vê só os
--    próprios eventos; admin vê tudo. (Antes: qualquer current_loja() lia a loja toda,
--    o que incluía afiliados — vazava cliques de outros.) ──
drop policy if exists "rv_click_events_read_scope" on public.rv_click_events;
create policy "rv_click_events_read_scope" on public.rv_click_events
  for select using (
    public.is_admin()
    or (public.is_loja_manager() and seller_id = public.current_loja())
    or affiliate_id = public.current_person()
  );
