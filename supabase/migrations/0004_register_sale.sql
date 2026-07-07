-- ============================================================
-- REVVIO 2.0 · Fase 1 — RPC de registro de venda
-- Calcula a comissão NO BANCO (rate vem do seller, nunca do cliente)
-- e marca o veículo como vendido. Transação atômica.
-- ============================================================

create or replace function public.register_sale(
  p_vehicle_id     bigint,
  p_buyer_name     varchar,
  p_sale_price     numeric,
  p_payment_method payment_method,
  p_buyer_phone    varchar default null,
  p_sale_date      date    default current_date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seller_id uuid;
  v_rate      numeric(5,2);
  v_sale_id   uuid;
begin
  v_seller_id := public.current_seller();
  if v_seller_id is null then
    raise exception 'Usuário atual não é um vendedor.';
  end if;

  -- o veículo precisa pertencer ao vendedor (admin pode registrar p/ qualquer um)
  if not public.is_admin()
     and not exists (
       select 1 from public.rv_vehicles
       where id = p_vehicle_id and seller_id = v_seller_id
     ) then
    raise exception 'Veículo % não pertence ao vendedor.', p_vehicle_id;
  end if;

  select commission_rate into v_rate
  from public.rv_sellers where id = v_seller_id;

  insert into public.rv_sales (
    vehicle_id, seller_id, buyer_name, buyer_phone,
    sale_price, payment_method, sale_date
  ) values (
    p_vehicle_id, v_seller_id, p_buyer_name, p_buyer_phone,
    p_sale_price, p_payment_method, p_sale_date
  )
  returning id into v_sale_id;

  insert into public.rv_commissions (
    sale_id, seller_id, amount, rate, status, due_date
  ) values (
    v_sale_id,
    v_seller_id,
    round(p_sale_price * v_rate / 100, 2),
    v_rate,
    'pending',
    p_sale_date + interval '30 days'
  );

  update public.rv_vehicles
    set status = 'sold', updated_at = now()
  where id = p_vehicle_id;

  return v_sale_id;
end;
$$;

-- expõe a RPC ao cliente autenticado
grant execute on function public.register_sale(
  bigint, varchar, numeric, payment_method, varchar, date
) to authenticated;
