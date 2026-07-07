-- ============================================================
-- Hierarquia · funções de escopo (SECURITY DEFINER)
-- ============================================================

-- a linha da pessoa logada
create or replace function public.current_person()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.rv_sellers where user_id = auth.uid();
$$;

-- a loja da pessoa logada (própria id se garagista/admin; parent se vendedor)
create or replace function public.current_loja()
returns uuid language sql stable security definer set search_path = public as $$
  select coalesce(parent_id, id) from public.rv_sellers where user_id = auth.uid();
$$;

-- pode ver/gerir a loja inteira
create or replace function public.is_loja_manager()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.rv_sellers
    where user_id = auth.uid() and role in ('garagista','admin')
  );
$$;
