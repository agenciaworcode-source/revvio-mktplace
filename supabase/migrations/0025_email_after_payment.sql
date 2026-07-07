-- ============================================================
-- E-mail ao garagista SOMENTE após a confirmação do pagamento.
-- No cadastro (insert) não enviamos e-mail ao garagista; o e-mail de
-- boas-vindas (seller_approved, "pagamento confirmado") sai quando o
-- webhook do ASAAS confirma o pagamento (status pending → active),
-- via on_seller_status_change. O admin continua avisado no cadastro.
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

  -- pay-first: NÃO enviamos e-mail ao garagista no cadastro.
  -- O e-mail de boas-vindas sai só quando o pagamento confirma.

  -- aviso a cada admin (consciência do novo cadastro)
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
