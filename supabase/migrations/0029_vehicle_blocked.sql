-- ============================================================
-- 0029_vehicle_blocked.sql — bloqueio de anúncio pelo admin
-- O gestor pode bloquear um veículo: ele some das listagens públicas
-- (marketplace, mini-loja, página do veículo) sem ser excluído.
-- ============================================================
alter table public.rv_vehicles
  add column if not exists blocked boolean not null default false;
