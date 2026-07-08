-- ============================================================
-- 0045 — Melhorias no cadastro/gestão de veículos
--   #2  Rastrear QUEM cadastrou o veículo (garagista ou vendedor).
--   #3  Apenas o garagista (loja manager) ou o admin podem EDITAR
--       ou EXCLUIR um veículo. O vendedor continua podendo CADASTRAR
--       (a policy de insert por loja é mantida).
-- ============================================================

-- ── #2 · quem cadastrou (created_by) ────────────────────────
alter table public.rv_vehicles
  add column if not exists created_by uuid
    references public.rv_sellers(id) on delete set null;

create index if not exists idx_rv_vehicles_created_by
  on public.rv_vehicles(created_by);

-- Preenche created_by com a pessoa logada no momento do cadastro.
-- SECURITY DEFINER: current_person() lê rv_sellers ignorando RLS.
create or replace function public.set_vehicle_created_by()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.created_by is null then
    new.created_by := public.current_person();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_vehicle_created_by on public.rv_vehicles;
create trigger trg_set_vehicle_created_by
  before insert on public.rv_vehicles
  for each row execute function public.set_vehicle_created_by();

-- ── #3 · editar/excluir = apenas manager (garagista/admin) ──
-- Substitui as policies de escopo por loja (que deixavam qualquer
-- membro da loja — inclusive o vendedor — editar/excluir).
drop policy if exists "rv_vehicles_update_loja" on public.rv_vehicles;
drop policy if exists "rv_vehicles_delete_loja" on public.rv_vehicles;

create policy "rv_vehicles_update_manager" on public.rv_vehicles
  for update using (
    public.is_admin()
    or (public.is_loja_manager() and seller_id = public.current_loja())
  ) with check (
    public.is_admin()
    or (public.is_loja_manager() and seller_id = public.current_loja())
  );

create policy "rv_vehicles_delete_manager" on public.rv_vehicles
  for delete using (
    public.is_admin()
    or (public.is_loja_manager() and seller_id = public.current_loja())
  );
