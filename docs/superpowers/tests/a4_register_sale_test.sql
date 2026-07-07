begin;
insert into auth.users (instance_id,id,aud,role,email,created_at,updated_at) values
 ('00000000-0000-0000-0000-000000000000','33333333-3333-3333-3333-333333333333','authenticated','authenticated','rg1@t.dev',now(),now()),
 ('00000000-0000-0000-0000-000000000000','33333333-3333-3333-3333-3333333333a1','authenticated','authenticated','rv1@t.dev',now(),now());
insert into public.rv_sellers (id,user_id,name,slug,status,role,commission_rate) values
 ('cccc3333-3333-3333-3333-333333333333','33333333-3333-3333-3333-333333333333','RLoja','rloja','active','garagista',0);
insert into public.rv_sellers (id,user_id,name,status,role,parent_id,commission_rate) values
 ('cccc3333-3333-3333-3333-3333333333a1','33333333-3333-3333-3333-3333333333a1','RVend','active','vendedor','cccc3333-3333-3333-3333-333333333333',8);
insert into public.rv_vehicles (id,seller_id,make,model,price,status) overriding system value values
 (910001,'cccc3333-3333-3333-3333-333333333333','Honda','Civic',100000,'available');

do $$
declare v_sale uuid; v_amount numeric; v_vend uuid; v_vstatus text;
begin
  perform set_config('role','authenticated',true);
  -- garagista registra a venda atribuindo ao vendedor v1 (taxa 8%)
  perform set_config('request.jwt.claims', json_build_object('sub','33333333-3333-3333-3333-333333333333','role','authenticated')::text, true);
  v_sale := public.register_sale(910001, 'cccc3333-3333-3333-3333-3333333333a1', 'CompradorX', 100000, 'pix');

  select vendedor_id into v_vend from public.rv_sales where id = v_sale;
  assert v_vend = 'cccc3333-3333-3333-3333-3333333333a1', 'FALHA: venda não atribuída ao vendedor';

  select amount into v_amount from public.rv_commissions where sale_id = v_sale;
  assert v_amount = 8000, 'FALHA: comissão deveria ser 8% de 100000 = 8000 (taxa do vendedor)';

  select status into v_vstatus from public.rv_vehicles where id = 910001;
  assert v_vstatus = 'sold', 'FALHA: veículo não marcado como vendido';

  raise notice '✅ A4 register_sale v2 OK';
end $$;
rollback;
