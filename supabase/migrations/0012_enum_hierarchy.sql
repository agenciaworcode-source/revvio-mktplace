-- ============================================================
-- Hierarquia · enum app_role: seller→garagista (+ vendedor)
-- RENAME atualiza todas as linhas existentes automaticamente.
-- 'vendedor' NÃO é usado neste arquivo (restrição do ADD VALUE).
-- ============================================================
alter type app_role rename value 'seller' to 'garagista';
alter type app_role add value if not exists 'vendedor';
