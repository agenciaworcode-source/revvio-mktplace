-- ============================================================
-- 0051 — Carrossel da home pública
-- ============================================================
-- Antes: uma imagem só (`rv_site_settings.home_banner_url`), sem texto
-- nem link. Agora: N slides, cada um com imagem de computador e de
-- celular, título/subtítulo opcionais e até dois botões com link.
--
-- `home_banner_url` é mantida como fallback: se não houver slide ativo,
-- a home volta a exibir aquela imagem (e o slide 1 é criado a partir
-- dela logo abaixo, então nada se perde).
-- ============================================================

create table if not exists public.rv_home_slides (
  id               uuid primary key default gen_random_uuid(),
  image_url        text,          -- computador / telas largas
  image_mobile_url text,          -- celular (proporção mais alta)
  title            text,
  subtitle         text,
  cta_label        text,
  cta_url          text,
  cta2_label       text,
  cta2_url         text,
  sort_order       int     not null default 0,
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_rv_home_slides_order
  on public.rv_home_slides(sort_order);

comment on table public.rv_home_slides is
  'Slides do carrossel da home pública. Geridos pelo superadmin em Aparência.';

-- ── Configurações do carrossel (singleton já existente) ─────
alter table public.rv_site_settings
  add column if not exists carousel_autoplay    boolean not null default true,
  add column if not exists carousel_interval_ms integer not null default 6000,
  add column if not exists carousel_show_arrows boolean not null default true,
  add column if not exists carousel_show_dots   boolean not null default true;

-- Intervalo em faixa sã: abaixo de 2s o carrossel fica ilegível.
alter table public.rv_site_settings
  drop constraint if exists rv_site_settings_interval_check;
alter table public.rv_site_settings
  add constraint rv_site_settings_interval_check
  check (carousel_interval_ms between 2000 and 30000);

-- ── RLS ─────────────────────────────────────────────────────
alter table public.rv_home_slides enable row level security;

-- Visitante anônimo lê os ativos; o admin lê todos (precisa dos inativos
-- para editar em Aparência).
drop policy if exists "rv_home_slides_read" on public.rv_home_slides;
create policy "rv_home_slides_read" on public.rv_home_slides
  for select using (active or public.is_admin());

drop policy if exists "rv_home_slides_write" on public.rv_home_slides;
create policy "rv_home_slides_write" on public.rv_home_slides
  for all using (public.is_admin()) with check (public.is_admin());

drop trigger if exists trg_rv_home_slides_updated_at on public.rv_home_slides;
create trigger trg_rv_home_slides_updated_at
  before update on public.rv_home_slides
  for each row execute function public.set_updated_at();

-- ── Migra o banner atual para o primeiro slide ──────────────
-- Só quando ainda não existe slide algum, para a migration ser idempotente.
insert into public.rv_home_slides (image_url, sort_order, active)
select s.home_banner_url, 0, true
from public.rv_site_settings s
where s.id = 1
  and s.home_banner_url is not null
  and not exists (select 1 from public.rv_home_slides);
