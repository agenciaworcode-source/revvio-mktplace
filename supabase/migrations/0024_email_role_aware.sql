-- ============================================================
-- E-mails de cadastro só para GARAGISTA (fluxo pay-first).
-- O vendedor recebe o convite do Supabase Auth (definir senha),
-- branded na Fase B — então não dispara e-mail de domínio aqui,
-- evitando e-mail duplicado e copy errada. Admin também só é
-- notificado em cadastro de garagista.
-- ============================================================
create or replace function private.on_seller_insert()
returns trigger
language plpgsql
security definer
set search_path = private, public
as $$
declare
  admin_email text;
begin
  -- vendedores são criados pelo garagista (convite Auth) → sem e-mail de domínio
  if new.role <> 'garagista' then
    return new;
  end if;

  -- confirmação ao próprio garagista (pay-first)
  perform private.notify_email(
    'seller_registered', new.email,
    jsonb_build_object('name', new.name)
  );
  -- aviso a cada admin
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
