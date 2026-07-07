begin;
-- usuários e linhas de teste (garagista G + vendedor V sob G)
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000','aaaaaaaa-0000-0000-0000-0000000000a1',
        'authenticated','authenticated','g@test.dev', now(), now()),
       ('00000000-0000-0000-0000-000000000000','aaaaaaaa-0000-0000-0000-0000000000a2',
        'authenticated','authenticated','v@test.dev', now(), now());

insert into public.rv_sellers (id, user_id, name, slug, status, role, commission_rate)
values ('bbbbbbbb-0000-0000-0000-0000000000b1','aaaaaaaa-0000-0000-0000-0000000000a1',
        'Loja G','loja-g','active','garagista',0);
insert into public.rv_sellers (id, user_id, name, status, role, parent_id, commission_rate)
values ('bbbbbbbb-0000-0000-0000-0000000000b2','aaaaaaaa-0000-0000-0000-0000000000a2',
        'Vendedor V','active','vendedor','bbbbbbbb-0000-0000-0000-0000000000b1',10);

do $$
begin
  -- contexto = garagista G
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims',
    json_build_object('sub','aaaaaaaa-0000-0000-0000-0000000000a1','role','authenticated')::text, true);
  assert public.current_person() = 'bbbbbbbb-0000-0000-0000-0000000000b1', 'FALHA: current_person(G)';
  assert public.current_loja()   = 'bbbbbbbb-0000-0000-0000-0000000000b1', 'FALHA: current_loja(G)=própria';
  assert public.is_loja_manager() = true, 'FALHA: G deveria ser manager';

  -- contexto = vendedor V (loja = G)
  perform set_config('request.jwt.claims',
    json_build_object('sub','aaaaaaaa-0000-0000-0000-0000000000a2','role','authenticated')::text, true);
  assert public.current_person() = 'bbbbbbbb-0000-0000-0000-0000000000b2', 'FALHA: current_person(V)';
  assert public.current_loja()   = 'bbbbbbbb-0000-0000-0000-0000000000b1', 'FALHA: current_loja(V)=parent';
  assert public.is_loja_manager() = false, 'FALHA: V não é manager';

  raise notice '✅ A2 helpers OK';
end $$;
rollback;
