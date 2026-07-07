# Design — Checkout ASAAS self-service (onboarding do garagista)

**Data:** 2026-06-22
**Status:** aprovado (brainstorming) — pronto para plano de implementação

## 1. Contexto e objetivo

A landing pública (`loja.revvio.com.br`) exibe os **planos de comercialização** (`rv_pricing_plans`:
tiers `essencial`/`profissional`/`enterprise`, com `price_monthly`, `price_annual`, `trial_days`,
`vehicle_limit`). Hoje os CTAs apenas levam ao cadastro do garagista (`/cadastro-vendedor`), e o
acesso é liberado por **aprovação manual do admin** (`status pending → active`).

**Objetivo:** transformar isso num fluxo **self-service com pagamento via ASAAS (sandbox)**: o novo
garagista escolhe um tier, se cadastra, paga numa página de checkout, e só **ganha acesso à
plataforma após o pagamento confirmar**. A integração deve ser **implementada e validada no sandbox**.

### Decisões de produto (do brainstorming, 2026-06-22)

- **Pagamento primeiro:** a conta é criada como `pending` (sem acesso); o acesso é liberado
  (`status='active'`) **somente** quando o 1º pagamento confirma no webhook. **Sem aprovação do admin.**
- **Checkout via página hospedada do ASAAS:** o app cria a assinatura e **redireciona** para o link
  de pagamento do ASAAS (PIX/boleto/cartão). Sem PCI, sem formulário de cartão no app.
- **Toggle Mensal/Anual:** a landing tem o toggle; o ciclo escolhido é levado ao cadastro/checkout.
  Anual = assinatura `YEARLY` cobrando **`price_annual × 12`** de uma vez (confirmado: `price_annual`
  é o valor por mês na cobrança anual).
- **Enterprise = "Falar com vendas":** mantém o CTA de contato (WhatsApp/e-mail), **sem** checkout
  self-service.

## 2. Infraestrutura existente (reusada)

- `supabase/functions/_shared/asaas.ts` — client ASAAS: `createCustomer`, `createSubscription`
  (aceita `cycle`), `createPayment`, `cancelSubscription`. Base URL alterna sandbox/produção por
  `ASAAS_ENV`; chave em `ASAAS_API_KEY` (secret).
- `supabase/functions/asaas-billing/index.ts` — **admin-only**, cobra o plano CUSTOM (`rv_plans`).
  Permanece como está; o fluxo self-service NÃO usa essa função.
- `supabase/functions/asaas-webhook/index.ts` — recebe eventos, faz upsert em `rv_charges`, dispara
  e-mails (Resend). Mapeia `payment.customer → rv_sellers.asaas_customer_id`. **Hoje não altera o
  status do seller** (é o que vamos acrescentar).
- `rv_sellers`: já tem `asaas_customer_id` e `pricing_plan_key`. Enum `seller_status` =
  `pending | active | suspended`.
- `rv_charges`: `seller_id, asaas_id, asaas_subscription_id, value, billing_type, status, due_date,
  invoice_url, …`.
- Guard (`src/features/auth/routeGuards.tsx`): `pending → /aguardando-aprovacao`,
  `suspended → /conta-suspensa`, `active → app`.

## 3. Fluxo ponta a ponta

1. **Landing** (`HomeAnunciar` + `HomePlanCard`): toggle **Mensal/Anual**. CTA de tiers self-service
   → `/cadastro-vendedor?plan=<key>&cycle=<monthly|annual>`. Enterprise → contato (WhatsApp/e-mail).
2. **Cadastro** (`CadastroVendedor`): lê `?plan&cycle`, mostra resumo do plano, e ao criar a conta
   grava `pricing_plan_key` + `plan_cycle` no `rv_sellers` (status default `pending`). Redireciona
   para `/checkout`.
3. **`/checkout`** (`CheckoutPlano`, autenticado): mostra plano/preço/ciclo + botão "Pagar com ASAAS"
   → invoca `asaas-checkout` → recebe `{ invoiceUrl }` → `window.location.href = invoiceUrl`.
4. **Webhook**: `PAYMENT_CONFIRMED`/`PAYMENT_RECEIVED` → `rv_sellers.status='active'`.
5. **Guard**: `pending → /checkout` (substitui `/aguardando-aprovacao`); `active → painel`.

## 4. Componentes

### 4.1 Edge Function nova `supabase/functions/asaas-checkout/index.ts`

- **Auth:** o próprio usuário logado (header `Authorization`). Resolve o seller via
  `rv_sellers.user_id = auth.uid()` (cliente service-role lê após validar o JWT).
- **Input:** `{ }` (lê `pricing_plan_key` + `plan_cycle` do seller). Opcionalmente aceita `cycle`
  para sobrescrever.
- **Passos:**
  1. Carrega o seller (id, name, email, phone/whatsapp, cpf_cnpj, asaas_customer_id, status,
     pricing_plan_key, plan_cycle, asaas_subscription_id).
  2. Valida: precisa de `cpf_cnpj` (ASAAS exige) e `pricing_plan_key`. Sem isso → 400 com mensagem.
  3. Se `status='active'` → 200 `{ alreadyActive: true }` (nada a cobrar).
  4. Garante `asaas_customer_id` (cria customer com `cpfCnpj` só dígitos; persiste no seller).
  5. Carrega o tier de `rv_pricing_plans` pela `pricing_plan_key`.
  6. Calcula `value`/`cycle`: `monthly` → `value=price_monthly`, `cycle='MONTHLY'`;
     `annual` → `value=price_annual*12`, `cycle='YEARLY'`.
  7. Se `asaas_subscription_id` já existe, reusa; senão `createSubscription({customer, billingType:
     'UNDEFINED', value, cycle, nextDueDate: hoje, description})` e persiste `asaas_subscription_id`
     no seller. (`billingType: 'UNDEFINED'` deixa o cliente escolher PIX/boleto/cartão na página.)
  8. `getSubscriptionFirstPayment(subId)` → pega o 1º payment; faz upsert em `rv_charges`
     (asaas_id, asaas_subscription_id, value, status, due_date, invoice_url).
  9. Retorna `{ invoiceUrl }` (o `payment.invoiceUrl`).
- **Erros:** repassa mensagem amigável do ASAAS; CORS como nas demais.

### 4.2 `_shared/asaas.ts` (adições)

- `getSubscriptionPayments(subId): Promise<AsaasPayment[]>` → `GET /subscriptions/{id}/payments`
  (retorna `.data`).
- Helper `getSubscriptionFirstPayment(subId)` → primeiro item (menor `dueDate`).
- `AsaasPayment` já tem `invoiceUrl`.

### 4.3 `asaas-webhook` (adição de ativação)

- Após o upsert em `rv_charges`, se `body.event ∈ {PAYMENT_CONFIRMED, PAYMENT_RECEIVED}` e há
  `seller`, executar `db.from('rv_sellers').update({ status: 'active' }).eq('id', seller.id)`
  (somente se ainda não estiver `active`). Mantém o envio de e-mail existente.

### 4.4 Frontend

- **`HomeAnunciar`** (`src/features/public/components/home/HomeAnunciar.tsx`): estado
  `cycle: 'monthly'|'annual'` + toggle; passa `cycle` para cada `HomePlanCard`.
- **`HomePlanCard`** (`src/features/public/components/home/HomePlanCard.tsx`): mostra o preço do
  ciclo selecionado; CTA vira `<Link>`:
  - tiers self-service → `/cadastro-vendedor?plan=${key}&cycle=${cycle}`;
  - `enterprise` (ou `cta_label` "Falar com vendas") → link de contato (WhatsApp via
    `whatsappLink`/e-mail), `target` externo, sem ir ao cadastro.
- **`CadastroVendedor`**: lê `plan`/`cycle` de `useSearchParams`; mostra um resumo do plano
  escolhido (nome + preço + ciclo) acima do form; passa `pricing_plan_key` + `plan_cycle` ao
  `createSellerProfile`; ao concluir, `navigate('/checkout')` (em vez de `/aguardando-aprovacao`).
  Sem `?plan`, o cadastro funciona como hoje (sem plano → cai no `/checkout` que pede escolher um
  plano — ver 4.5).
- **`createSellerProfile`** (`src/features/auth/createSellerProfile.ts`): aceita
  `pricing_plan_key?` e `plan_cycle?` e os inclui no insert.
- **`CheckoutPlano`** nova página (`src/features/auth/pages/CheckoutPlano.tsx`, rota `/checkout`,
  protegida por `ProtectedRoute`): carrega o seller + o tier; se `status==='active'` → redireciona
  ao painel; se sem `pricing_plan_key` → mostra os planos para escolher (link de volta à landing);
  senão mostra resumo + botão "Pagar com ASAAS" que invoca `asaas-checkout` via
  `supabase.functions.invoke` e redireciona para `invoiceUrl`. Estado de "pagamento pendente" com
  botão "Já paguei / atualizar" que refaz `refreshSeller()`.
- **`routeGuards`**: `pending` passa a `Navigate to="/checkout"`. (`/aguardando-aprovacao` deixa de
  ser usado pelo fluxo; rota mantida para não quebrar links, mas sem entrada.)
- **`App.tsx`**: registra a rota `/checkout`.

### 4.5 Bordas de UX

- Cadastro sem `?plan` (acesso direto a `/cadastro-vendedor`): cria o seller sem `pricing_plan_key`;
  no `/checkout` mostra "Escolha um plano" com link para a seção de planos.
- Confirmação de e-mail do Supabase ligada: o usuário confirma → loga → o guard manda `pending` para
  `/checkout`. O fluxo funciona com ou sem confirmação de e-mail.

## 5. Banco de dados (1 migration `0022_selfservice_checkout.sql`)

```sql
alter table public.rv_sellers
  add column if not exists plan_cycle text check (plan_cycle in ('monthly','annual')),
  add column if not exists asaas_subscription_id text;
```

- `pricing_plan_key` e `asaas_customer_id` já existem (migrations 0009 e 0006).
- RLS: o `INSERT` self do usuário pode gravar `pricing_plan_key`/`plan_cycle` (o trigger
  `protect_seller_columns` protege apenas `role`/`status`/`parent_id`/`commission_rate`). `status` e
  `asaas_subscription_id` são gravados via **service-role** (Edge Functions/webhook), nunca pelo
  usuário. Confirmar que nenhuma policy de UPDATE permite o usuário mudar `status` (já é o caso).

## 6. Config / secrets (pré-requisito da validação)

As Edge Functions rodam no Supabase **remoto** (`ahtisetxygjyfvhguckl`). Necessário:

1. Deploy das functions alteradas/nova: `supabase functions deploy asaas-checkout asaas-webhook`.
2. Secrets: `supabase secrets set ASAAS_API_KEY=<sandbox> ASAAS_ENV=sandbox
   ASAAS_WEBHOOK_TOKEN=<token>` (valores já presentes no `.env.local`).
3. No painel **sandbox** do ASAAS, configurar o webhook apontando para
   `https://ahtisetxygjyfvhguckl.supabase.co/functions/v1/asaas-webhook` com o header
   `asaas-access-token: <ASAAS_WEBHOOK_TOKEN>` e os eventos de pagamento habilitados.

## 7. Erros e estados

- Sem CPF/CNPJ → checkout bloqueado com mensagem (o cadastro já coleta CPF/CNPJ com máscara).
- Falha ASAAS (criar customer/assinatura) → mensagem amigável no `/checkout` + botão "tentar de novo"
  (sem duplicar: reusa `asaas_customer_id`/`asaas_subscription_id` já persistidos).
- Webhook idempotente: upsert por `asaas_id`; ativação só promove `pending → active` (no-op se já ativo).
- Pagamento pendente (boleto não pago) → seller continua `pending`; `/checkout` mostra estado
  "aguardando confirmação" com botão de atualizar.

## 8. Testes / verificação

Sem runner unitário no front → gate = **`tsc -b` + `npm run build`**. Edge Functions (Deno) verificadas
por deploy + validação funcional. Helpers puros (cálculo de `value`/`cycle`, leitura de query params)
isolados e checáveis por inspeção. **Validação sandbox (entregável final):**

1. Setar secrets + deploy das functions + configurar webhook no sandbox.
2. Na landing, escolher Profissional (Anual), CTA → cadastro com `?plan=profissional&cycle=annual`.
3. Criar conta de teste → grava `pricing_plan_key='profissional'`, `plan_cycle='annual'`, `pending`.
4. `/checkout` → "Pagar com ASAAS" → redireciona para a página do ASAAS; valor = 2.844,00.
5. Confirmar o pagamento no sandbox do ASAAS (ou simular o evento) → webhook ativa o seller.
6. Recarregar → `status='active'` → acesso ao painel liberado; `rv_charges` com o pagamento.

## 9. Fora do escopo (agora)

- Suspensão automática por inadimplência (`PAYMENT_OVERDUE → suspended`).
- Período de teste (trial) com acesso antes do pagamento.
- Troca/upgrade/cancelamento de plano pelo painel do garagista.
- Cartão tokenizado dentro do app (usamos a página hospedada do ASAAS).
- Checkout/cobrança do tier Enterprise (é "falar com vendas").
- Aprovação manual do admin (removida do fluxo self-service).
