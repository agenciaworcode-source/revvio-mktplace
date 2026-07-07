-- ============================================================
-- 0034_affiliate_role.sql — novo papel: afiliado
-- Arquivo isolado: Postgres exige o valor de enum commitado
-- antes de ser referenciado (0036/0037).
-- ============================================================
alter type public.app_role add value if not exists 'afiliado';
