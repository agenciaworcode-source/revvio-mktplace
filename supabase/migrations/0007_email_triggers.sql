-- ============================================================
-- REVVIO 2.0 · Fase 6+ — Triggers de e-mail transacional
-- Dispara a Edge Function `send-email` (Resend) em eventos de domínio.
-- Usa pg_net para HTTP assíncrono; falhas de e-mail NUNCA quebram a
-- transação principal (cadastro, aprovação, venda continuam valendo).
-- ============================================================

create extension if not exists pg_net;

-- ── Config privada (não exposta na API) ─────────────────────
create schema if not exists private;

-- guarda a URL da função send-email e o segredo compartilhado.
-- Preencher UMA vez após o deploy (ver bloco comentado no fim).
create table if not exists private.email_config (
  id             boolean primary key default true check (id),
  function_url   text not null,
  trigger_secret text not null
);

-- ── Helper: enfileira um e-mail (assíncrono, à prova de falha) ─
create or replace function private.notify_email(
  p_template text,
  p_to       text,
  p_data     jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = private, public, extensions
as $$
declare
  cfg private.email_config;
begin
  if p_to is null or p_to = '' then
    return;
  end if;

  select * into cfg from private.email_config limit 1;
  if cfg is null then
    raise warning 'email_config vazia — e-mail "%" não enviado', p_template;
    return;
  end if;

  perform net.http_post(
    url     := cfg.function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-email-secret', cfg.trigger_secret
    ),
    body    := jsonb_build_object('template', p_template, 'to', p_to, 'data', p_data)
  );
exception when others then
  -- e-mail é best-effort: loga e segue
  raise warning 'notify_email(%) falhou: %', p_template, sqlerrm;
end;
$$;

-- ── Garagista: cadastro (→ vendedor #7 e admins #8) ─────────
create or replace function private.on_seller_insert()
returns trigger
language plpgsql
security definer
set search_path = private, public
as $$
declare
  admin_email text;
begin
  -- #7 confirmação ao próprio vendedor
  perform private.notify_email(
    'seller_registered', new.email,
    jsonb_build_object('name', new.name)
  );
  -- #8 aviso a cada admin
  for admin_email in
    select email from public.rv_sellers
    where role = 'admin' and email is not null
  loop
    perform private.notify_email(
      'admin_new_seller', admin_email,
      jsonb_build_object('name', new.name, 'email', new.email, 'seller_id', new.id)
    );
  end loop;
  return new;
end;
$$;

create trigger trg_seller_insert_email
  after insert on public.rv_sellers
  for each row execute function private.on_seller_insert();

-- ── Garagista: mudança de status (→ #9/#10/#11) ─────────────
create or replace function private.on_seller_status_change()
returns trigger
language plpgsql
security definer
set search_path = private, public
as $$
begin
  if new.status = old.status then
    return new;
  end if;

  if new.status = 'active' and old.status = 'pending' then
    perform private.notify_email('seller_approved', new.email,
      jsonb_build_object('name', new.name));
  elsif new.status = 'active' and old.status = 'suspended' then
    perform private.notify_email('seller_reactivated', new.email,
      jsonb_build_object('name', new.name));
  elsif new.status = 'suspended' then
    perform private.notify_email('seller_suspended', new.email,
      jsonb_build_object('name', new.name));
  end if;
  return new;
end;
$$;

create trigger trg_seller_status_email
  after update of status on public.rv_sellers
  for each row execute function private.on_seller_status_change();

-- ── Veículo cadastrado (→ admins #12) ───────────────────────
create or replace function private.on_vehicle_insert()
returns trigger
language plpgsql
security definer
set search_path = private, public
as $$
declare
  admin_email text;
  v_seller_name text;
begin
  select name into v_seller_name from public.rv_sellers where id = new.seller_id;
  for admin_email in
    select email from public.rv_sellers
    where role = 'admin' and email is not null
  loop
    perform private.notify_email('admin_new_vehicle', admin_email,
      jsonb_build_object(
        'seller_name', coalesce(v_seller_name, 'Vendedor'),
        'make', new.make, 'model', new.model, 'year', new.year
      ));
  end loop;
  return new;
end;
$$;

create trigger trg_vehicle_insert_email
  after insert on public.rv_vehicles
  for each row execute function private.on_vehicle_insert();

-- ── Venda registrada (→ vendedor #13) ───────────────────────
create or replace function private.on_sale_insert()
returns trigger
language plpgsql
security definer
set search_path = private, public
as $$
declare
  v_email text;
  v_vehicle text;
begin
  select email into v_email from public.rv_sellers where id = new.seller_id;
  select make || ' ' || model into v_vehicle
    from public.rv_vehicles where id = new.vehicle_id;

  perform private.notify_email('sale_confirmation', v_email,
    jsonb_build_object(
      'vehicle', coalesce(v_vehicle, 'veículo'),
      'buyer_name', new.buyer_name,
      'sale_price', to_char(new.sale_price, 'FM999G999G990D00')
    ));
  return new;
end;
$$;

create trigger trg_sale_insert_email
  after insert on public.rv_sales
  for each row execute function private.on_sale_insert();

-- ============================================================
-- PÓS-DEPLOY: preencher a config (troque <ref> e o segredo).
-- O segredo deve ser igual ao secret EMAIL_TRIGGER_SECRET da função.
-- ============================================================
-- insert into private.email_config (function_url, trigger_secret)
-- values ('https://<ref>.functions.supabase.co/send-email', '<EMAIL_TRIGGER_SECRET>')
-- on conflict (id) do update
--   set function_url = excluded.function_url,
--       trigger_secret = excluded.trigger_secret;
