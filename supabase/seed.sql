-- ============================================================
-- REVVIO 2.0 · Seed / bootstrap do admin
-- ============================================================
-- O admin precisa de um usuário em auth.users. Fluxo recomendado:
--   1) crie o usuário (Dashboard → Authentication → Add user, ou signUp)
--   2) rode o bloco abaixo trocando o e-mail para promovê-lo a admin.
--
-- Isso também serve como "vendedor padrão" para popular vehicles.seller_id
-- numa migração de dados legados (ver nota de retrocompatibilidade no escopo).
-- ============================================================

insert into public.rv_sellers (user_id, name, slug, email, status, role, commission_rate)
select
  u.id,
  'Administrador REVVIO',
  'revvio',
  u.email,
  'active',
  'admin',
  0
from auth.users u
where u.email = 'raitechlabsbr@gmail.com'   -- ← troque pelo e-mail do admin
on conflict (user_id) do update
  set role = 'admin', status = 'active';
