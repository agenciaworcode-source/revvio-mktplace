# Sistema de Afiliados — Fase 2A (lado do garagista) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar ao garagista (em plano habilitado) a área "Afiliados": convidar afiliados por e-mail, definir/editar a comissão e suspender/reativar — espelhando o fluxo de vendedor.

**Architecture:** Reaproveita o padrão de convite de vendedor: uma Edge Function `invite-affiliate` cria o usuário de Auth + a linha `rv_sellers` (`role='afiliado'`, `parent_id`=loja, `ref_code` gerado) e envia o e-mail de boas-vindas; o front ganha hooks de query e uma página "Afiliados" gated pelo `affiliates_enabled` do plano. O painel do próprio afiliado é a Fase 2B.

**Tech Stack:** Deno (Edge Functions, `supabase/functions/`), Supabase JS, React 18 + TS, @tanstack/react-query v5, react-hook-form + zod, Tailwind, componentes `@/components/ui-light`.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-06-25-sistema-afiliados-design.md` (seções Onboarding e Painel do garagista; gating). Fase 1 já entregou o schema (enum `afiliado`, `ref_code`, `affiliates_enabled`, `affiliate_id`) — aplicado no remoto.
- **Gate de TS = build.** Sem framework de teste unitário. Tasks de front: `npm run build` (`tsc -b && vite build`) **verde**.
- **Gate da Edge Function = deploy + smoke.** Edge Functions só rodam deployadas; a verificação é `supabase functions deploy invite-affiliate` (com `--project-ref ahtisetxygjyfvhguckl`) concluir sem erro + um smoke invoke. A função é **aditiva** (não toca funções existentes). Se o deploy exigir credencial que o ambiente não tem, **PARE e reporte BLOCKED** — não pule o gate.
- **Reuso obrigatório:** espelhar `supabase/functions/invite-vendedor/index.ts` e os hooks `useTeam`/`useInviteVendedor`/`useSetVendedorRate`/`useSetVendedorStatus` (`src/features/seller/queries.ts`) e a página `src/features/seller/pages/Equipe.tsx`. Não reinventar.
- **Gating:** a função e a UI só permitem afiliados quando o plano do garagista tem `affiliates_enabled = true` (lookup em `rv_pricing_plans` por `pricing_plan_key`). Sem o plano: função retorna 403; UI mostra aviso de upgrade, sem o CRUD.
- **1 afiliado = 1 garagista** (`parent_id` = loja do chamador). **PT-BR** nas mensagens.
- **Projeto remoto:** ref `ahtisetxygjyfvhguckl` (linkado). Edge Functions já usam `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `APP_URL` (presentes no ambiente das functions).

---

## File Structure

- **Create** `supabase/functions/invite-affiliate/index.ts` — Edge Function de convite do afiliado (espelha `invite-vendedor`, + gating + `ref_code`).
- **Modify** `supabase/functions/_shared/email-templates.ts` — adicionar template `afiliado_welcome`.
- **Modify** `src/features/seller/queries.ts` — hooks `useAffiliates`, `useInviteAffiliate`, `useSetAffiliateRate`, `useSetAffiliateStatus`, `useAffiliatesEnabled`.
- **Create** `src/features/seller/pages/Afiliados.tsx` — página do garagista (lista + convite + editar comissão + suspender/reativar + aviso de upgrade).
- **Modify** `src/features/seller/PainelLayout.tsx` — item de nav "Afiliados" (só managers, só com plano habilitado).
- **Modify** `src/App.tsx` — lazy import + rota `/painel/afiliados`.

---

### Task 1: Edge Function `invite-affiliate` + e-mail

**Files:**
- Create: `supabase/functions/invite-affiliate/index.ts`
- Modify: `supabase/functions/_shared/email-templates.ts`

**Interfaces:**
- Consumes: `../_shared/cors.ts` (`corsHeaders`, `json`), `../_shared/resend.ts` (`sendEmail`), `renderTemplate` de `../_shared/email-templates.ts`.
- Produces: endpoint `invite-affiliate` que recebe `{ name, email, commission_rate }` e retorna `{ ok: true, affiliateId }` ou `{ error }` com status apropriado; template `afiliado_welcome`.

- [ ] **Step 1: Adicionar o template `afiliado_welcome` em `supabase/functions/_shared/email-templates.ts`**

Inserir logo após o bloco `vendedor_welcome: (d) => ({ ... }),`:

```ts
  // boas-vindas do afiliado (→ afiliado) · enviado pela invite-affiliate
  // quando o garagista convida; traz o link para definir a senha e acessar.
  afiliado_welcome: (d) => ({
    subject: "Você foi convidado como afiliado na REVVIO — defina sua senha",
    html: layout({
      heading: `Olá, ${str(d, "name", "afiliado")}!`,
      body: `Você foi convidado como <strong>afiliado</strong>${
        str(d, "loja") ? ` da loja <strong>${str(d, "loja")}</strong>` : ""
      } na REVVIO. Como afiliado, você divulga os veículos da loja com o seu link próprio e acompanha o seu desempenho. Para acessar, defina sua senha no botão abaixo.`,
      cta: { label: "Definir senha e acessar", href: str(d, "set_password_url", `${APP_URL}/login`) },
    }),
  }),
```

- [ ] **Step 2: Criar `supabase/functions/invite-affiliate/index.ts`**

```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { renderTemplate } from "../_shared/email-templates.ts";
import { sendEmail } from "../_shared/resend.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = Deno.env.get("APP_URL") ?? "https://loja.revvio.com.br";

// código curto do afiliado p/ o link público (?ref=). base36, 8 chars.
function genRefCode(): string {
  let s = "";
  for (let i = 0; i < 8; i++) s += Math.floor(Math.random() * 36).toString(36);
  return s;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // 1. identidade do chamador
    const authHeader = req.headers.get("Authorization") ?? "";
    const asUser = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: auth, error: uErr } = await asUser.auth.getUser();
    if (uErr || !auth?.user) return json({ error: "Não autenticado." }, 401);

    const db = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: caller, error: cErr } = await db
      .from("rv_sellers")
      .select("id, role, parent_id, name, pricing_plan_key")
      .eq("user_id", auth.user.id)
      .single();
    if (cErr || !caller) return json({ error: "Perfil não encontrado." }, 403);
    if (caller.role !== "garagista" && caller.role !== "admin")
      return json({ error: "Apenas o garagista pode cadastrar afiliados." }, 403);

    const loja = caller.parent_id ?? caller.id;

    // 2. gating pelo plano do garagista
    let enabled = false;
    if (caller.pricing_plan_key) {
      const { data: plan } = await db
        .from("rv_pricing_plans")
        .select("affiliates_enabled")
        .eq("key", caller.pricing_plan_key)
        .maybeSingle();
      enabled = !!plan?.affiliates_enabled;
    }
    if (!enabled && caller.role !== "admin")
      return json({ error: "Seu plano não inclui o recurso de afiliados." }, 403);

    // 3. payload
    const body = await req.json().catch(() => ({}));
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const rate = Number(body.commission_rate ?? 0);
    if (!name || !email) return json({ error: "Nome e e-mail são obrigatórios." }, 400);
    if (Number.isNaN(rate) || rate < 0 || rate > 100)
      return json({ error: "Taxa de comissão inválida (0–100)." }, 400);

    // 4. cria o usuário do Auth (sem senha; e-mail confirmado)
    const created = await db.auth.admin.createUser({ email, email_confirm: true });
    if (created.error || !created.data?.user) {
      const msg = created.error?.message ?? "Erro ao criar o usuário.";
      const code = /already|exist|registered/i.test(msg) ? 409 : 400;
      return json({ error: code === 409 ? "Este e-mail já tem conta." : msg }, code);
    }
    const userId = created.data.user.id;

    // 5. cria a linha do afiliado (ref_code único, com retry em colisão)
    let affiliateId: string | null = null;
    let lastErr: string | null = null;
    for (let attempt = 0; attempt < 5 && !affiliateId; attempt++) {
      const { data: aff, error: aErr } = await db
        .from("rv_sellers")
        .insert({
          user_id: userId,
          name,
          email,
          role: "afiliado",
          status: "active",
          parent_id: loja,
          commission_rate: rate,
          ref_code: genRefCode(),
        })
        .select("id")
        .single();
      if (aff) {
        affiliateId = aff.id;
        break;
      }
      lastErr = aErr?.message ?? "Erro ao criar o afiliado.";
      // 23505 = unique_violation; se for o ref_code, tenta outro código
      if (!/duplicate key|unique|23505/i.test(lastErr)) break;
    }
    if (!affiliateId) {
      await db.auth.admin.deleteUser(userId); // desfaz o usuário órfão
      return json({ error: lastErr ?? "Erro ao criar o afiliado." }, 400);
    }

    // 6. link para definir a senha (token_hash → /definir-senha)
    let setPasswordUrl = `${APP_URL}/login`;
    try {
      const link = await db.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo: `${APP_URL}/definir-senha` },
      });
      const props = link.data?.properties;
      if (props?.hashed_token)
        setPasswordUrl = `${APP_URL}/definir-senha?token_hash=${props.hashed_token}&type=recovery`;
      else if (props?.action_link) setPasswordUrl = props.action_link;
    } catch (e) {
      console.error("Falha ao gerar link de senha do afiliado:", e);
    }

    // 7. e-mail de boas-vindas (best-effort)
    try {
      const rendered = renderTemplate("afiliado_welcome", {
        name,
        loja: caller.name ?? "",
        set_password_url: setPasswordUrl,
      });
      if (rendered)
        await sendEmail({ to: email, subject: rendered.subject, html: rendered.html });
    } catch (e) {
      console.error("Falha ao enviar e-mail do afiliado:", e);
    }

    return json({ ok: true, affiliateId });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erro interno." }, 500);
  }
});
```

- [ ] **Step 3: Deploy da função (gate)**

Run: `supabase functions deploy invite-affiliate --project-ref ahtisetxygjyfvhguckl`
Expected: termina com a função deployada (ex.: `Deployed Functions on project ... invite-affiliate`).
(Se o ambiente não tiver credencial de deploy, PARE e reporte BLOCKED.)

- [ ] **Step 4: Smoke test (sem auth → 401)**

Run (carregue a URL/anon do `.env.local` sem expor valores):
```bash
URL=$(grep '^VITE_SUPABASE_URL=' .env.local | cut -d= -f2- | tr -d '"')
AK=$(grep '^VITE_SUPABASE_ANON_KEY=' .env.local | cut -d= -f2- | tr -d '"')
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$URL/functions/v1/invite-affiliate" \
  -H "apikey: $AK" -H "Content-Type: application/json" -d '{}'
```
Expected: `401` (sem `Authorization` de usuário → "Não autenticado.").

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/invite-affiliate/index.ts supabase/functions/_shared/email-templates.ts
git commit -m "feat(affiliate): edge function invite-affiliate + email afiliado_welcome"
```

---

### Task 2: Hooks de query do garagista

**Files:**
- Modify: `src/features/seller/queries.ts`

**Interfaces:**
- Consumes: `supabase`, `useQuery`, `useMutation`, `useQueryClient`, `UseQueryResult`, tipo `Seller` (já importados no arquivo).
- Produces:
  - `useAffiliates(lojaId?: string): UseQueryResult<Seller[]>`
  - `useInviteAffiliate(lojaId?: string)` → mutate `{ name: string; email: string; commission_rate: number }`
  - `useSetAffiliateRate(lojaId?: string)` → mutate `{ id: string; rate: number }`
  - `useSetAffiliateStatus(lojaId?: string)` → mutate `{ id: string; status: "active" | "suspended" }`
  - `useAffiliatesEnabled(planKey?: string | null): UseQueryResult<boolean>`

- [ ] **Step 1: Adicionar os hooks ao final de `src/features/seller/queries.ts`**

```ts
/* ── Afiliados (visão do garagista) ─────────────────────── */
export function useAffiliates(lojaId?: string): UseQueryResult<Seller[]> {
  return useQuery({
    queryKey: ["affiliates", lojaId],
    enabled: !!lojaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rv_sellers")
        .select("*")
        .eq("parent_id", lojaId!)
        .eq("role", "afiliado")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Seller[];
    },
  });
}

export function useInviteAffiliate(lojaId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; email: string; commission_rate: number }) => {
      const { data, error } = await supabase.functions.invoke("invite-affiliate", {
        body: input,
      });
      if (error) {
        const ctx = (error as { context?: Response }).context;
        if (ctx && typeof ctx.json === "function") {
          const body = await ctx.json().catch(() => null);
          if (body?.error) throw new Error(body.error);
        }
        throw error;
      }
      if ((data as { error?: string })?.error)
        throw new Error((data as { error: string }).error);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["affiliates", lojaId] }),
  });
}

export function useSetAffiliateRate(lojaId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; rate: number }) => {
      const { error } = await supabase
        .from("rv_sellers")
        .update({ commission_rate: input.rate })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["affiliates", lojaId] }),
  });
}

export function useSetAffiliateStatus(lojaId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; status: "active" | "suspended" }) => {
      const { error } = await supabase
        .from("rv_sellers")
        .update({ status: input.status })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["affiliates", lojaId] }),
  });
}

/** O plano do garagista habilita afiliados? Lookup por pricing_plan_key. */
export function useAffiliatesEnabled(planKey?: string | null): UseQueryResult<boolean> {
  return useQuery({
    queryKey: ["affiliates-enabled", planKey ?? null],
    enabled: !!planKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rv_pricing_plans")
        .select("affiliates_enabled")
        .eq("key", planKey!)
        .maybeSingle();
      if (error) throw error;
      return !!(data as { affiliates_enabled?: boolean } | null)?.affiliates_enabled;
    },
  });
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: verde.

- [ ] **Step 3: Commit**

```bash
git add src/features/seller/queries.ts
git commit -m "feat(affiliate): hooks de query do garagista (afiliados + gating)"
```

---

### Task 3: Página "Afiliados" + nav + rota

**Files:**
- Create: `src/features/seller/pages/Afiliados.tsx`
- Modify: `src/features/seller/PainelLayout.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `useAffiliates`, `useInviteAffiliate`, `useSetAffiliateRate`, `useSetAffiliateStatus`, `useAffiliatesEnabled` (Task 2); `useAuth` (`lojaId`, `seller`, `isGaragista`, `isAdmin`); `@/components/ui-light`.
- Produces: `export function Afiliados()`; item de nav `/painel/afiliados`; rota `afiliados` no bloco `/painel`.

- [ ] **Step 1: Criar `src/features/seller/pages/Afiliados.tsx`**

```tsx
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/features/auth/AuthProvider";
import {
  useAffiliates,
  useAffiliatesEnabled,
  useInviteAffiliate,
  useSetAffiliateRate,
  useSetAffiliateStatus,
} from "../queries";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Spinner,
} from "@/components/ui-light";
import { formatDate } from "@/lib/format";
import type { Seller } from "@/lib/database.types";

const schema = z.object({
  name: z.string().min(2, "Informe o nome"),
  email: z.string().email("E-mail inválido"),
  commission_rate: z.coerce.number().min(0).max(100),
});
type FormValues = z.infer<typeof schema>;

function InviteForm({ lojaId, onClose }: { lojaId?: string; onClose: () => void }) {
  const invite = useInviteAffiliate(lojaId);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { commission_rate: 5 },
  });

  async function onSubmit(values: FormValues) {
    setError(null);
    try {
      await invite.mutateAsync(values);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao convidar o afiliado.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      {error && <Alert variant="error">{error}</Alert>}
      <Field label="Nome" htmlFor="name" error={errors.name?.message}>
        <Input id="name" placeholder="Nome do afiliado" {...register("name")} />
      </Field>
      <Field label="E-mail" htmlFor="email" error={errors.email?.message}>
        <Input id="email" type="email" placeholder="email@exemplo.com" {...register("email")} />
      </Field>
      <Field label="Comissão (%)" htmlFor="commission_rate" error={errors.commission_rate?.message}>
        <Input id="commission_rate" type="number" step="0.5" {...register("commission_rate")} />
      </Field>
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={invite.isPending}>
          {invite.isPending ? "Convidando…" : "Convidar afiliado"}
        </Button>
      </div>
    </form>
  );
}

function AffiliateRow({ a, lojaId }: { a: Seller; lojaId?: string }) {
  const setRate = useSetAffiliateRate(lojaId);
  const setStatus = useSetAffiliateStatus(lojaId);
  const [rate, setRateValue] = useState(String(a.commission_rate ?? 0));
  const suspended = a.status === "suspended";

  return (
    <tr>
      <td className="px-5 py-3 font-medium text-slate-900">
        {a.name}
        <span className="block text-xs text-slate-500">{a.email}</span>
      </td>
      <td className="px-5 py-3">
        <div className="flex items-center gap-2">
          <Input
            type="number"
            step="0.5"
            value={rate}
            onChange={(e) => setRateValue(e.target.value)}
            className="w-20"
          />
          <Button
            variant="outline"
            disabled={setRate.isPending || Number(rate) === Number(a.commission_rate)}
            onClick={() => setRate.mutate({ id: a.id, rate: Number(rate) })}
          >
            Salvar
          </Button>
        </div>
      </td>
      <td className="px-5 py-3">
        <Badge tone={suspended ? "red" : "green"}>{suspended ? "Suspenso" : "Ativo"}</Badge>
      </td>
      <td className="px-5 py-3 text-slate-500">{a.created_at ? formatDate(a.created_at) : "—"}</td>
      <td className="px-5 py-3 text-right">
        <Button
          variant="outline"
          disabled={setStatus.isPending}
          onClick={() =>
            setStatus.mutate({ id: a.id, status: suspended ? "active" : "suspended" })
          }
        >
          {suspended ? "Reativar" : "Suspender"}
        </Button>
      </td>
    </tr>
  );
}

export function Afiliados() {
  const { lojaId, seller, isGaragista, isAdmin } = useAuth();
  const enabledQ = useAffiliatesEnabled(seller?.pricing_plan_key);
  const affiliatesQ = useAffiliates(lojaId ?? undefined);
  const [open, setOpen] = useState(false);

  if (!isGaragista && !isAdmin) {
    return <p className="py-16 text-center text-slate-500">Área exclusiva do garagista.</p>;
  }

  const enabled = isAdmin || enabledQ.data === true;

  return (
    <div>
      <PageHeader
        title="Afiliados"
        subtitle="Convide afiliados para divulgar e vender os seus carros"
        action={
          enabled ? (
            <Button onClick={() => setOpen(true)}>Convidar afiliado</Button>
          ) : undefined
        }
      />

      {!enabled ? (
        <Alert variant="info">
          O recurso de <strong>afiliados</strong> não está incluído no seu plano atual. Faça upgrade
          para convidar afiliados e ampliar a divulgação dos seus veículos.
        </Alert>
      ) : affiliatesQ.isLoading ? (
        <div className="flex justify-center py-16 text-slate-500">
          <Spinner className="h-6 w-6" />
        </div>
      ) : (affiliatesQ.data ?? []).length === 0 ? (
        <EmptyState
          title="Nenhum afiliado ainda"
          description="Convide o primeiro afiliado para começar."
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Afiliado</th>
                <th className="px-5 py-3 font-medium">Comissão (%)</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Desde</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(affiliatesQ.data ?? []).map((a) => (
                <AffiliateRow key={a.id} a={a} lojaId={lojaId ?? undefined} />
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Convidar afiliado">
        {open && <InviteForm lojaId={lojaId ?? undefined} onClose={() => setOpen(false)} />}
      </Modal>
    </div>
  );
}
```

> Nota: confirme que `Alert` aceita `variant="info"` e `Badge` aceita `tone="green"|"red"` em `@/components/ui-light` (ambos já usados no projeto). Se `EmptyState` tiver props diferentes, ajuste para a assinatura real do componente.

- [ ] **Step 2: Adicionar o item de nav em `src/features/seller/PainelLayout.tsx`**

Trocar o corpo do componente para incluir o gating do item "Afiliados" (logo após "Vendedores"). O componente passa a consultar `useAffiliatesEnabled`:

```tsx
import { useAuth } from "@/features/auth/AuthProvider";
import { PanelShell, type PanelNavItem } from "@/components/PanelShell";
import { useAffiliatesEnabled } from "./queries";

export function PainelLayout() {
  const { seller, isGaragista, isAdmin } = useAuth();
  const manager = isGaragista || isAdmin;
  const { data: affiliatesOn } = useAffiliatesEnabled(seller?.pricing_plan_key);
  const showAffiliates = manager && (isAdmin || affiliatesOn === true);
  const nav: PanelNavItem[] = [
    { to: "/painel", label: "Dashboard", icon: "grid", end: true },
    ...(manager
      ? [{ to: "/painel/leads", label: "Leads", icon: "users" } as PanelNavItem]
      : []),
    { to: "/painel/veiculos", label: "Veículos", icon: "car" },
    ...(manager
      ? [{ to: "/painel/vendedores", label: "Vendedores", icon: "users" } as PanelNavItem]
      : []),
    ...(showAffiliates
      ? [{ to: "/painel/afiliados", label: "Afiliados", icon: "users" } as PanelNavItem]
      : []),
    { to: "/painel/vendas", label: "Vendas", icon: "dollar" },
    { to: "/painel/financeiro", label: "Financeiro", icon: "wallet" },
    ...(manager
      ? [
          { to: "/painel/gerador-whatsapp", label: "Gerador WhatsApp", icon: "whatsapp" } as PanelNavItem,
          { to: "/painel/perfil", label: "Perfil / Mini-Loja", icon: "store" } as PanelNavItem,
        ]
      : []),
  ];
  return (
    <PanelShell nav={nav} badge={manager ? "Garagista" : seller ? "Vendedor" : "Painel"} />
  );
}
```

- [ ] **Step 3: Registrar a rota em `src/App.tsx`**

Adicionar o lazy import junto aos outros imports de seller (perto de `SellerEquipe`):

```tsx
const SellerAfiliados = lazy(() =>
  import("@/features/seller/pages/Afiliados").then((m) => ({ default: m.Afiliados }))
);
```

Adicionar a rota dentro do bloco `/painel` (após `<Route path="vendedores" element={<SellerEquipe />} />`):

```tsx
          <Route path="afiliados" element={<SellerAfiliados />} />
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: verde.

- [ ] **Step 5: Commit**

```bash
git add src/features/seller/pages/Afiliados.tsx src/features/seller/PainelLayout.tsx src/App.tsx
git commit -m "feat(affiliate): pagina Afiliados do garagista (CRUD + gating)"
```

---

## Verificação final (após Task 3)

- [ ] `npm run build` verde.
- [ ] Função `invite-affiliate` deployada; smoke `401` sem auth.
- [ ] (Manual, opcional) Logar como garagista de plano Profissional, abrir `/painel/afiliados`, convidar um afiliado de teste; confirmar a linha criada (`role='afiliado'`, `ref_code` preenchido) e o e-mail. Garagista de plano não habilitado vê o aviso de upgrade, sem o botão.
- [ ] Deploy do front: build estático → rsync VPS → pm2 reload (rotina do projeto). A função já foi deployada na Task 1.

> **Nota de faseamento:** o afiliado convidado recebe e-mail para definir senha, mas o **painel do afiliado é a Fase 2B**. Até a 2B, o afiliado que logar cai no fallback de papel do `RoleRoute`. Recomenda-se **não anunciar/convidar afiliados reais em produção antes da 2B** — ou deployar 2A+2B juntos.

## Self-Review (preenchido na escrita do plano)

- **Cobertura (Onboarding garagista + gating):** edge function de convite com gating + ref_code (T1) ✓; hooks de CRUD + gating (T2) ✓; página Afiliados + nav gated + rota (T3) ✓. Painel do afiliado (carros/links/share/perfil/sinalizar) = Fase 2B (fora desta).
- **Placeholders:** nenhum — todo código presente.
- **Consistência:** `invite-affiliate` consumido por `useInviteAffiliate`; `useAffiliatesEnabled(planKey)` usado igual em PainelLayout e Afiliados; chaves de query `["affiliates", lojaId]` consistentes entre os hooks de mutação e leitura; `Seller` é o tipo das linhas.
- **Pontos a confirmar na execução (anotados):** props reais de `Alert`/`Badge`/`EmptyState`; credencial de deploy da Edge Function; `seller.pricing_plan_key` presente no tipo `Seller` (Fase 0009 adicionou a coluna).
