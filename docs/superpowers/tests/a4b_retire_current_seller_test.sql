begin;
-- loja R com 1 plano + 1 cobrança; vendedor RV sob a loja
insert into auth.users (instance_id,id,aud,role,email,created_at,updated_at) values
 ('00000000-0000-0000-0000-000000000000','44444444-4444-4444-4444-444444444444','authenticated','authenticated','bg@t.dev',now(),now()),
 ('00000000-0000-0000-0000-000000000000','44444444-4444-4444-4444-4444444444a1','authenticated','authenticated','bv@t.dev',now(),now());
insert into public.rv_sellers (id,user_id,name,slug,status,role,commission_rate) values
 ('dddd4444-4444-4444-4444-444444444444','44444444-4444-4444-4444-444444444444','BLoja','bloja','active','garagista',0);
insert into public.rv_sellers (id,user_id,name,status,role,parent_id,commission_rate) values
 ('dddd4444-4444-4444-4444-4444444444a1','44444444-4444-4444-4444-4444444444a1','BVend','active','vendedor','dddd4444-4444-4444-4444-444444444444',8);

insert into public.rv_plans (id,seller_id,name) values
 ('eeee4444-4444-4444-4444-444444444444','dddd4444-4444-4444-4444-444444444444','Plano R');
insert into public.rv_charges (id,seller_id,value,status) values
 ('ffff4444-4444-4444-4444-444444444444','dddd4444-4444-4444-4444-444444444444',199.90,'PENDING');

do $$
declare n int;
begin
  -- current_seller() foi removida
  select count(*) into n from pg_proc where proname = 'current_seller';
  assert n = 0, 'FALHA: current_seller() ainda existe';

  perform set_config('role','authenticated',true);

  -- VENDEDOR não vê billing da loja (planos/cobranças)
  perform set_config('request.jwt.claims', json_build_object('sub','44444444-4444-4444-4444-4444444444a1','role','authenticated')::text, true);
  select count(*) into n from public.rv_plans;   assert n = 0, 'FALHA: vendedor viu plano da loja (billing)';
  select count(*) into n from public.rv_charges; assert n = 0, 'FALHA: vendedor viu cobrança da loja (billing)';

  -- GARAGISTA (manager) vê o próprio billing
  perform set_config('request.jwt.claims', json_build_object('sub','44444444-4444-4444-4444-444444444444','role','authenticated')::text, true);
  select count(*) into n from public.rv_plans;   assert n = 1, 'FALHA: garagista deveria ver o próprio plano';
  select count(*) into n from public.rv_charges; assert n = 1, 'FALHA: garagista deveria ver a própria cobrança';

  raise notice '✅ A4b retire current_seller OK';
end $$;
rollback;
