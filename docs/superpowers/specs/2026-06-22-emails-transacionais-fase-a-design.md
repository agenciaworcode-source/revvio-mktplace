# E-mails transacionais — Fase A (eventos de domínio via Resend)

**Data:** 2026-06-22 · **Status:** aprovado (brainstorming)

## Contexto

A plataforma tem infraestrutura de e-mail de eventos de domínio (migration 0007:
triggers + `private.email_config` + `private.notify_email`; função Edge `send-email`;
templates em `_shared/email-templates.ts`), mas **nada está ligado no remoto**
`ahtisetxygjyfvhguckl`: a função `send-email` não está deployada, faltam os secrets
(`RESEND_API_KEY`, `EMAIL_TRIGGER_SECRET`) e a `private.email_config` está vazia.
Além disso, a copy do `seller_registered` ("em análise… aprovado pelo administrador")
contradiz o novo fluxo pay-first do checkout.

Decisões do brainstorming (2026-06-22):
- Domínio `revvio.com.br` **já verificado** no Resend.
- E-mails de **autenticação** (redefinir senha, confirmar e-mail, convite) → **Fase B**
  (SMTP customizado do Resend no Supabase Auth). Fora desta fase.
- Sequência: **Fase A primeiro**.
- **Vendedor não recebe e-mail de domínio na Fase A** (o e-mail dele é o convite do
  Auth, branded na Fase B) — evita e-mail duplicado e copy errada.
- **Admin notificado só em cadastro de garagista**, não de vendedor.

## Escopo

### 1. Infra no remoto (ops)
- Deploy da função `send-email` (`verify_jwt=false` já no `config.toml`, permitindo a
  chamada do trigger via `pg_net` sem JWT).
- Secrets: `RESEND_API_KEY` (do `.env.local`), `EMAIL_TRIGGER_SECRET` (gerado aleatório),
  `RESEND_FROM="REVVIO <no-reply@revvio.com.br>"`.

### 2. `private.email_config` (SQL one-time — não vai pro git, contém segredo)
```sql
insert into private.email_config (function_url, trigger_secret)
values ('https://ahtisetxygjyfvhguckl.supabase.co/functions/v1/send-email',
        '<EMAIL_TRIGGER_SECRET>')
on conflict (id) do update
  set function_url = excluded.function_url,
      trigger_secret = excluded.trigger_secret;
```
`trigger_secret` deve ser **idêntico** ao secret `EMAIL_TRIGGER_SECRET` (o `notify_email`
envia `x-email-secret: trigger_secret` e a função compara com o env).

### 3. Roteamento role-aware + copy (código)
- **Migration `0024_email_role_aware.sql`** (sem segredos, vai pro git):
  `create or replace function private.on_seller_insert()` para disparar
  `seller_registered` + `admin_new_seller` **apenas quando `new.role = 'garagista'`**.
- **`_shared/email-templates.ts`** (redeploy da `send-email`):
  - `seller_registered`: reescrito para pay-first — "Recebemos seu cadastro. Conclua o
    pagamento do plano para liberar seu acesso." + CTA para login/checkout.
  - `seller_approved`: wording de "aprovado pelo administrador" → "pagamento confirmado,
    acesso liberado 🎉". (dispara no webhook quando `pending → active`.)

### 4. Validação
- Chamar `send-email` direto (header `x-email-secret`) com um template real → confirmar
  entrega (200 + id do Resend; sem erro de domínio).
- Cadastro de garagista de teste → confirmar que o trigger dispara e o e-mail chega.

## Fora de escopo (Fase B)
E-mails de autenticação (confirmar e-mail, redefinir senha, convite do vendedor) via SMTP
do Resend no Supabase Auth + templates branded. Notificação de domínio para vendedor.

## Verificação / gate
Sem runner no front; mudanças de código são na função Deno (`email-templates.ts`) e numa
migration SQL. Gate do front (`tsc -b`/build) não cobre Deno → verificação real = deploy +
chamada de teste da `send-email` + cadastro de teste.
