begin;
-- Loja G1 (garagista g1) com vendedor v1 ; Loja G2 (garagista g2) com vendedor v2
-- (UUIDs são hex: usamos 1.../2... para loja1/loja2 e sufixo a1/a2 p/ vendedores)
insert into auth.users (instance_id,id,aud,role,email,created_at,updated_at) values
 ('00000000-0000-0000-0000-000000000000','11111111-1111-1111-1111-111111111111','authenticated','authenticated','g1@t.dev',now(),now()),
 ('00000000-0000-0000-0000-000000000000','11111111-1111-1111-1111-1111111111a1','authenticated','authenticated','v1@t.dev',now(),now()),
 ('00000000-0000-0000-0000-000000000000','22222222-2222-2222-2222-222222222222','authenticated','authenticated','g2@t.dev',now(),now()),
 ('00000000-0000-0000-0000-000000000000','22222222-2222-2222-2222-2222222222a2','authenticated','authenticated','v2@t.dev',now(),now());

insert into public.rv_sellers (id,user_id,name,slug,status,role,commission_rate) values
 ('aaaa1111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111','Loja1','loja1','active','garagista',0),
 ('bbbb2222-2222-2222-2222-222222222222','22222222-2222-2222-2222-222222222222','Loja2','loja2','active','garagista',0);
insert into public.rv_sellers (id,user_id,name,status,role,parent_id,commission_rate) values
 ('aaaa1111-1111-1111-1111-1111111111a1','11111111-1111-1111-1111-1111111111a1','Vend1','active','vendedor','aaaa1111-1111-1111-1111-111111111111',10),
 ('bbbb2222-2222-2222-2222-2222222222a2','22222222-2222-2222-2222-2222222222a2','Vend2','active','vendedor','bbbb2222-2222-2222-2222-222222222222',10);

-- veículos das duas lojas
insert into public.rv_vehicles (id,seller_id,make,model,price,status) overriding system value values
 (900001,'aaaa1111-1111-1111-1111-111111111111','VW','Gol',50000,'available'),
 (900002,'bbbb2222-2222-2222-2222-222222222222','Fiat','Uno',40000,'available');
-- vendas: v1 vendeu na loja1; v2 vendeu na loja2
insert into public.rv_sales (id,vehicle_id,seller_id,vendedor_id,buyer_name,sale_price,payment_method) values
 ('dddd1111-1111-1111-1111-111111111111',900001,'aaaa1111-1111-1111-1111-111111111111','aaaa1111-1111-1111-1111-1111111111a1','Comp1',50000,'pix'),
 ('dddd2222-2222-2222-2222-222222222222',900002,'bbbb2222-2222-2222-2222-222222222222','bbbb2222-2222-2222-2222-2222222222a2','Comp2',40000,'pix');
insert into public.rv_commissions (sale_id,seller_id,vendedor_id,amount,rate,status) values
 ('dddd1111-1111-1111-1111-111111111111','aaaa1111-1111-1111-1111-111111111111','aaaa1111-1111-1111-1111-1111111111a1',5000,10,'pending'),
 ('dddd2222-2222-2222-2222-222222222222','bbbb2222-2222-2222-2222-222222222222','bbbb2222-2222-2222-2222-2222222222a2',4000,10,'pending');

do $$
declare n int;
begin
  perform set_config('role','authenticated',true);

  -- VENDEDOR v1: vê só a PRÓPRIA venda; não vê a da loja2
  perform set_config('request.jwt.claims', json_build_object('sub','11111111-1111-1111-1111-1111111111a1','role','authenticated')::text, true);
  select count(*) into n from public.rv_sales; assert n = 1, 'FALHA: v1 deveria ver só 1 venda (a própria)';
  select count(*) into n from public.rv_commissions; assert n = 1, 'FALHA: v1 deveria ver só a própria comissão';

  -- GARAGISTA g1: vê toda a loja1 (1 venda) e nada da loja2
  perform set_config('request.jwt.claims', json_build_object('sub','11111111-1111-1111-1111-111111111111','role','authenticated')::text, true);
  select count(*) into n from public.rv_sales; assert n = 1, 'FALHA: g1 deveria ver as vendas da loja1';
  select count(*) into n from public.rv_sales where seller_id='bbbb2222-2222-2222-2222-222222222222'; assert n = 0, 'FALHA: g1 vazou venda da loja2';
  -- g1 não vê o vendedor da loja2
  select count(*) into n from public.rv_sellers where id='bbbb2222-2222-2222-2222-2222222222a2'; assert n = 0, 'FALHA: g1 vazou vendedor da loja2';

  -- catálogo é público: g1 vê os 2 veículos
  select count(*) into n from public.rv_vehicles where id in (900001,900002); assert n = 2, 'FALHA: catálogo deveria ser público';

  raise notice '✅ A3 RLS 3 níveis OK';
end $$;
rollback;
