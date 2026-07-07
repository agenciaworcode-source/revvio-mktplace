begin;
insert into auth.users (instance_id,id,aud,role,email,created_at,updated_at) values
 ('00000000-0000-0000-0000-000000000000','55555555-5555-5555-5555-555555555555','authenticated','authenticated','cg@t.dev',now(),now()),
 ('00000000-0000-0000-0000-000000000000','55555555-5555-5555-5555-5555555555a1','authenticated','authenticated','cv@t.dev',now(),now());
insert into public.rv_sellers (id,user_id,name,slug,status,role,commission_rate) values
 ('aaaa5555-5555-5555-5555-555555555555','55555555-5555-5555-5555-555555555555','CLoja','cloja','active','garagista',0);
insert into public.rv_sellers (id,user_id,name,status,role,parent_id,commission_rate) values
 ('aaaa5555-5555-5555-5555-5555555555a1','55555555-5555-5555-5555-5555555555a1','CVend','active','vendedor','aaaa5555-5555-5555-5555-555555555555',10);
insert into public.rv_vehicles (id,seller_id,make,model,price,status) overriding system value values
 (920001,'aaaa5555-5555-5555-5555-555555555555','VW','Polo',60000,'sold');
insert into public.rv_sales (id,vehicle_id,seller_id,vendedor_id,buyer_name,sale_price,payment_method) values
 ('aaaa5555-5555-5555-5555-5555555555ff',920001,'aaaa5555-5555-5555-5555-555555555555','aaaa5555-5555-5555-5555-5555555555a1','Comp',60000,'pix');
insert into public.rv_commissions (id,sale_id,seller_id,vendedor_id,amount,rate,status) values
 ('aaaa5555-5555-5555-5555-55555555c001','aaaa5555-5555-5555-5555-5555555555ff','aaaa5555-5555-5555-5555-555555555555','aaaa5555-5555-5555-5555-5555555555a1',6000,10,'pending');

do $$
declare st text;
begin
  perform set_config('role','authenticated',true);

  -- VENDEDOR não pode quitar
  perform set_config('request.jwt.claims', json_build_object('sub','55555555-5555-5555-5555-5555555555a1','role','authenticated')::text, true);
  begin
    perform public.mark_commission_paid('aaaa5555-5555-5555-5555-55555555c001');
    raise exception 'FALHA: vendedor conseguiu quitar comissão';
  exception when others then null; -- esperado: bloqueado
  end;

  -- GARAGISTA da loja quita
  perform set_config('request.jwt.claims', json_build_object('sub','55555555-5555-5555-5555-555555555555','role','authenticated')::text, true);
  perform public.mark_commission_paid('aaaa5555-5555-5555-5555-55555555c001');
  select status into st from public.rv_commissions where id='aaaa5555-5555-5555-5555-55555555c001';
  assert st = 'paid', 'FALHA: garagista não quitou a comissão da própria loja';

  -- e reverte
  perform public.mark_commission_pending('aaaa5555-5555-5555-5555-55555555c001');
  select status into st from public.rv_commissions where id='aaaa5555-5555-5555-5555-55555555c001';
  assert st in ('pending','overdue'), 'FALHA: garagista não reverteu a comissão';

  raise notice '✅ C1 commission manager OK';
end $$;
rollback;
