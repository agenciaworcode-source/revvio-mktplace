-- ============================================================
-- Soft-delete de veículos: novo status 'removed'
-- (em migration isolada: o Postgres exige o valor de enum
--  commitado antes de poder ser usado.)
-- ============================================================
alter type vehicle_status add value if not exists 'removed';
