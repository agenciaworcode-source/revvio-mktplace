-- ============================================================
-- Hierarquia · RLS de 3 níveis (substitui as policies por loja)
-- ============================================================

-- ── rv_sellers ──────────────────────────────────────────────
drop policy if exists "rv_sellers_public_read_active" on public.rv_sellers;
create policy "rv_sellers_public_read_active" on public.rv_sellers
  for select using (status = 'active' and role = 'garagista');

create policy "rv_sellers_team_read" on public.rv_sellers
  for select using (parent_id = public.current_loja());

create policy "rv_sellers_team_update" on public.rv_sellers
  for update using (parent_id = public.current_loja() and public.is_loja_manager())
  with check (parent_id = public.current_loja() and public.is_loja_manager());
-- mantidas: rv_sellers_read_own, rv_sellers_admin_read,
--           rv_sellers_insert_self, rv_sellers_update_own, rv_sellers_admin_update

-- ── rv_vehicles (escopo = loja) ─────────────────────────────
drop policy if exists "rv_vehicles_insert_own" on public.rv_vehicles;
drop policy if exists "rv_vehicles_update_own" on public.rv_vehicles;
drop policy if exists "rv_vehicles_delete_own" on public.rv_vehicles;

create policy "rv_vehicles_insert_loja" on public.rv_vehicles
  for insert with check (seller_id = public.current_loja());
create policy "rv_vehicles_update_loja" on public.rv_vehicles
  for update using (seller_id = public.current_loja() or public.is_admin())
  with check (seller_id = public.current_loja() or public.is_admin());
create policy "rv_vehicles_delete_loja" on public.rv_vehicles
  for delete using (seller_id = public.current_loja() or public.is_admin());

-- ── rv_sales (manager vê a loja; vendedor vê as próprias) ────
drop policy if exists "rv_sales_read_own" on public.rv_sales;
drop policy if exists "rv_sales_insert_own" on public.rv_sales;
drop policy if exists "rv_sales_update_own" on public.rv_sales;

create policy "rv_sales_read_scope" on public.rv_sales
  for select using (
    public.is_admin()
    or (public.is_loja_manager() and seller_id = public.current_loja())
    or vendedor_id = public.current_person()
  );
create policy "rv_sales_update_manager" on public.rv_sales
  for update using (public.is_admin() or (public.is_loja_manager() and seller_id = public.current_loja()))
  with check (public.is_admin() or (public.is_loja_manager() and seller_id = public.current_loja()));
-- INSERT só via register_sale() (SECURITY DEFINER) → sem policy de insert.

-- ── rv_commissions ──────────────────────────────────────────
drop policy if exists "rv_commissions_read_own" on public.rv_commissions;
drop policy if exists "rv_commissions_admin_update" on public.rv_commissions;

create policy "rv_commissions_read_scope" on public.rv_commissions
  for select using (
    public.is_admin()
    or (public.is_loja_manager() and seller_id = public.current_loja())
    or vendedor_id = public.current_person()
  );
create policy "rv_commissions_update_manager" on public.rv_commissions
  for update using (public.is_admin() or (public.is_loja_manager() and seller_id = public.current_loja()))
  with check (public.is_admin() or (public.is_loja_manager() and seller_id = public.current_loja()));

-- ── trigger: garagista gere comissão/status da própria equipe ─
create or replace function public.protect_seller_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then
    return new;
  end if;
  -- garagista pode ajustar comissão/status dos vendedores da própria loja
  if public.is_loja_manager()
     and old.parent_id = public.current_loja()
     and new.role = old.role
     and new.parent_id is not distinct from old.parent_id then
    return new;
  end if;
  if new.commission_rate is distinct from old.commission_rate
     or new.status is distinct from old.status
     or new.role  is distinct from old.role
     or new.parent_id is distinct from old.parent_id then
    raise exception 'Sem permissão para alterar comissão, status, papel ou vínculo.';
  end if;
  return new;
end;
$$;
