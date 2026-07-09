-- ============================================================
-- Mini-loja do admin (dono da plataforma) na vitrine pública
-- ============================================================
-- A migration 0015 restringiu a leitura pública de rv_sellers a
-- `role = 'garagista'`, o que impedia a mini-loja do próprio admin
-- (role = 'admin') de abrir em /loja/:slug para visitantes anônimos.
-- O admin também opera uma loja pública, então liberamos a leitura da
-- sua vitrine (apenas status ativo).

drop policy if exists "rv_sellers_public_read_active" on public.rv_sellers;
create policy "rv_sellers_public_read_active" on public.rv_sellers
  for select using (status = 'active' and role in ('garagista', 'admin'));
