-- 0039_affiliate_sale_signals.sql
-- "Sinalizar venda": o afiliado avisa o garagista que ajudou numa venda.
-- NÃO cria venda — só um registro in-app + e-mail ao garagista.

create table public.rv_affiliate_sale_signals (
  id           uuid primary key default gen_random_uuid(),
  loja_id      uuid not null references public.rv_sellers(id) on delete cascade,
  affiliate_id uuid not null references public.rv_sellers(id) on delete cascade,
  vehicle_id   bigint references public.rv_vehicles(id) on delete set null,
  note         text,
  status       text not null default 'novo' check (status in ('novo','lido')),
  created_at   timestamptz not null default now()
);
create index idx_rv_aff_signals_loja on public.rv_affiliate_sale_signals(loja_id, created_at desc);
create index idx_rv_aff_signals_aff  on public.rv_affiliate_sale_signals(affiliate_id);

alter table public.rv_affiliate_sale_signals enable row level security;

-- Afiliado lê os próprios sinais; garagista/admin leem os da loja.
create policy "aff_signals_read" on public.rv_affiliate_sale_signals
  for select to authenticated using (
    public.is_admin()
    or (public.is_loja_manager() and loja_id = public.current_loja())
    or affiliate_id = public.current_person()
  );

-- Garagista/admin marcam como lido (status). Afiliado não atualiza.
create policy "aff_signals_update_manager" on public.rv_affiliate_sale_signals
  for update to authenticated using (
    public.is_admin()
    or (public.is_loja_manager() and loja_id = public.current_loja())
  ) with check (
    public.is_admin()
    or (public.is_loja_manager() and loja_id = public.current_loja())
  );

-- Apenas a coluna `status` é atualizável (Supabase concede UPDATE table-wide a
-- authenticated via default privileges; restringimos para o manager só marcar
-- como lido). A policy acima ainda controla QUAIS linhas.
revoke update on public.rv_affiliate_sale_signals from authenticated, anon;
grant update(status) on public.rv_affiliate_sale_signals to authenticated;

-- INSERT só pelo RPC security definer (sem policy de insert direto).

-- RPC: o afiliado sinaliza uma venda. Resolve loja/afiliado pelo current_person.
create or replace function public.signal_affiliate_sale(
  p_vehicle_id bigint default null,
  p_note       text   default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_aff   uuid;
  v_loja  uuid;
  v_id    uuid;
begin
  select id, parent_id into v_aff, v_loja
    from public.rv_sellers
   where user_id = auth.uid() and role = 'afiliado' and status = 'active';

  if v_aff is null or v_loja is null then
    raise exception 'Apenas afiliados ativos podem sinalizar vendas.';
  end if;

  -- se veio vehicle_id, ele precisa pertencer à loja do afiliado
  if p_vehicle_id is not null
     and not exists (select 1 from public.rv_vehicles
                      where id = p_vehicle_id and seller_id = v_loja) then
    raise exception 'Veículo % não pertence à loja.', p_vehicle_id;
  end if;

  insert into public.rv_affiliate_sale_signals (loja_id, affiliate_id, vehicle_id, note)
  values (v_loja, v_aff, p_vehicle_id, nullif(btrim(p_note), ''))
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.signal_affiliate_sale(bigint, text) from public;
grant execute on function public.signal_affiliate_sale(bigint, text) to authenticated;

-- Trigger de e-mail ao garagista (best-effort via private.notify_email).
create or replace function private.on_affiliate_signal_insert()
returns trigger language plpgsql security definer
set search_path = private, public as $$
declare
  v_garagista_email text;
  v_aff_name        text;
  v_veh             text;
begin
  select email into v_garagista_email
    from public.rv_sellers where id = new.loja_id;
  select name into v_aff_name
    from public.rv_sellers where id = new.affiliate_id;
  select coalesce(make || ' ' || model, '') into v_veh
    from public.rv_vehicles where id = new.vehicle_id;

  perform private.notify_email(
    'affiliate_sale_signal', v_garagista_email,
    jsonb_build_object(
      'affiliate', coalesce(v_aff_name, 'Afiliado'),
      'vehicle',   nullif(v_veh, ''),
      'note',      new.note
    )
  );
  return new;
end;
$$;

create trigger trg_affiliate_signal_email
  after insert on public.rv_affiliate_sale_signals
  for each row execute function private.on_affiliate_signal_insert();
