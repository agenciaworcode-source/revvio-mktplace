# Onboarding com criação adiada (conta só após pagamento)

**Data:** 2026-06-22 · **Status:** aprovado (brainstorming)

## Problema

Hoje o cadastro cria o usuário do Auth + o seller **antes** do pagamento. Se o
garagista desiste, sobram órfãos em `auth.users`/`rv_sellers`, e tentar de novo com
o mesmo e-mail dá "já possui cadastro" — bloqueia o re-cadastro.

## Solução (decisões do brainstorming)

- **Criação adiada:** o usuário do Auth e o seller só são criados **após** o webhook
  confirmar o pagamento. Antes disso, os dados ficam numa tabela temporária.
- **Senha por link após pagar:** o campo Senha sai do cadastro. Após o pagamento, o
  e-mail de boas-vindas traz um link "definir senha e acessar".
- **Limpeza:** remover o que vira vestigial — `/checkout`, função `asaas-checkout` e o
  gating `pending → /checkout`. (Sellers `pending` deixam de existir.)

## Fluxo

1. `/vender` → plano → `/cadastro-vendedor?plan&cycle` (form **sem senha**).
2. **Criar conta** → Edge `signup-checkout` (sem JWT): cria cobrança no ASAAS, faz
   upsert em `rv_pending_signups`, retorna `invoiceUrl` → redireciona pro ASAAS.
3. Paga → **webhook**: cria auth user (sem senha) + seller `active` + `rv_charges`,
   gera link de recovery (`/definir-senha`), envia e-mail `garagista_welcome`, consome
   o pending_signup.
4. Garagista clica → `/definir-senha` (define senha) → `/painel`.

Abandonar antes de pagar não cria nada → re-cadastro com o mesmo e-mail funciona.

## Componentes

### Migration `0026_pending_signups.sql`
```sql
create table if not exists public.rv_pending_signups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  phone text, cpf_cnpj text, city text,
  pricing_plan_key text not null,
  plan_cycle text check (plan_cycle in ('monthly','annual')),
  asaas_customer_id text,
  asaas_subscription_id text,
  asaas_payment_id text,
  invoice_url text,
  created_at timestamptz not null default now()
);
alter table public.rv_pending_signups enable row level security;
-- sem policies: anon/authenticated não acessam; só service-role (Edge Functions).
```

### Edge `signup-checkout` (nova, `verify_jwt=false`)
- Input: `{ name, email, phone, cpf_cnpj, city, plan, cycle }`.
- Valida obrigatórios + `cpf_cnpj` + plano existe.
- **Se já existe seller com esse e-mail → 409 "Este e-mail já tem conta. Faça login."**
- Reusa `asaas_customer_id` do pending (se houver) ou `createCustomer`.
- `createSubscription` (value/cycle do tier) + `getSubscriptionFirstPayment` → invoiceUrl.
- Upsert em `rv_pending_signups` por e-mail (dados + asaas ids + invoice_url).
- Retorna `{ invoiceUrl }`.

### Edge `asaas-webhook` (alterada)
Após o upsert da cobrança, em `PAYMENT_CONFIRMED`/`PAYMENT_RECEIVED`, se **não** há
seller para `payment.customer`:
1. Lê `rv_pending_signups` por `asaas_customer_id`. Se não houver, ignora.
2. Idempotência: se já existe seller com o e-mail, não recria.
3. `admin.createUser({ email, email_confirm: true })` (sem senha); se já existe, reusa.
4. Insert em `rv_sellers` (role `garagista`, status `active`, slug único, dados +
   `pricing_plan_key`/`plan_cycle` + asaas ids + `user_id`).
5. Atualiza `rv_charges.seller_id` da cobrança.
6. `generateLink({ type:'recovery', email, redirectTo: APP_URL + '/definir-senha' })`.
7. `send-email garagista_welcome` com `{ name, set_password_url }`.
8. Deleta o `pending_signups`.

O trigger `on_seller_insert` (já role-aware, migration 0025) dispara `admin_new_seller`
aos admins — agora naturalmente **após** o pagamento (o seller só nasce aí).

### E-mail `garagista_welcome` (`_shared/email-templates.ts`)
"Pagamento confirmado 🎉 — sua mini-loja foi criada. Defina sua senha para acessar."
CTA "Definir senha e acessar" → `set_password_url`.

### Frontend `CadastroVendedor`
- Remove o campo **Senha** + zod password + `signUp`/`createSellerProfile`/`confirmEmail`.
- `onSubmit` chama `supabase.functions.invoke("signup-checkout", { body })` → redireciona
  para `data.invoiceUrl`; mostra `data.error` se houver. Mantém o redirect `!plan → /vender`.

### Página nova `/definir-senha` (`DefinirSenha.tsx`)
Consome a sessão de recovery do link (Supabase `detectSessionInUrl`), pede a nova senha
(`auth.updateUser({ password })`) e segue para `/painel`. Sem sessão → erro + link login.
Rota pública em `App.tsx`.

### Limpeza
- Remove `CheckoutPlano.tsx`, a rota `/checkout` e o import lazy.
- Remove a função `asaas-checkout` (dir + entrada no `config.toml` + delete no remoto).
- Gating: `pending → /checkout` volta para `/aguardando-aprovacao` (em `routeGuards` e no
  `RoleRedirect` do `App.tsx`).
- `createSellerProfile.ts` fica sem uso pelo cadastro; remover se não houver outro consumidor.

## Bordas
- E-mail já com conta → 409 no cadastro.
- Webhook idempotente (PAYMENT_CONFIRMED + PAYMENT_RECEIVED não duplicam).
- `pending_signups` sem pagamento fica órfão (inócuo; upsert por e-mail no retry). TTL fora de escopo.

## Fora de escopo
Fase B (SMTP do Resend para os demais e-mails de auth). O link de definir-senha sai pelo
nosso `send-email` (Resend), independente da Fase B.

## Gate
Front: `tsc -b` + `npm run build`. Edge (Deno): deploy + validação sandbox (cadastro de
teste → pagar → conta criada + e-mail com link → definir senha → painel).
