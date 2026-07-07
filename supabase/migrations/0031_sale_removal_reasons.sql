-- ============================================================
-- Motivo de venda e motivo de remoção
-- ============================================================

-- Motivo da venda
alter table public.rv_sales
  add column if not exists sale_reason text;

-- Motivo/dados da remoção (soft-delete)
alter table public.rv_vehicles
  add column if not exists removal_reason text;
alter table public.rv_vehicles
  add column if not exists removed_at timestamptz;
alter table public.rv_vehicles
  add column if not exists removed_by uuid;

-- register_sale v3: + p_sale_reason
drop function if exists public.register_sale(
  bigint, uuid, varchar, numeric, payment_method, varchar, date
);

create or replace function public.register_sale(
  p_vehicle_id     bigint,
  p_vendedor_id    uuid,
  p_buyer_name     varchar,
  p_sale_price     numeric,
  p_payment_method payment_method,
  p_buyer_phone    varchar default null,
  p_sale_date      date    default current_date,
  p_sale_reason    text    default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_loja          uuid;
  v_vendedor_loja uuid;
  v_rate          numeric(5,2);
  v_sale_id       uuid;
begin
  v_loja := public.current_loja();
  if v_loja is null then
    raise exception 'Usuário atual não pertence a uma loja.';
  end if;

  if not public.is_loja_manager() and p_vendedor_id <> public.current_person() then
    raise exception 'Vendedor só pode registrar a própria venda.';
  end if;

  select coalesce(parent_id, id) into v_vendedor_loja
  from public.rv_sellers where id = p_vendedor_id;
  if v_vendedor_loja is distinct from v_loja then
    raise exception 'Vendedor não pertence à loja.';
  end if;

  if not public.is_admin()
     and not exists (select 1 from public.rv_vehicles
                     where id = p_vehicle_id and seller_id = v_loja) then
    raise exception 'Veículo % não pertence à loja.', p_vehicle_id;
  end if;

  select commission_rate into v_rate from public.rv_sellers where id = p_vendedor_id;

  insert into public.rv_sales (
    vehicle_id, seller_id, vendedor_id, buyer_name, buyer_phone,
    sale_price, payment_method, sale_date, sale_reason
  ) values (
    p_vehicle_id, v_loja, p_vendedor_id, p_buyer_name, p_buyer_phone,
    p_sale_price, p_payment_method, p_sale_date, p_sale_reason
  ) returning id into v_sale_id;

  insert into public.rv_commissions (
    sale_id, seller_id, vendedor_id, amount, rate, status, due_date
  ) values (
    v_sale_id, v_loja, p_vendedor_id,
    round(p_sale_price * v_rate / 100, 2), v_rate, 'pending',
    p_sale_date + interval '30 days'
  );

  update public.rv_vehicles set status = 'sold', updated_at = now()
  where id = p_vehicle_id;

  return v_sale_id;
end;
$$;

grant execute on function public.register_sale(
  bigint, uuid, varchar, numeric, payment_method, varchar, date, text
) to authenticated;
