-- 0040_suggest_affiliate_for_sale.sql
-- Sugere o afiliado a partir do telefone do comprador: casa o telefone com
-- um rv_buyers e procura a visita mais recente via ref (affiliate_link_visit)
-- daquele comprador, escopada à loja do chamador. Só sugere se houver
-- comprador rastreável; senão retorna vazio (atribuição manual).

create or replace function public.suggest_affiliate_for_sale(
  p_vehicle_id bigint,
  p_buyer_phone text
) returns table (affiliate_id uuid, affiliate_name text)
language plpgsql security definer set search_path = public as $$
declare
  v_loja  uuid := public.current_loja();
  v_digits text := regexp_replace(coalesce(p_buyer_phone, ''), '\D', '', 'g');
begin
  if v_loja is null or length(v_digits) < 10 then
    return; -- sem loja ou telefone insuficiente → sem sugestão
  end if;

  return query
  select ce.affiliate_id, s.name
    from public.rv_click_events ce
    join public.rv_buyers b on b.id = ce.buyer_id
    join public.rv_sellers s on s.id = ce.affiliate_id
   where ce.kind = 'affiliate_link_visit'
     and ce.seller_id = v_loja
     and ce.affiliate_id is not null
     and (p_vehicle_id is null or ce.vehicle_id = p_vehicle_id)
     and regexp_replace(coalesce(b.phone, ''), '\D', '', 'g') = v_digits
     and s.status = 'active'
   order by ce.created_at desc
   limit 1;
end;
$$;

revoke all on function public.suggest_affiliate_for_sale(bigint, text) from public;
grant execute on function public.suggest_affiliate_for_sale(bigint, text) to authenticated;
