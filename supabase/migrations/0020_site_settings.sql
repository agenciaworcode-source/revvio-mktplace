-- ============================================================
-- REVVIO · Configurações globais do site (singleton) + banner da home
-- gerenciável pelo superadmin. A landing (/) lê `home_banner_url`;
-- o admin sobe a imagem para o bucket `banners` na pasta `home/`.
-- ============================================================

create table if not exists public.rv_site_settings (
  id              smallint primary key default 1 check (id = 1),
  home_banner_url text,
  updated_at      timestamptz not null default now()
);

-- linha única (singleton)
insert into public.rv_site_settings (id) values (1) on conflict (id) do nothing;

alter table public.rv_site_settings enable row level security;

-- leitura pública (a landing lê o banner, mesmo deslogado)
drop policy if exists "rv_site_settings_read" on public.rv_site_settings;
create policy "rv_site_settings_read" on public.rv_site_settings
  for select using (true);

-- escrita só admin
drop policy if exists "rv_site_settings_write" on public.rv_site_settings;
create policy "rv_site_settings_write" on public.rv_site_settings
  for all using (public.is_admin()) with check (public.is_admin());

create trigger trg_rv_site_settings_updated_at
  before update on public.rv_site_settings
  for each row execute function public.set_updated_at();

-- ── Storage: admin gerencia a pasta `home/` do bucket `banners` ──
-- (as policies existentes exigem pasta = current_loja(); o admin não tem
--  loja, então precisa desta exceção para o banner global da home.)
drop policy if exists "banners_admin_home_insert" on storage.objects;
create policy "banners_admin_home_insert" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'banners'
    and (storage.foldername(name))[1] = 'home'
    and public.is_admin()
  );

drop policy if exists "banners_admin_home_update" on storage.objects;
create policy "banners_admin_home_update" on storage.objects
  for update to authenticated using (
    bucket_id = 'banners'
    and (storage.foldername(name))[1] = 'home'
    and public.is_admin()
  );

drop policy if exists "banners_admin_home_delete" on storage.objects;
create policy "banners_admin_home_delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'banners'
    and (storage.foldername(name))[1] = 'home'
    and public.is_admin()
  );
