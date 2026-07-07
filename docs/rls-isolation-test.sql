-- ============================================================
-- REVVIO 2.0 · Fase 6 — Teste de isolamento (RLS)
-- Objetivo: provar que "vendedor A não vê os dados de vendedor B".
--
-- Como rodar: cole no SQL Editor do Supabase (ou psql). O bloco simula a
-- sessão de cada vendedor definindo `request.jwt.claims` (de onde auth.uid()
-- lê o `sub`) e o role `authenticated`, exatamente como o PostgREST faz.
--
-- PRÉ-REQUISITO: dois vendedores reais já cadastrados. Edite os e-mails abaixo.
-- ============================================================

do $$
declare
  uid_a uuid;
  uid_b uuid;
  sid_a uuid;
  sid_b uuid;
  visiveis int;
begin
  select id into uid_a from auth.users where email = 'vendedor-a@example.com';
  select id into uid_b from auth.users where email = 'vendedor-b@example.com';
  if uid_a is null or uid_b is null then
    raise exception 'Cadastre vendedor-a@ e vendedor-b@ antes de rodar o teste.';
  end if;

  select id into sid_a from public.rv_sellers where user_id = uid_a;
  select id into sid_b from public.rv_sellers where user_id = uid_b;

  -- ── Simula a sessão do vendedor A ───────────────────────────
  perform set_config('role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', uid_a, 'role', 'authenticated')::text,
    true
  );

  -- A deve enxergar SÓ as próprias vendas
  select count(*) into visiveis
  from public.rv_sales where seller_id = sid_b;
  assert visiveis = 0, 'FALHA: vendedor A enxergou vendas do vendedor B';

  -- A deve enxergar SÓ as próprias comissões
  select count(*) into visiveis
  from public.rv_commissions where seller_id = sid_b;
  assert visiveis = 0, 'FALHA: vendedor A enxergou comissões do vendedor B';

  -- A deve enxergar SÓ as próprias cobranças
  select count(*) into visiveis
  from public.rv_charges where seller_id = sid_b;
  assert visiveis = 0, 'FALHA: vendedor A enxergou cobranças do vendedor B';

  -- A deve enxergar SÓ o próprio plano
  select count(*) into visiveis
  from public.rv_plans where seller_id = sid_b;
  assert visiveis = 0, 'FALHA: vendedor A enxergou o plano do vendedor B';

  -- catálogo de veículos É público: A deve ver veículos de B (esperado)
  select count(*) into visiveis
  from public.rv_vehicles where seller_id = sid_b;
  raise notice 'OK: catálogo público — A vê % veículo(s) de B (esperado).', visiveis;

  -- reset
  perform set_config('request.jwt.claims', null, true);
  perform set_config('role', 'postgres', true);

  raise notice '✅ Isolamento RLS validado: A não acessa vendas/comissões/cobranças/plano de B.';
end $$;
