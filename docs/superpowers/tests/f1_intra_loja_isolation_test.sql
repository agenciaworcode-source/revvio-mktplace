begin;
-- 1 loja (garagista g6) com DOIS vendedores na MESMA loja: v6a e v6b.
-- Objetivo: provar que v6a não vê vendas/comissões de v6b (e vice-versa),
-- enquanto o garagista g6 vê as duas. Prefixos 6/66; veículos 94xxxx.
insert into auth.users (instance_id,id,aud,role,email,created_at,updated_at) values
 ('00000000-0000-0000-0000-000000000000','66666666-6666-6666-6666-666666666666','authenticated','authenticated','g6@t.dev',now(),now()),
 ('00000000-0000-0000-0000-0000666666a1','66666666-6666-6666-6666-6666666666a1','authenticated','authenticated','v6a@t.dev',now(),now()),
 ('00000000-0000-0000-0000-0000666666b2','66666666-6666-6666-6666-6666666666b2','authenticated','authenticated','v6b@t.dev',now(),now());

insert into public.rv_sellers (id,user_id,name,slug,status,role,commission_rate) values
 ('cccc6666-6666-6666-6666-666666666666','66666666-6666-6666-6666-666666666666','Loja6','loja6','active','garagista',0);
insert into public.rv_sellers (id,user_id,name,status,role,parent_id,commission_rate) values
 ('cccc6666-6666-6666-6666-6666666666a1','66666666-6666-6666-6666-6666666666a1','Vend6A','active','vendedor','cccc6666-6666-6666-6666-666666666666',10),
 ('cccc6666-6666-6666-6666-6666666666b2','66666666-6666-6666-6666-6666666666b2','Vend6B','active','vendedor','cccc6666-6666-6666-6666-666666666666',10);

-- dois veículos da MESMA loja
insert into public.rv_vehicles (id,seller_id,make,model,price,status) overriding system value values
 (940001,'cccc6666-6666-6666-6666-666666666666','VW','Gol',50000,'sold'),
 (940002,'cccc6666-6666-6666-6666-666666666666','Fiat','Uno',40000,'sold');

-- v6a vendeu o 940001; v6b vendeu o 940002 (ambos na loja6)
insert into public.rv_sales (id,vehicle_id,seller_id,vendedor_id,buyer_name,sale_price,payment_method) values
 ('ffff6666-6666-6666-6666-66666666aa01',940001,'cccc6666-6666-6666-6666-666666666666','cccc6666-6666-6666-6666-6666666666a1','CompA',50000,'pix'),
 ('ffff6666-6666-6666-6666-66666666bb02',940002,'cccc6666-6666-6666-6666-666666666666','cccc6666-6666-6666-6666-6666666666b2','CompB',40000,'pix');
insert into public.rv_commissions (sale_id,seller_id,vendedor_id,amount,rate,status) values
 ('ffff6666-6666-6666-6666-66666666aa01','cccc6666-6666-6666-6666-666666666666','cccc6666-6666-6666-6666-6666666666a1',5000,10,'pending'),
 ('ffff6666-6666-6666-6666-66666666bb02','cccc6666-6666-6666-6666-666666666666','cccc6666-6666-6666-6666-6666666666b2',4000,10,'pending');

do $$
declare n int;
begin
  perform set_config('role','authenticated',true);

  -- VENDEDOR v6a: vê só a PRÓPRIA venda/comissão (1), não a do irmão v6b
  perform set_config('request.jwt.claims', json_build_object('sub','66666666-6666-6666-6666-6666666666a1','role','authenticated')::text, true);
  select count(*) into n from public.rv_sales; assert n = 1, 'FALHA: v6a deveria ver só a própria venda';
  select count(*) into n from public.rv_sales where vendedor_id='cccc6666-6666-6666-6666-6666666666b2'; assert n = 0, 'FALHA: v6a vazou a venda do vendedor irmão v6b';
  select count(*) into n from public.rv_commissions; assert n = 1, 'FALHA: v6a deveria ver só a própria comissão';
  select count(*) into n from public.rv_commissions where vendedor_id='cccc6666-6666-6666-6666-6666666666b2'; assert n = 0, 'FALHA: v6a vazou a comissão de v6b';
  -- v6a não enxerga a linha do vendedor irmão (só própria + garagistas públicos)
  select count(*) into n from public.rv_sellers where id='cccc6666-6666-6666-6666-6666666666b2'; assert n = 0, 'FALHA: v6a vazou a linha do vendedor irmão v6b';

  -- VENDEDOR v6b: simétrico — vê só a própria, não a de v6a
  perform set_config('request.jwt.claims', json_build_object('sub','66666666-6666-6666-6666-6666666666b2','role','authenticated')::text, true);
  select count(*) into n from public.rv_sales; assert n = 1, 'FALHA: v6b deveria ver só a própria venda';
  select count(*) into n from public.rv_sales where vendedor_id='cccc6666-6666-6666-6666-6666666666a1'; assert n = 0, 'FALHA: v6b vazou a venda de v6a';
  select count(*) into n from public.rv_commissions; assert n = 1, 'FALHA: v6b deveria ver só a própria comissão';

  -- GARAGISTA g6: vê as DUAS vendas e as DUAS comissões da própria loja
  perform set_config('request.jwt.claims', json_build_object('sub','66666666-6666-6666-6666-666666666666','role','authenticated')::text, true);
  select count(*) into n from public.rv_sales; assert n = 2, 'FALHA: g6 deveria ver as 2 vendas da loja';
  select count(*) into n from public.rv_commissions; assert n = 2, 'FALHA: g6 deveria ver as 2 comissões da loja';
  -- g6 vê os dois vendedores da própria equipe
  select count(*) into n from public.rv_sellers where parent_id='cccc6666-6666-6666-6666-666666666666'; assert n = 2, 'FALHA: g6 deveria ver os 2 vendedores da equipe';

  raise notice '✅ F1 isolamento intra-loja OK';
end $$;
rollback;
