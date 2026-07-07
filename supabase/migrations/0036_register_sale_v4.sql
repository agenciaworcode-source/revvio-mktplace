-- ============================================================
-- 0036_register_sale_v4.sql — register_sale + p_affiliate_id
-- Venda atribuível a vendedor OU afiliado (exclusivo). A comissão
-- usa a commission_rate do beneficiário e grava affiliate_id quando
-- for venda de afiliado.
-- ============================================================
drop function if exists public.register_sale(
  bigint, uuid, varchar, numeric, payment_method, varchar, date, text
);

create or replace function public.register_sale(
  p_vehicle_id     bigint,
  p_vendedor_id    uuid,
  p_buyer_name     varchar,
  p_sale_price     numeric,
  p_payment_method payment_method,
  p_buyer_phone    varchar default null,
  p_sale_date      date    default current_date,
  p_sale_reason    text    default null,
  p_affiliate_id   uuid    default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_loja      uuid;
  v_rate      numeric(5,2);
  v_sale_id   uuid;
  v_aff_loja   uuid;
  v_aff_role   app_role;
  v_aff_status seller_status;
  v_vend_loja  uuid;
begin
  v_loja := public.current_loja();
  if v_loja is null then
    raise exception 'Usuário atual não pertence a uma loja.';
  end if;

  if p_vendedor_id is not null and p_affiliate_id is not null then
    raise exception 'Venda não pode ter vendedor e afiliado ao mesmo tempo.';
  end if;

  if not public.is_admin()
     and not exists (select 1 from public.rv_vehicles
                     where id = p_vehicle_id and seller_id = v_loja) then
    raise exception 'Veículo % não pertence à loja.', p_vehicle_id;
  end if;

  if p_affiliate_id is not null then
    -- ── venda de afiliado: só o garagista (loja manager) registra ──
    if not public.is_loja_manager() and not public.is_admin() then
      raise exception 'Apenas o garagista registra venda de afiliado.';
    end if;
    select coalesce(parent_id, id), role, commission_rate, status
      into v_aff_loja, v_aff_role, v_rate, v_aff_status
      from public.rv_sellers where id = p_affiliate_id;
    if v_aff_loja is distinct from v_loja or v_aff_role <> 'afiliado' then
      raise exception 'Afiliado não pertence à loja.';
    end if;
    if v_aff_status <> 'active' then
      raise exception 'Afiliado inativo não pode receber venda.';
    end if;

    insert into public.rv_sales (
      vehicle_id, seller_id, vendedor_id, affiliate_id, buyer_name, buyer_phone,
      sale_price, payment_method, sale_date, sale_reason
    ) values (
      p_vehicle_id, v_loja, null, p_affiliate_id, p_buyer_name, p_buyer_phone,
      p_sale_price, p_payment_method, p_sale_date, p_sale_reason
    ) returning id into v_sale_id;

    insert into public.rv_commissions (
      sale_id, seller_id, vendedor_id, affiliate_id, amount, rate, status, due_date
    ) values (
      v_sale_id, v_loja, null, p_affiliate_id,
      round(p_sale_price * v_rate / 100, 2), v_rate, 'pending',
      p_sale_date + interval '30 days'
    );
  else
    -- ── venda de vendedor (caminho atual) ──
    if not public.is_loja_manager() and p_vendedor_id <> public.current_person() then
      raise exception 'Vendedor só pode registrar a própria venda.';
    end if;
    select coalesce(parent_id, id) into v_vend_loja
      from public.rv_sellers where id = p_vendedor_id;
    if v_vend_loja is distinct from v_loja then
      raise exception 'Vendedor não pertence à loja.';
    end if;
    select commission_rate into v_rate from public.rv_sellers where id = p_vendedor_id;

    insert into public.rv_sales (
      vehicle_id, seller_id, vendedor_id, affiliate_id, buyer_name, buyer_phone,
      sale_price, payment_method, sale_date, sale_reason
    ) values (
      p_vehicle_id, v_loja, p_vendedor_id, null, p_buyer_name, p_buyer_phone,
      p_sale_price, p_payment_method, p_sale_date, p_sale_reason
    ) returning id into v_sale_id;

    insert into public.rv_commissions (
      sale_id, seller_id, vendedor_id, affiliate_id, amount, rate, status, due_date
    ) values (
      v_sale_id, v_loja, p_vendedor_id, null,
      round(p_sale_price * v_rate / 100, 2), v_rate, 'pending',
      p_sale_date + interval '30 days'
    );
  end if;

  update public.rv_vehicles set status = 'sold', updated_at = now()
  where id = p_vehicle_id;

  return v_sale_id;
end;
$$;

grant execute on function public.register_sale(
  bigint, uuid, varchar, numeric, payment_method, varchar, date, text, uuid
) to authenticated;
