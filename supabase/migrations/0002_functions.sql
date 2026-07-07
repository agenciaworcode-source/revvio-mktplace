-- ============================================================
-- REVVIO 2.0 · Fase 1 — Funções auxiliares
-- SECURITY DEFINER → executam como owner e ignoram RLS,
-- evitando recursão nas policies que consultam `sellers`.
-- ============================================================

-- seller_id do usuário logado (null se não for vendedor)
create or replace function public.current_seller()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.rv_sellers where user_id = auth.uid();
$$;

-- true se o usuário logado é admin
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.rv_sellers
    where user_id = auth.uid() and role = 'admin'
  );
$$;

-- mantém updated_at sempre atual
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_rv_sellers_updated_at
  before update on public.rv_sellers
  for each row execute function public.set_updated_at();

create trigger trg_rv_vehicles_updated_at
  before update on public.rv_vehicles
  for each row execute function public.set_updated_at();

-- impede vendedor de alterar colunas sensíveis (comissão/status/role).
-- só o admin (ou o backend via definer) pode mexer nelas.
create or replace function public.protect_seller_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;
  if new.commission_rate is distinct from old.commission_rate
     or new.status is distinct from old.status
     or new.role  is distinct from old.role then
    raise exception 'Apenas o admin pode alterar comissão, status ou role.';
  end if;
  return new;
end;
$$;

create trigger trg_protect_seller_columns
  before update on public.rv_sellers
  for each row execute function public.protect_seller_columns();
