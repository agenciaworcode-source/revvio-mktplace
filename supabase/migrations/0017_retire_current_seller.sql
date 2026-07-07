-- ============================================================
-- Hierarquia · aposenta current_seller(): migra as policies
-- restantes (storage, planos/cobranças, owners) para os helpers
-- de loja e então remove a função.
--   • storage media + vehicle_owners → escopo da LOJA (current_loja)
--     (vendedores gerenciam o estoque/imagens compartilhados)
--   • planos/cobranças → MANAGER da loja (vendedor não vê billing)
-- ============================================================

-- ── storage.objects (pasta = <loja_id>) ────────────────────
drop policy if exists "media_insert_own_folder" on storage.objects;
drop policy if exists "media_update_own_folder" on storage.objects;
drop policy if exists "media_delete_own_folder" on storage.objects;

create policy "media_insert_own_folder" on storage.objects
  for insert to authenticated with check (
    bucket_id in ('avatars', 'banners', 'vehicle-images')
    and (storage.foldername(name))[1] = public.current_loja()::text
  );
create policy "media_update_own_folder" on storage.objects
  for update to authenticated using (
    bucket_id in ('avatars', 'banners', 'vehicle-images')
    and (storage.foldername(name))[1] = public.current_loja()::text
  );
create policy "media_delete_own_folder" on storage.objects
  for delete to authenticated using (
    bucket_id in ('avatars', 'banners', 'vehicle-images')
    and (storage.foldername(name))[1] = public.current_loja()::text
  );

-- ── rv_vehicle_owners (escopo = loja) ───────────────────────
drop policy if exists "rv_vehicle_owners_read" on public.rv_vehicle_owners;
drop policy if exists "rv_vehicle_owners_write" on public.rv_vehicle_owners;

create policy "rv_vehicle_owners_read" on public.rv_vehicle_owners
  for select using (
    exists (select 1 from public.rv_vehicles v
            where v.id = vehicle_id
              and (v.seller_id = public.current_loja() or public.is_admin()))
  );
create policy "rv_vehicle_owners_write" on public.rv_vehicle_owners
  for all using (
    exists (select 1 from public.rv_vehicles v
            where v.id = vehicle_id
              and (v.seller_id = public.current_loja() or public.is_admin()))
  ) with check (
    exists (select 1 from public.rv_vehicles v
            where v.id = vehicle_id
              and (v.seller_id = public.current_loja() or public.is_admin()))
  );

-- ── billing: planos/itens/cobranças = MANAGER da loja ───────
drop policy if exists "rv_plans_read_own" on public.rv_plans;
create policy "rv_plans_read_own" on public.rv_plans
  for select using (
    public.is_admin() or (public.is_loja_manager() and seller_id = public.current_loja())
  );

drop policy if exists "rv_plan_items_read" on public.rv_plan_items;
create policy "rv_plan_items_read" on public.rv_plan_items
  for select using (
    exists (select 1 from public.rv_plans p
            where p.id = plan_id
              and (public.is_admin()
                   or (public.is_loja_manager() and p.seller_id = public.current_loja())))
  );

drop policy if exists "rv_charges_read_own" on public.rv_charges;
create policy "rv_charges_read_own" on public.rv_charges
  for select using (
    public.is_admin() or (public.is_loja_manager() and seller_id = public.current_loja())
  );

-- ── agora sem dependentes: remove a função antiga ───────────
drop function if exists public.current_seller();
