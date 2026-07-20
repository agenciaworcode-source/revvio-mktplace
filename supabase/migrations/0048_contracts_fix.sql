-- ============================================================
-- REVVIO · Correção do módulo de contratos
-- O POST em rv_contracts retornava 400: a coluna template_content
-- não existia no banco (SQL aplicado numa versão anterior da
-- migration 0047) ou o PostgREST estava com o schema em cache.
-- Reaplica as colunas de forma idempotente e força o reload.
-- ============================================================

alter table public.rv_contracts
  add column if not exists template_content text not null default '';

alter table public.rv_contracts
  add column if not exists signed_photo_path text;

alter table public.rv_contracts
  add column if not exists full_text_content text not null default '';

-- PostgREST recarrega o schema imediatamente (sem esperar o cache expirar)
notify pgrst, 'reload schema';
