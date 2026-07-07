# Checkout ASAAS Self-Service — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Onboarding self-service do garagista: escolher plano na landing → cadastrar → pagar na página hospedada do ASAAS → acesso liberado quando o pagamento confirma.

**Architecture:** Front (React/TS) carrega o plano+ciclo da landing até um `/checkout` que invoca uma Edge Function nova `asaas-checkout` (cria customer+assinatura no ASAAS e devolve `invoiceUrl`); o `asaas-webhook` ativa o seller (`status='active'`) ao confirmar o pagamento. Gating: `pending → /checkout`.

**Tech Stack:** React + react-router + react-hook-form, @tanstack/react-query, Supabase (Postgres + Edge Functions Deno), ASAAS API (sandbox), Tailwind/ui-light.

## Global Constraints

- Sem runner unitário no front → gate de cada task de front = **`npx tsc -b` + `npm run build`** verdes.
- Edge Functions são Deno; gate best-effort = `deno check <arquivo>` (se `deno` instalado); verificação real = deploy + validação sandbox (Task 7).
- Fonte ASAAS sandbox: `https://sandbox.asaas.com/api/v3` (via `ASAAS_ENV=sandbox`); chave só nas Edge Functions (`ASAAS_API_KEY`), nunca no front.
- **Pagamento primeiro:** conta nasce `pending` (sem acesso); só vira `active` no webhook (`PAYMENT_CONFIRMED`/`PAYMENT_RECEIVED`). Sem aprovação do admin.
- **Anual = `price_annual × 12`**, assinatura `cycle='YEARLY'`; mensal = `price_monthly`, `cycle='MONTHLY'`.
- `billingType: "UNDEFINED"` na assinatura (cliente escolhe PIX/boleto/cartão na página do ASAAS).
- Enum `seller_status` = `pending | active | suspended`. `FuelType`/tipos vêm de `@/lib/database.types` / `database.generated.ts`.
- Validar sempre contra o **Supabase remoto** (`ahtisetxygjyfvhguckl`); `SUPABASE_DB_URL` no `.env.local`.
- Enterprise NÃO entra no checkout (CTA "Falar com vendas" → contato).

---

### Task 1: Migration + tipos (colunas `plan_cycle` e `asaas_subscription_id`)

**Files:**
- Create: `supabase/migrations/0022_selfservice_checkout.sql`
- Modify (gerado): `src/lib/database.generated.ts`

**Interfaces:**
- Produces (no banco/tipos): `rv_sellers.plan_cycle: 'monthly'|'annual'|null`, `rv_sellers.asaas_subscription_id: string|null`.

- [ ] **Step 1: Criar a migration**

`supabase/migrations/0022_selfservice_checkout.sql`:
```sql
-- ============================================================
-- Checkout ASAAS self-service: ciclo do plano + assinatura no seller
-- ============================================================
alter table public.rv_sellers
  add column if not exists plan_cycle text
    check (plan_cycle in ('monthly','annual')),
  add column if not exists asaas_subscription_id text;
```

- [ ] **Step 2: Aplicar no remoto**

Tentar primeiro o método padrão do projeto:
```bash
supabase db push
```
Se o histórico de migrations divergir (erro de migrations remotas), aplicar só este DDL idempotente direto na conexão (usa `SUPABASE_DB_URL` do `.env.local`):
```bash
export $(grep '^SUPABASE_DB_URL=' .env.local | sed 's/^/X/;s/^X//') >/dev/null 2>&1
psql "$SUPABASE_DB_URL" -f supabase/migrations/0022_selfservice_checkout.sql
```
(Se `psql` não existir: `sudo apt-get install -y postgresql-client`.)
Expected: `ALTER TABLE` sem erro (idempotente — reexecução não quebra).

- [ ] **Step 3: Regenerar os tipos do remoto**

```bash
DBURL=$(grep '^SUPABASE_DB_URL=' .env.local | cut -d= -f2- | tr -d '"')
supabase gen types typescript --db-url "$DBURL" > src/lib/database.generated.ts
```
Expected: arquivo regenerado contendo `plan_cycle` e `asaas_subscription_id` em `rv_sellers`.

- [ ] **Step 4: Conferir colunas nos tipos + gate**

Run: `grep -n "plan_cycle\|asaas_subscription_id" src/lib/database.generated.ts | head` → deve listar as duas colunas.
Run: `npx tsc -b` → exit 0.

- [ ] **Step 5: Commit**
```bash
git add supabase/migrations/0022_selfservice_checkout.sql src/lib/database.generated.ts
git commit -m "feat(db): plan_cycle e asaas_subscription_id em rv_sellers (checkout self-service)"
```

---

### Task 2: Client ASAAS (1º pagamento da assinatura) + Edge Function `asaas-checkout`

**Files:**
- Modify: `supabase/functions/_shared/asaas.ts`
- Create: `supabase/functions/asaas-checkout/index.ts`

**Interfaces:**
- Produces: `getSubscriptionFirstPayment(subId: string): Promise<AsaasPayment | null>`; Edge Function `asaas-checkout` que aceita `{ cycle?: 'monthly'|'annual' }` e retorna `{ invoiceUrl: string } | { alreadyActive: true } | { error: string }`.
- Consumes: `createCustomer`, `createSubscription` (já existem em `_shared/asaas.ts`).

- [ ] **Step 1: Adicionar helpers no `_shared/asaas.ts`**

Acrescentar ao final de `supabase/functions/_shared/asaas.ts`:
```ts
export async function getSubscriptionPayments(subId: string): Promise<AsaasPayment[]> {
  const res = await asaasFetch<{ data: AsaasPayment[] }>(`/subscriptions/${subId}/payments`);
  return res.data ?? [];
}

/** Primeiro pagamento da assinatura (menor dueDate) — para pegar o invoiceUrl. */
export async function getSubscriptionFirstPayment(
  subId: string
): Promise<AsaasPayment | null> {
  const payments = await getSubscriptionPayments(subId);
  if (!payments.length) return null;
  return payments
    .slice()
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))[0];
}
```

- [ ] **Step 2: Criar a Edge Function**

`supabase/functions/asaas-checkout/index.ts`:
```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import {
  createCustomer,
  createSubscription,
  getSubscriptionFirstPayment,
} from "../_shared/asaas.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    // autoriza: o PRÓPRIO usuário logado
    const authHeader = req.headers.get("Authorization") ?? "";
    const asUser = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: uErr } = await asUser.auth.getUser();
    if (uErr || !userData.user) return json({ error: "Não autenticado." }, 401);

    const db = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: seller, error: sErr } = await db
      .from("rv_sellers")
      .select(
        "id, name, email, phone, whatsapp, cpf_cnpj, status, asaas_customer_id, asaas_subscription_id, pricing_plan_key, plan_cycle"
      )
      .eq("user_id", userData.user.id)
      .single();
    if (sErr) throw sErr;

    if (seller.status === "active") return json({ alreadyActive: true });

    const body = await req.json().catch(() => ({}));
    const cycle = (body.cycle ?? seller.plan_cycle ?? "monthly") as "monthly" | "annual";

    if (!seller.pricing_plan_key) return json({ error: "Nenhum plano selecionado." }, 400);
    if (!seller.cpf_cnpj) return json({ error: "Informe seu CPF/CNPJ para continuar." }, 400);

    const { data: plan, error: pErr } = await db
      .from("rv_pricing_plans")
      .select("key, name, price_monthly, price_annual")
      .eq("key", seller.pricing_plan_key)
      .single();
    if (pErr) throw pErr;

    // 1. garante o cliente no ASAAS
    let customerId = seller.asaas_customer_id as string | null;
    if (!customerId) {
      const customer = await createCustomer({
        name: seller.name,
        cpfCnpj: String(seller.cpf_cnpj).replace(/\D/g, ""),
        email: seller.email,
        mobilePhone: (seller.whatsapp ?? seller.phone)?.replace(/\D/g, "") || null,
      });
      customerId = customer.id;
      await db.from("rv_sellers").update({ asaas_customer_id: customerId }).eq("id", seller.id);
    }

    // 2. garante a assinatura do tier
    let subId = seller.asaas_subscription_id as string | null;
    if (!subId) {
      const value =
        cycle === "annual" ? Number(plan.price_annual) * 12 : Number(plan.price_monthly);
      const sub = await createSubscription({
        customer: customerId!,
        billingType: "UNDEFINED",
        value,
        nextDueDate: today(),
        cycle: cycle === "annual" ? "YEARLY" : "MONTHLY",
        description: `Plano ${plan.name} (${cycle === "annual" ? "anual" : "mensal"}) — Revvio`,
      });
      subId = sub.id;
      await db
        .from("rv_sellers")
        .update({ asaas_subscription_id: subId, plan_cycle: cycle })
        .eq("id", seller.id);
    }

    // 3. pega o 1º pagamento (invoiceUrl) e registra em rv_charges
    const payment = await getSubscriptionFirstPayment(subId!);
    if (!payment) return json({ error: "Cobrança ainda não disponível. Tente novamente." }, 502);

    const charge = {
      seller_id: seller.id,
      asaas_id: payment.id,
      asaas_subscription_id: subId,
      description: `Plano ${plan.name}`,
      value: payment.value,
      billing_type: payment.billingType ?? null,
      status: payment.status,
      due_date: payment.dueDate ?? null,
      invoice_url: payment.invoiceUrl ?? null,
    };
    const { data: existing } = await db
      .from("rv_charges")
      .select("id")
      .eq("asaas_id", payment.id)
      .maybeSingle();
    if (existing) await db.from("rv_charges").update(charge).eq("id", existing.id);
    else await db.from("rv_charges").insert(charge);

    return json({ invoiceUrl: payment.invoiceUrl });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erro interno." }, 500);
  }
});
```

- [ ] **Step 3: Checagem de sintaxe (best-effort)**

Run: `deno check supabase/functions/asaas-checkout/index.ts` (se `deno` instalado).
Expected: sem erros. Se `deno` não existir, anotar e prosseguir — o deploy na Task 7 é a verificação real.

- [ ] **Step 4: Commit**
```bash
git add supabase/functions/_shared/asaas.ts supabase/functions/asaas-checkout/index.ts
git commit -m "feat(asaas): edge function asaas-checkout (assinatura do tier + invoiceUrl)"
```

---

### Task 3: Webhook ativa o seller ao confirmar pagamento

**Files:**
- Modify: `supabase/functions/asaas-webhook/index.ts`

**Interfaces:**
- Consumes: o `seller` já resolvido por `asaas_customer_id` e o `body.event` (já existentes na função).

- [ ] **Step 1: Ativar o seller após o upsert da cobrança**

Em `supabase/functions/asaas-webhook/index.ts`, logo após o bloco que faz `update/insert` em `rv_charges` (antes do envio de e-mail), inserir:
```ts
    // pagamento confirmado → libera o acesso do garagista (pay-first)
    if (
      seller &&
      (body.event === "PAYMENT_CONFIRMED" || body.event === "PAYMENT_RECEIVED")
    ) {
      await db
        .from("rv_sellers")
        .update({ status: "active" })
        .eq("id", seller.id)
        .neq("status", "active");
    }
```

- [ ] **Step 2: Checagem de sintaxe (best-effort)**

Run: `deno check supabase/functions/asaas-webhook/index.ts` (se `deno` instalado). Expected: sem erros.

- [ ] **Step 3: Commit**
```bash
git add supabase/functions/asaas-webhook/index.ts
git commit -m "feat(asaas): webhook ativa o garagista ao confirmar o pagamento"
```

---

### Task 4: `createSellerProfile` + `CadastroVendedor` carregam plano/ciclo

**Files:**
- Modify: `src/features/auth/createSellerProfile.ts`
- Modify: `src/features/auth/pages/CadastroVendedor.tsx`

**Interfaces:**
- Consumes: tipos regenerados (Task 1) com `pricing_plan_key`/`plan_cycle`.
- Produces: cadastro grava `pricing_plan_key` + `plan_cycle` e navega para `/checkout` (Task 5).

- [ ] **Step 1: Estender `createSellerProfile`**

Em `src/features/auth/createSellerProfile.ts`, adicionar os campos ao input e ao insert.

No `interface SellerProfileInput`, adicionar:
```ts
  pricing_plan_key?: string | null;
  plan_cycle?: "monthly" | "annual" | null;
```
No `.insert({ ... })`, adicionar as duas linhas:
```ts
      pricing_plan_key: input.pricing_plan_key ?? null,
      plan_cycle: input.plan_cycle ?? null,
```

- [ ] **Step 2: `CadastroVendedor` lê os query params, mostra resumo e navega ao checkout**

Em `src/features/auth/pages/CadastroVendedor.tsx`:

(a) Imports — trocar a linha do react-router e adicionar a query de planos:
```tsx
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { usePricingPlans } from "@/features/public/queries";
```

(b) Dentro do componente, após `const navigate = useNavigate();`:
```tsx
  const [params] = useSearchParams();
  const planKey = params.get("plan");
  const cycle = (params.get("cycle") === "annual" ? "annual" : "monthly") as
    | "monthly"
    | "annual";
  const { data: plans = [] } = usePricingPlans();
  const selectedPlan = plans.find((p) => p.key === planKey) ?? null;
```

(c) Passar plano/ciclo nos DOIS pontos que criam o perfil. No bloco `createSellerProfile({ ... })` adicionar:
```tsx
        pricing_plan_key: planKey,
        plan_cycle: planKey ? cycle : null,
```

(d) Trocar o destino final: substituir
```tsx
    await refreshSeller();
    navigate("/aguardando-aprovacao", { replace: true });
```
por
```tsx
    await refreshSeller();
    navigate("/checkout", { replace: true });
```

(e) Mostrar o resumo do plano escolhido acima do form. Logo após a abertura do `<form ...>` e do bloco `{formError && (...)}`, inserir:
```tsx
        {selectedPlan && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Plano <strong>{selectedPlan.name}</strong> —{" "}
            <strong>
              R${" "}
              {cycle === "annual"
                ? selectedPlan.price_annual * 12
                : selectedPlan.price_monthly}
            </strong>{" "}
            {cycle === "annual" ? "/ano" : "/mês"}. Após criar a conta você vai para o pagamento.
          </div>
        )}
```

- [ ] **Step 3: Gate**

Run: `npx tsc -b && npm run build` → exit 0.

- [ ] **Step 4: Commit**
```bash
git add src/features/auth/createSellerProfile.ts src/features/auth/pages/CadastroVendedor.tsx
git commit -m "feat(cadastro): carrega plano/ciclo escolhido e segue para o checkout"
```

---

### Task 5: Página `/checkout` + rota + gating `pending → /checkout`

**Files:**
- Create: `src/features/auth/pages/CheckoutPlano.tsx`
- Modify: `src/App.tsx`
- Modify: `src/features/auth/routeGuards.tsx`

**Interfaces:**
- Consumes: Edge Function `asaas-checkout` (`{ invoiceUrl } | { alreadyActive } | { error }`); `useAuth().seller` com `status`, `pricing_plan_key`, `plan_cycle`; `usePricingPlans()`.

- [ ] **Step 1: Criar a página `CheckoutPlano`**

`src/features/auth/pages/CheckoutPlano.tsx`:
```tsx
import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "../AuthProvider";
import { AuthSplitLayout } from "../AuthSplitLayout";
import { usePricingPlans } from "@/features/public/queries";

export function CheckoutPlano() {
  const { seller, refreshSeller } = useAuth();
  const { data: plans = [] } = usePricingPlans();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (seller && seller.status === "active") return <Navigate to="/painel" replace />;

  const plan = plans.find((p) => p.key === seller?.pricing_plan_key) ?? null;
  const cycle = (seller?.plan_cycle === "annual" ? "annual" : "monthly") as
    | "monthly"
    | "annual";
  const price = plan
    ? cycle === "annual"
      ? plan.price_annual * 12
      : plan.price_monthly
    : 0;

  async function pay() {
    setLoading(true);
    setError(null);
    const { data, error: invokeErr } = await supabase.functions.invoke("asaas-checkout", {
      body: {},
    });
    setLoading(false);
    if (invokeErr || data?.error) {
      setError(data?.error ?? invokeErr?.message ?? "Não foi possível iniciar o pagamento.");
      return;
    }
    if (data?.invoiceUrl) {
      window.location.href = data.invoiceUrl as string;
      return;
    }
    if (data?.alreadyActive) await refreshSeller();
  }

  return (
    <AuthSplitLayout
      title="Pagamento do plano"
      subtitle="Conclua o pagamento para liberar o acesso à plataforma."
      footer={
        <Link to="/" className="font-semibold text-brand hover:underline">
          Voltar ao início
        </Link>
      }
    >
      <div className="flex flex-col gap-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!plan ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Você ainda não escolheu um plano.{" "}
            <Link to="/vender" className="font-semibold underline">
              Ver planos
            </Link>
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-[#e3e5e9] bg-[#fbfbfc] px-4 py-4">
              <p className="text-sm text-slate-500">Plano escolhido</p>
              <p className="mt-0.5 text-lg font-bold text-slate-900">{plan.name}</p>
              <p className="mt-1 text-2xl font-extrabold text-brand">
                R$ {price}{" "}
                <span className="text-sm font-medium text-slate-500">
                  {cycle === "annual" ? "/ano" : "/mês"}
                </span>
              </p>
            </div>

            <button
              type="button"
              onClick={pay}
              disabled={loading}
              className="inline-flex items-center justify-center rounded-xl bg-brand py-3 text-sm font-bold text-white transition-colors hover:bg-brand-dark disabled:opacity-50"
            >
              {loading ? "Gerando cobrança…" : "Pagar com ASAAS"}
            </button>

            <button
              type="button"
              onClick={() => refreshSeller()}
              className="text-xs font-medium text-slate-500 hover:underline"
            >
              Já paguei — atualizar status
            </button>
          </>
        )}
      </div>
    </AuthSplitLayout>
  );
}
```

- [ ] **Step 2: Registrar a rota em `App.tsx`**

(a) Adicionar o import junto aos outros `lazy`/imports de páginas auth (seguir o padrão existente; ex.: junto de `CadastroVendedor`):
```tsx
import { CheckoutPlano } from "@/features/auth/pages/CheckoutPlano";
```
(Se as páginas auth são `lazy`, usar o mesmo padrão `lazy(() => import(...).then(...))` dos vizinhos.)

(b) Adicionar a rota protegida logo após a rota `/cadastro-vendedor`:
```tsx
        <Route
          path="/checkout"
          element={
            <ProtectedRoute>
              <CheckoutPlano />
            </ProtectedRoute>
          }
        />
```
(Importar `ProtectedRoute` de `@/features/auth/routeGuards` se ainda não estiver importado em `App.tsx`.)

(c) No `RoleRedirect` do `App.tsx`, trocar:
```tsx
  if (seller.status === "pending")
    return <Navigate to="/aguardando-aprovacao" replace />;
```
por:
```tsx
  if (seller.status === "pending")
    return <Navigate to="/checkout" replace />;
```

- [ ] **Step 3: Gating em `routeGuards.tsx`**

Em `src/features/auth/routeGuards.tsx`, no `RoleRoute`, trocar:
```tsx
  if (seller.status === "pending")
    return <Navigate to="/aguardando-aprovacao" replace />;
```
por:
```tsx
  if (seller.status === "pending")
    return <Navigate to="/checkout" replace />;
```

- [ ] **Step 4: Gate**

Run: `npx tsc -b && npm run build` → exit 0.

- [ ] **Step 5: Commit**
```bash
git add src/features/auth/pages/CheckoutPlano.tsx src/App.tsx src/features/auth/routeGuards.tsx
git commit -m "feat(checkout): página /checkout + gating pending->/checkout"
```

---

### Task 6: CTAs da landing carregam plano + ciclo (home e /vender)

**Files:**
- Modify: `src/features/public/components/home/HomeAnunciar.tsx`
- Modify: `src/features/public/components/home/HomePlanCard.tsx`
- Modify: `src/features/public/pages/Vender.tsx`

**Interfaces:**
- Consumes: `PricingPlan` (já existe); `cta_label`/`key` para detectar Enterprise.
- Produces: links `to="/cadastro-vendedor?plan=<key>&cycle=<monthly|annual>"`; Enterprise → contato.

- [ ] **Step 1: Toggle Mensal/Anual no `HomeAnunciar` e repasse ao card**

Em `src/features/public/components/home/HomeAnunciar.tsx`:

(a) Imports + estado: trocar `import { Spinner } from "@/components/ui-light";` por:
```tsx
import { useState } from "react";
import { Spinner } from "@/components/ui-light";
```
e no início do componente:
```tsx
  const [cycle, setCycle] = useState<"monthly" | "annual">("monthly");
```

(b) Adicionar o toggle logo abaixo do `<p>` da descrição (antes do bloco `{isLoading ...}`):
```tsx
        <div className="mt-6 inline-flex rounded-full border border-slate-200 bg-white p-1 text-sm font-semibold">
          <button
            type="button"
            onClick={() => setCycle("monthly")}
            className={`rounded-full px-4 py-1.5 ${cycle === "monthly" ? "bg-brand text-white" : "text-slate-600"}`}
          >
            Mensal
          </button>
          <button
            type="button"
            onClick={() => setCycle("annual")}
            className={`rounded-full px-4 py-1.5 ${cycle === "annual" ? "bg-brand text-white" : "text-slate-600"}`}
          >
            Anual
          </button>
        </div>
```

(c) Passar `cycle` ao card: trocar `<HomePlanCard key={p.key} p={p} />` por `<HomePlanCard key={p.key} p={p} cycle={cycle} />`.

- [ ] **Step 2: `HomePlanCard` usa o ciclo, mostra o preço certo e linka com plano+ciclo**

Reescrever `src/features/public/components/home/HomePlanCard.tsx`:
```tsx
import { Link } from "react-router-dom";
import type { PricingPlan } from "../../queries";
import { Icon } from "../icons";

const CONTATO_ENTERPRISE =
  "mailto:contato@revvio.com.br?subject=" +
  encodeURIComponent("Interesse no plano Enterprise — Revvio");

function isEnterprise(p: PricingPlan): boolean {
  return p.key === "enterprise" || /falar com vendas/i.test(p.cta_label);
}

export function HomePlanCard({
  p,
  cycle,
}: {
  p: PricingPlan;
  cycle: "monthly" | "annual";
}) {
  const price = cycle === "annual" ? p.price_annual : p.price_monthly;
  const enterprise = isEnterprise(p);
  const to = `/cadastro-vendedor?plan=${p.key}&cycle=${cycle}`;

  return (
    <div
      className="relative flex flex-col rounded-[18px] bg-white px-7 py-7"
      style={{
        border: p.popular ? "2px solid #10b981" : "1px solid #e7e9ee",
        boxShadow: p.popular
          ? "0 20px 50px rgba(16,185,129,.16)"
          : "0 2px 8px rgba(16,24,40,.05)",
      }}
    >
      {p.popular && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand px-3.5 py-[5px] text-[11.5px] font-extrabold tracking-wide text-white">
          MAIS ESCOLHIDO
        </span>
      )}
      <div className="text-[17px] font-extrabold" style={{ color: p.color }}>
        {p.name}
      </div>
      <div className="mt-1 min-h-[38px] text-[13.5px] text-slate-400">{p.tagline}</div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-base font-bold text-slate-950">R$</span>
        <span className="text-[40px] font-extrabold leading-none tracking-[-2px] text-slate-950">
          {price}
        </span>
        <span className="text-sm text-slate-400">/mês</span>
      </div>
      {cycle === "annual" && (
        <div className="mt-1 text-[12px] font-semibold text-brand">
          Cobrado anualmente (R$ {p.price_annual * 12}/ano)
        </div>
      )}
      <ul className="mt-5 flex flex-1 flex-col gap-2.5">
        {p.highlights.map((h) => (
          <li key={h} className="flex items-start gap-2 text-[13.5px] text-slate-600">
            <Icon name="check" size={16} className="mt-0.5 shrink-0 text-brand" /> {h}
          </li>
        ))}
      </ul>
      {enterprise ? (
        <a
          href={CONTATO_ENTERPRISE}
          className="mt-6 flex items-center justify-center gap-2 rounded-[11px] py-[13px] text-[14.5px] font-bold text-white"
          style={{ background: p.color }}
        >
          {p.cta_label}
        </a>
      ) : (
        <Link
          to={to}
          className="mt-6 flex items-center justify-center gap-2 rounded-[11px] py-[13px] text-[14.5px] font-bold text-white"
          style={{ background: p.popular ? "#10b981" : p.color }}
        >
          {p.cta_label}
        </Link>
      )}
    </div>
  );
}
```

- [ ] **Step 3: CTA "Continuar cadastro" da `/vender` carrega plano+ciclo**

Em `src/features/public/pages/Vender.tsx`, o botão do card de plano apenas **seleciona** (`onSelect(p.key)`); a navegação real é a barra fixa "Plano selecionado" com o botão **"Continuar cadastro"** que usa `sel`/`annual`. Substituir esse botão (o bloco `<button onClick={() => navigate("/cadastro-vendedor")} ...>Continuar cadastro ...</button>`) por:
```tsx
            {sel.key === "enterprise" || /falar com vendas/i.test(sel.cta_label) ? (
              <a
                href={`mailto:contato@revvio.com.br?subject=${encodeURIComponent(
                  "Interesse no plano Enterprise — Revvio"
                )}`}
                className="inline-flex items-center gap-2 rounded-[9px] bg-brand px-5 py-[9px] text-sm font-bold text-white hover:bg-brand-dark"
              >
                Falar com vendas <Icon name="arrowRight" size={16} />
              </a>
            ) : (
              <button
                onClick={() =>
                  navigate(
                    `/cadastro-vendedor?plan=${sel.key}&cycle=${annual ? "annual" : "monthly"}`
                  )
                }
                className="inline-flex items-center gap-2 rounded-[9px] bg-brand px-5 py-[9px] text-sm font-bold text-white hover:bg-brand-dark"
              >
                Continuar cadastro <Icon name="arrowRight" size={16} />
              </button>
            )}
```
(Não precisa importar nada novo — `navigate`, `Icon` e `sel` já existem no arquivo.)

- [ ] **Step 4: Gate**

Run: `npx tsc -b && npm run build` → exit 0.

- [ ] **Step 5: Commit**
```bash
git add src/features/public/components/home/HomeAnunciar.tsx src/features/public/components/home/HomePlanCard.tsx src/features/public/pages/Vender.tsx
git commit -m "feat(landing): toggle mensal/anual + CTAs levam plano/ciclo ao cadastro (Enterprise = contato)"
```

---

### Task 7: Deploy das functions + secrets + webhook sandbox + validação

**Files:** nenhum (ops + validação). Pré-condição: Tasks 1–6 mergeadas/no ar conforme o fluxo do projeto.

- [ ] **Step 1: Configurar secrets no Supabase remoto**

```bash
DBURL=$(grep '^SUPABASE_DB_URL=' .env.local | cut -d= -f2- | tr -d '"')
KEY=$(grep '^ASAAS_API_KEY=' .env.local | cut -d= -f2- | tr -d '"')
ENVV=$(grep '^ASAAS_ENV=' .env.local | cut -d= -f2- | tr -d '"')
TOK=$(grep '^ASAAS_WEBHOOK_TOKEN=' .env.local | cut -d= -f2- | tr -d '"')
supabase secrets set ASAAS_API_KEY="$KEY" ASAAS_ENV="${ENVV:-sandbox}" ASAAS_WEBHOOK_TOKEN="$TOK"
```
Expected: secrets atualizados (CLI confirma). Requer o projeto linkado (`supabase link --project-ref ahtisetxygjyfvhguckl` se necessário).

- [ ] **Step 2: Deploy das Edge Functions**

```bash
supabase functions deploy asaas-checkout
supabase functions deploy asaas-webhook
```
Expected: ambas "Deployed". URL do webhook:
`https://ahtisetxygjyfvhguckl.supabase.co/functions/v1/asaas-webhook`.

- [ ] **Step 3: Configurar o webhook no painel SANDBOX do ASAAS**

No painel sandbox (https://sandbox.asaas.com) → Integrações → Webhooks: criar webhook para a URL do Step 2, com o header `asaas-access-token` = valor de `ASAAS_WEBHOOK_TOKEN`, eventos de pagamento habilitados (PAYMENT_CREATED, PAYMENT_CONFIRMED, PAYMENT_RECEIVED, PAYMENT_OVERDUE). (Passo manual no painel do ASAAS — o agente não tem acesso; instruir o usuário.)

- [ ] **Step 4: Validação ponta a ponta (sandbox)**

1. Na home (`loja.revvio.com.br/`), alternar para "Anual", clicar no CTA do Profissional → cai em `/cadastro-vendedor?plan=profissional&cycle=annual` mostrando o resumo (R$ 2.844/ano).
2. Criar conta de teste (e-mail novo, CPF/CNPJ válido de teste) → perfil criado `pending` com `pricing_plan_key='profissional'`, `plan_cycle='annual'`.
3. Em `/checkout`, "Pagar com ASAAS" → redireciona para a página do ASAAS; conferir valor R$ 2.844,00.
4. Confirmar o pagamento no sandbox do ASAAS (marcar como recebido / pagar o PIX de teste).
5. Webhook dispara → conferir no banco: `rv_charges` com a cobrança e `rv_sellers.status='active'` para o garagista de teste.
6. Recarregar o app logado → acesso ao `/painel` liberado.

- [ ] **Step 5: Registrar resultado da validação**

Anotar no relatório (e na memória do projeto) que o sandbox está validado, com o id do garagista de teste e o evento que ativou.

---

## Self-Review (cobertura do spec)

- §3 fluxo (landing→cadastro→checkout→webhook→acesso) → Tasks 6,4,5,3. ✓
- §4.1 Edge Function `asaas-checkout` (auth do próprio usuário, customer+assinatura mensal/anual, invoiceUrl, rv_charges) → Task 2. ✓
- §4.2 helpers `getSubscriptionFirstPayment` → Task 2. ✓
- §4.3 webhook ativa seller em PAYMENT_CONFIRMED/RECEIVED → Task 3. ✓
- §4.4 front (HomeAnunciar toggle, HomePlanCard CTA, CadastroVendedor, createSellerProfile, CheckoutPlano, routeGuards, App) → Tasks 4,5,6. ✓
- §4.5 bordas (sem plano → escolher; e-mail-confirm → guard manda /checkout) → Task 5 (CheckoutPlano sem plano) + gating. ✓
- §5 migration `0022` (plan_cycle + asaas_subscription_id) + RLS já cobre → Task 1. ✓
- §6 secrets + deploy + webhook → Task 7. ✓
- §7 erros/estados (sem CPF/CNPJ, falha ASAAS, idempotência, pendente) → Task 2 (validações/idempotência) + Task 5 (estado/erro UI). ✓
- §8 validação sandbox → Task 7 Step 4. ✓
- Enterprise = contato (sem checkout) → Task 6 (HomePlanCard + Vender). ✓
- Gating em 2 lugares (routeGuards + App RoleRedirect) + navigate no cadastro → Tasks 5 e 4. ✓
