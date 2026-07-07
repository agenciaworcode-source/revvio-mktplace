-- ============================================================
-- 0033_click_events.sql — log de cliques off-site
-- ============================================================
create table public.rv_click_events (
  id         bigint generated always as identity primary key,
  seller_id  uuid not null references public.rv_sellers(id) on delete cascade,
  vehicle_id bigint references public.rv_vehicles(id) on delete set null,
  buyer_id   uuid references public.rv_buyers(id) on delete set null,
  kind       text not null check (kind in ('vehicle_interest','store_whatsapp','store_instagram')),
  created_at timestamptz not null default now()
);
create index idx_rv_click_events_seller  on public.rv_click_events(seller_id);
create index idx_rv_click_events_vehicle on public.rv_click_events(vehicle_id);
create index idx_rv_click_events_buyer   on public.rv_click_events(buyer_id);
create index idx_rv_click_events_created on public.rv_click_events(created_at desc);

alter table public.rv_click_events enable row level security;

-- inserção pública (anônimo ou comprador); leitura: admin ou dono da loja
create policy "rv_click_events_insert_public" on public.rv_click_events
  for insert with check (true);
create policy "rv_click_events_read_scope" on public.rv_click_events
  for select using (public.is_admin() or seller_id = public.current_loja());

-- registra um evento; usa o comprador logado quando existir
create or replace function public.log_click_event(
  p_kind       text,
  p_seller_id  uuid,
  p_vehicle_id bigint default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_buyer uuid;
begin
  if p_kind not in ('vehicle_interest','store_whatsapp','store_instagram') then
    raise exception 'kind inválido: %', p_kind;
  end if;
  select id into v_buyer from public.rv_buyers where id = auth.uid();
  insert into public.rv_click_events (seller_id, vehicle_id, buyer_id, kind)
  values (p_seller_id, p_vehicle_id, v_buyer, p_kind);
end;
$$;
revoke all on function public.log_click_event(text, uuid, bigint) from public;
grant execute on function public.log_click_event(text, uuid, bigint) to anon, authenticated;
