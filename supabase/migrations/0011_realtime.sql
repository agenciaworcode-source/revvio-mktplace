-- ============================================================
-- REVVIO 2.0 · Realtime multi-vendedor
-- Expõe rv_vehicles e rv_sellers à publication do Realtime.
-- A entrega ainda respeita o RLS de cada assinante:
--   • admin (is_admin) recebe INSERT de qualquer veículo/vendedor;
--   • vendedor recebe UPDATE só da própria linha em rv_sellers.
-- ============================================================

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    -- idempotente: só adiciona se ainda não estiver na publication
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public' and tablename = 'rv_vehicles'
    ) then
      alter publication supabase_realtime add table public.rv_vehicles;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public' and tablename = 'rv_sellers'
    ) then
      alter publication supabase_realtime add table public.rv_sellers;
    end if;
  end if;
end;
$$;

-- UPDATE/DELETE no Realtime precisam da imagem antiga (old record)
-- para o cliente comparar status anterior → novo.
alter table public.rv_sellers replica identity full;
