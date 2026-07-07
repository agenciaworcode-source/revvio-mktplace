# REVVIO 2.0 — Marketplace Multi-Vendedores

Marketplace de intermediação de veículos: cada vendedor tem mini-loja pública,
painel próprio e controle financeiro por comissão. Admin governa a plataforma.

## Stack

React 18 · Vite · TypeScript · React Router · TanStack Query · React Hook Form + Zod
· **Supabase** (Postgres + Auth + Storage + Realtime + Edge Functions) · Tailwind.

Arquitetura **Supabase-first**: o frontend fala direto com o Supabase via SDK;
o isolamento de dados é garantido por **RLS por `seller_id`** e a lógica sensível
(cálculo de comissão) vive em RPC Postgres `SECURITY DEFINER`.

## Setup local

```bash
# 1. dependências
npm install

# 2. variáveis de ambiente
cp .env.example .env.local   # preencha URL + anon key do projeto Supabase

# 3. banco — com a CLI do Supabase
supabase start              # sobe Postgres/Studio locais
supabase db reset           # aplica migrations + seed.sql

# (ou aplique supabase/migrations/*.sql na ordem, num projeto cloud)

# 4. tipos do banco (substitui o stub)
npm run types:gen

# 5. app
npm run dev                 # http://localhost:5173
```

## Estrutura

```
src/
  features/auth/      AuthProvider + route guards (ProtectedRoute, RoleRoute)
  components/         UI compartilhada
  lib/                cliente supabase + tipos do banco
supabase/
  migrations/
    0001_schema.sql        enums + tabelas (rv_sellers, rv_vehicles, rv_sales, rv_commissions)
    0002_functions.sql     current_seller(), is_admin(), triggers de proteção
    0003_rls.sql           policies de isolamento por seller_id + bypass admin
    0004_register_sale.sql RPC que cria venda + comissão atomicamente
    0005_storage.sql       buckets de mídia + policies por pasta
    0006_plans_asaas.sql   planos personalizados (rv_plans/rv_plan_items) + cobranças (rv_charges)
    0007_email_triggers.sql triggers (pg_net) que disparam e-mails transacionais
  functions/
    asaas-billing/         Edge Function (admin): cria cliente + assinatura/cobrança no ASAAS
    asaas-webhook/         Edge Function: eventos do ASAAS → rv_charges + e-mails (Resend)
    send-email/            Edge Function: renderiza template e envia via Resend
    _shared/               clientes ASAAS/Resend, templates de e-mail, helpers CORS
  seed.sql                 promove um usuário a admin
```

> E-mails transacionais: ver `docs/emails-transacionais.md` (catálogo + setup do Resend).

## Integração ASAAS (Fase 5)

O gestor monta um **plano de comercialização por garagista** (itens livres: opção +
valor + recorrência). Itens `mensal` viram **assinatura**; `taxa_unica` vira **cobrança
avulsa**. A plataforma cobra o vendedor via ASAAS.

Deploy + segredos (a API key NUNCA vai ao frontend):

```bash
supabase functions deploy asaas-billing asaas-webhook

supabase secrets set ASAAS_API_KEY=<sua-chave-sandbox>
supabase secrets set ASAAS_ENV=sandbox            # ou production
supabase secrets set ASAAS_WEBHOOK_TOKEN=<token>  # opcional, valida o webhook
```

No painel do ASAAS, aponte o webhook de cobranças para
`https://<project>.functions.supabase.co/asaas-webhook` (header `asaas-access-token`
= o token acima). `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` já
são injetados no runtime das functions.

## Roadmap (fases)

- [x] **Fase 0** — Fundação (Vite + React + Supabase client + roteamento)
- [x] **Fase 1** — Schema, RLS, RPC de comissão, storage
- [x] **Fase 2** — Auth: cadastro de vendedor, login, telas de status, redirect por papel
- [x] **Fase 3** — Painel do Vendedor (dashboard, veículos+upload, vendas, financeiro, perfil)
- [x] **Fase 4** — Marketplace público + Mini-Loja `/loja/:slug` (badge do vendedor + WhatsApp)
- [x] **Fase 5** — Admin (gestão de vendedores, planos personalizados + cobrança ASAAS, financeiro global)
- [x] **Fase 6** — QA, isolamento e go-live (checklists + teste de RLS + ErrorBoundary)

## Modelo de dados (resumo)

- **Prefixo `rv_`**: todas as tabelas do domínio usam o prefixo `rv_`
  (`rv_sellers`, `rv_vehicles`, `rv_sales`, `rv_commissions`).
- **Owner ≠ Seller**: `rv_vehicles.owner_name/owner_phone` = dono original do carro;
  `seller_id` = vendedor intermediário na plataforma. Coexistem.
- **Comissão**: `register_sale()` calcula `sale_price * seller.commission_rate / 100`
  no banco — o cliente nunca informa o `rate`.
- **Isolamento**: catálogo de veículos é público; `rv_sales` e `rv_commissions` são
  privados (só o dono + admin), via RLS.
