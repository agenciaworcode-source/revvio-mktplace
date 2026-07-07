-- ============================================================
-- REVVIO 2.0 · Fase 1 — Storage (buckets públicos de mídia)
-- avatars, banners, vehicle-images
-- Convenção de path: <seller_id>/<arquivo>  → permite isolar uploads.
-- ============================================================

insert into storage.buckets (id, name, public)
values
  ('avatars',        'avatars',        true),
  ('banners',        'banners',        true),
  ('vehicle-images', 'vehicle-images', true)
on conflict (id) do nothing;

-- leitura pública (buckets são públicos, mas deixamos explícito)
create policy "media_public_read" on storage.objects
  for select using (bucket_id in ('avatars', 'banners', 'vehicle-images'));

-- upload: usuário autenticado, dentro da própria pasta (<seller_id>/...)
create policy "media_insert_own_folder" on storage.objects
  for insert to authenticated with check (
    bucket_id in ('avatars', 'banners', 'vehicle-images')
    and (storage.foldername(name))[1] = public.current_seller()::text
  );

create policy "media_update_own_folder" on storage.objects
  for update to authenticated using (
    bucket_id in ('avatars', 'banners', 'vehicle-images')
    and (storage.foldername(name))[1] = public.current_seller()::text
  );

create policy "media_delete_own_folder" on storage.objects
  for delete to authenticated using (
    bucket_id in ('avatars', 'banners', 'vehicle-images')
    and (storage.foldername(name))[1] = public.current_seller()::text
  );
