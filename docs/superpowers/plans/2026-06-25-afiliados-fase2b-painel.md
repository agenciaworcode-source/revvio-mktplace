# Sistema de Afiliados — Fase 2B (painel do afiliado) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o painel do afiliado: rota/login próprios, lista dos carros da loja com link/WhatsApp por carro (registrando `affiliate_share`), tela de desempenho (read-only) e edição de perfil.

**Architecture:** O afiliado (`role='afiliado'`) ganha uma área isolada `/afiliado/*` (layout próprio reusando `PanelShell`), separada do `/painel` do garagista/vendedor. Reaproveita auth/queries existentes. Uma migration adiciona o RPC `log_affiliate_share` e aperta a RLS de `rv_click_events` para escopar o afiliado aos próprios eventos.

**Tech Stack:** React 18 + TS, react-router-dom v6, @tanstack/react-query v5, react-hook-form + zod, Tailwind, Supabase (PostgreSQL + RPC), CLI local (Docker).

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-06-25-sistema-afiliados-design.md` (Painel do afiliado). Fases 1 e 2A já no repo: schema de afiliado, `ref_code`, `affiliate_id`, `log_affiliate_visit`, convite do garagista.
- **Escopo desta fase:** Carros (links/WhatsApp/`affiliate_share`), Desempenho (read-only), Perfil. **"Sinalizar venda" fica para a Fase 3** (pareia com a UI de venda do garagista e a sugestão) — fora desta fase por decisão de faseamento.
- **Gate de migration = `supabase db reset`** no banco LOCAL (stack já de pé). SQL check via `docker exec supabase_db_revvio psql -U postgres -d postgres -tAc "..."` (sem psql no host). Se a stack não subir, PARE e reporte BLOCKED.
- **Gate de TS = build.** Sem framework de teste unitário. Tasks de front: `npm run build` (`tsc -b && vite build`) **verde**.
- **Numeração de migration:** próxima é **0038** (última é `0037`).
- **Isolamento:** afiliado só enxerga os próprios dados (RLS). O painel é read-only salvo: gerar/compartilhar link e editar o próprio perfil. Afiliado **não** registra venda.
- **PT-BR.** O afiliado usa `ref_code` (na própria linha `rv_sellers`) para montar o link público `/(`veiculo/:id?ref=<ref_code>`)`.

---

## File Structure

- **Create** `supabase/migrations/0038_affiliate_share_and_clicks_rls.sql` — RPC `log_affiliate_share` + aperto da RLS de `rv_click_events`.
- **Modify** `src/features/auth/AuthProvider.tsx` — flag `isAfiliado`.
- **Modify** `src/features/auth/routeGuards.tsx`? (não necessário; `RoleRoute` já é genérico por `roles`).
- **Modify** `src/App.tsx` — `RoleRedirect` afiliado → `/afiliado`; bloco de rotas `/afiliado` (RoleRoute `["afiliado"]`).
- **Create** `src/features/affiliate/AffiliateLayout.tsx` — layout (PanelShell + nav do afiliado).
- **Create** `src/features/affiliate/queries.ts` — `useAffiliateLojaCars`, `useAffiliatePerformance`, `useLogAffiliateShare`.
- **Create** `src/features/affiliate/pages/Carros.tsx`, `Desempenho.tsx`, `Perfil.tsx`.

---

### Task 1: Migration 0038 — `log_affiliate_share` + RLS de cliques

**Files:**
- Create: `supabase/migrations/0038_affiliate_share_and_clicks_rls.sql`

**Interfaces:**
- Consumes: `current_person()`, `is_admin()`, `is_loja_manager()`, `current_loja()` (existentes); coluna `rv_click_events.affiliate_id` (0035); kind `affiliate_share` (0035).
- Produces: `public.log_affiliate_share(p_vehicle_id bigint)`; policy `rv_click_events_read_scope` recriada com escopo de afiliado.

- [ ] **Step 1: Criar `supabase/migrations/0038_affiliate_share_and_clicks_rls.sql`**

```sql
-- ============================================================
-- 0038_affiliate_share_and_clicks_rls.sql
-- RPC de "compartilhar" do afiliado + aperto da leitura de cliques
-- ============================================================

-- ── log de compartilhamento (afiliado autenticado clica em compartilhar/copiar) ──
create or replace function public.log_affiliate_share(
  p_vehicle_id bigint
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_aff  uuid;
  v_loja uuid;
begin
  select id, coalesce(parent_id, id) into v_aff, v_loja
    from public.rv_sellers
    where id = public.current_person() and role = 'afiliado' and status = 'active';
  if v_aff is null then
    return; -- não é afiliado ativo: ignora
  end if;
  insert into public.rv_click_events (seller_id, vehicle_id, kind, affiliate_id)
  values (v_loja, p_vehicle_id, 'affiliate_share', v_aff);
end;
$$;
revoke all on function public.log_affiliate_share(bigint) from public;
grant execute on function public.log_affiliate_share(bigint) to authenticated;

-- ── aperto da leitura de cliques: garagista (manager) vê a loja; afiliado vê só os
--    próprios eventos; admin vê tudo. (Antes: qualquer current_loja() lia a loja toda,
--    o que incluía afiliados — vazava cliques de outros.) ──
drop policy if exists "rv_click_events_read_scope" on public.rv_click_events;
create policy "rv_click_events_read_scope" on public.rv_click_events
  for select using (
    public.is_admin()
    or (public.is_loja_manager() and seller_id = public.current_loja())
    or affiliate_id = public.current_person()
  );
```

- [ ] **Step 2: Aplicar no banco local**

Run: `supabase db reset`
Expected: termina sem erro.

- [ ] **Step 3: Confirmar função e policy**

Run:
```bash
docker exec supabase_db_revvio psql -U postgres -d postgres -tAc \
"select (select count(*) from pg_proc where proname='log_affiliate_share'), (select count(*) from pg_policies where tablename='rv_click_events' and policyname='rv_click_events_read_scope');"
```
Expected: `1|1`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0038_affiliate_share_and_clicks_rls.sql
git commit -m "feat(db): log_affiliate_share + aperto RLS de rv_click_events p/ afiliado"
```

---

### Task 2: Auth (isAfiliado) + roteamento + layout do afiliado

**Files:**
- Modify: `src/features/auth/AuthProvider.tsx`
- Modify: `src/App.tsx`
- Create: `src/features/affiliate/AffiliateLayout.tsx`
- Create: `src/features/affiliate/pages/Carros.tsx` (stub)
- Create: `src/features/affiliate/pages/Desempenho.tsx` (stub)
- Create: `src/features/affiliate/pages/Perfil.tsx` (stub)

**Interfaces:**
- Consumes: `useAuth`, `PanelShell`/`PanelNavItem` (`@/components/PanelShell`), `RoleRoute`.
- Produces: `isAfiliado` em `useAuth()`; rotas `/afiliado`, `/afiliado/desempenho`, `/afiliado/perfil`; `AffiliateLayout`; exports `Carros`, `Desempenho`, `Perfil` (stubs por enquanto).

- [ ] **Step 1: Adicionar `isAfiliado` ao AuthProvider**

Em `src/features/auth/AuthProvider.tsx`, no `interface AuthState` adicionar `isAfiliado: boolean;` (após `isVendedor: boolean;`), e no objeto `value` (após `isVendedor: seller?.role === "vendedor",`) adicionar:

```tsx
      isAfiliado: seller?.role === "afiliado",
```

- [ ] **Step 2: Criar os 3 stubs em `src/features/affiliate/pages/`**

`Carros.tsx`, `Desempenho.tsx`, `Perfil.tsx` — cada um com o conteúdo mínimo (serão substituídos nas Tasks 4–6):

```tsx
// Carros.tsx
import { PageHeader } from "@/components/ui-light";
export function Carros() {
  return <PageHeader title="Carros" subtitle="Em construção" />;
}
```
```tsx
// Desempenho.tsx
import { PageHeader } from "@/components/ui-light";
export function Desempenho() {
  return <PageHeader title="Desempenho" subtitle="Em construção" />;
}
```
```tsx
// Perfil.tsx
import { PageHeader } from "@/components/ui-light";
export function Perfil() {
  return <PageHeader title="Meu perfil" subtitle="Em construção" />;
}
```

- [ ] **Step 3: Criar `src/features/affiliate/AffiliateLayout.tsx`**

```tsx
import { PanelShell, type PanelNavItem } from "@/components/PanelShell";

export function AffiliateLayout() {
  const nav: PanelNavItem[] = [
    { to: "/afiliado", label: "Carros", icon: "car", end: true },
    { to: "/afiliado/desempenho", label: "Desempenho", icon: "grid" },
    { to: "/afiliado/perfil", label: "Meu perfil", icon: "store" },
  ];
  return <PanelShell nav={nav} badge="Afiliado" />;
}
```

- [ ] **Step 4: Roteamento em `src/App.tsx`**

(a) No `RoleRedirect` (após o tratamento de `suspended`, antes do `return <Navigate to="/painel" .../>`), redirecionar o afiliado:

```tsx
  if (seller.role === "afiliado") return <Navigate to="/afiliado" replace />;
```

(b) Lazy imports (junto aos outros imports de páginas):

```tsx
const AffiliateLayout = lazy(() =>
  import("@/features/affiliate/AffiliateLayout").then((m) => ({ default: m.AffiliateLayout }))
);
const AfiliadoCarros = lazy(() =>
  import("@/features/affiliate/pages/Carros").then((m) => ({ default: m.Carros }))
);
const AfiliadoDesempenho = lazy(() =>
  import("@/features/affiliate/pages/Desempenho").then((m) => ({ default: m.Desempenho }))
);
const AfiliadoPerfil = lazy(() =>
  import("@/features/affiliate/pages/Perfil").then((m) => ({ default: m.Perfil }))
);
```

(c) Bloco de rotas (após o fechamento do bloco `/painel`, antes do bloco `/dashboard`):

```tsx
        {/* ── Afiliado ──────────────────────────── */}
        <Route
          path="/afiliado"
          element={
            <RoleRoute roles={["afiliado"]}>
              <AffiliateLayout />
            </RoleRoute>
          }
        >
          <Route index element={<AfiliadoCarros />} />
          <Route path="desempenho" element={<AfiliadoDesempenho />} />
          <Route path="perfil" element={<AfiliadoPerfil />} />
        </Route>
```

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: verde.

- [ ] **Step 6: Commit**

```bash
git add src/features/auth/AuthProvider.tsx src/App.tsx src/features/affiliate/
git commit -m "feat(affiliate): roteamento e layout do painel do afiliado (stubs)"
```

---

### Task 3: Queries do afiliado

**Files:**
- Create: `src/features/affiliate/queries.ts`

**Interfaces:**
- Consumes: `supabase`, react-query, tipos de `@/lib/database.types`.
- Produces:
  - `type AffiliateCar = { id: number; make: string; model: string; year: number | null; price: number; image: string | null }`
  - `useAffiliateLojaCars(lojaId?: string): UseQueryResult<AffiliateCar[]>`
  - `type AffiliatePerformance = { shares: number; clicks: number; salesCount: number; salesVolume: number; commissionPending: number; commissionPaid: number }`
  - `useAffiliatePerformance(personId?: string): UseQueryResult<AffiliatePerformance>`
  - `useLogAffiliateShare()` → mutate `{ vehicleId: number }`

- [ ] **Step 1: Criar `src/features/affiliate/queries.ts`**

```ts
import { useMutation, useQuery, type UseQueryResult } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export type AffiliateCar = {
  id: number;
  make: string;
  model: string;
  year: number | null;
  price: number;
  image: string | null;
};

/** Carros disponíveis da loja do afiliado (catálogo é leitura pública). */
export function useAffiliateLojaCars(lojaId?: string): UseQueryResult<AffiliateCar[]> {
  return useQuery({
    queryKey: ["affiliate-loja-cars", lojaId],
    enabled: !!lojaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rv_vehicles")
        .select("id, make, model, year, price, images, status, blocked, seller_id")
        .eq("seller_id", lojaId!)
        .eq("status", "available" as never)
        .order("created_at", { ascending: false });
      if (error) throw error;
      type Raw = {
        id: number; make: string; model: string; year: number | null;
        price: number; images: string[] | null; blocked: boolean | null;
      };
      return ((data ?? []) as unknown as Raw[])
        .filter((v) => !v.blocked)
        .map((v) => ({
          id: v.id,
          make: v.make,
          model: v.model,
          year: v.year,
          price: Number(v.price),
          image: v.images?.[0] ?? null,
        }));
    },
  });
}

export type AffiliatePerformance = {
  shares: number;
  clicks: number;
  salesCount: number;
  salesVolume: number;
  commissionPending: number;
  commissionPaid: number;
};

/** Desempenho do próprio afiliado (RLS escopa a affiliate_id = current_person). */
export function useAffiliatePerformance(personId?: string): UseQueryResult<AffiliatePerformance> {
  return useQuery({
    queryKey: ["affiliate-performance", personId],
    enabled: !!personId,
    queryFn: async () => {
      const [sharesQ, clicksQ, salesQ, commsQ] = await Promise.all([
        supabase
          .from("rv_click_events")
          .select("id", { count: "exact", head: true })
          .eq("affiliate_id", personId!)
          .eq("kind", "affiliate_share"),
        supabase
          .from("rv_click_events")
          .select("id", { count: "exact", head: true })
          .eq("affiliate_id", personId!)
          .eq("kind", "affiliate_link_visit"),
        supabase.from("rv_sales").select("sale_price").eq("affiliate_id", personId!),
        supabase.from("rv_commissions").select("amount, status").eq("affiliate_id", personId!),
      ]);
      if (sharesQ.error) throw sharesQ.error;
      if (clicksQ.error) throw clicksQ.error;
      if (salesQ.error) throw salesQ.error;
      if (commsQ.error) throw commsQ.error;

      const sales = (salesQ.data ?? []) as { sale_price: number }[];
      const comms = (commsQ.data ?? []) as { amount: number; status: string }[];
      return {
        shares: sharesQ.count ?? 0,
        clicks: clicksQ.count ?? 0,
        salesCount: sales.length,
        salesVolume: sales.reduce((acc, s) => acc + Number(s.sale_price), 0),
        commissionPending: comms
          .filter((c) => c.status !== "paid")
          .reduce((acc, c) => acc + Number(c.amount), 0),
        commissionPaid: comms
          .filter((c) => c.status === "paid")
          .reduce((acc, c) => acc + Number(c.amount), 0),
      };
    },
  });
}

/** Registra o compartilhamento de um carro pelo afiliado (RPC). */
export function useLogAffiliateShare() {
  return useMutation({
    mutationFn: async (input: { vehicleId: number }) => {
      const { error } = await supabase.rpc("log_affiliate_share", {
        p_vehicle_id: input.vehicleId,
      });
      if (error) throw error;
    },
  });
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: verde.

- [ ] **Step 3: Commit**

```bash
git add src/features/affiliate/queries.ts
git commit -m "feat(affiliate): queries do painel (carros, desempenho, log share)"
```

---

### Task 4: Página "Carros" (links + WhatsApp + share)

**Files:**
- Modify: `src/features/affiliate/pages/Carros.tsx` (substitui o stub)

**Interfaces:**
- Consumes: `useAuth` (`lojaId`, `seller.ref_code`); `useAffiliateLojaCars`, `useLogAffiliateShare`; `@/components/ui-light`; `formatCurrency` de `@/lib/format`.
- Produces: `export function Carros()`.

- [ ] **Step 1: Reescrever `src/features/affiliate/pages/Carros.tsx`**

```tsx
import { useAuth } from "@/features/auth/AuthProvider";
import { useAffiliateLojaCars, useLogAffiliateShare } from "../queries";
import { Button, Card, EmptyState, PageHeader, Spinner } from "@/components/ui-light";
import { formatCurrency } from "@/lib/format";

function carLink(refCode: string | null | undefined, id: number): string {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  const ref = refCode ? `?ref=${refCode}` : "";
  return `${base}/veiculo/${id}${ref}`;
}

export function Carros() {
  const { lojaId, seller } = useAuth();
  const carsQ = useAffiliateLojaCars(lojaId ?? undefined);
  const logShare = useLogAffiliateShare();
  const refCode = seller?.ref_code ?? null;

  async function copy(id: number) {
    const url = carLink(refCode, id);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* clipboard pode falhar em http; ignora */
    }
    logShare.mutate({ vehicleId: id });
  }

  function whatsapp(id: number, label: string) {
    const url = carLink(refCode, id);
    const text = `Olha esse veículo: ${label} — ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    logShare.mutate({ vehicleId: id });
  }

  const cars = carsQ.data ?? [];

  return (
    <div>
      <PageHeader
        title="Carros"
        subtitle="Compartilhe os veículos da loja com o seu link próprio"
      />
      {carsQ.isLoading ? (
        <div className="flex justify-center py-16 text-slate-500">
          <Spinner className="h-6 w-6" />
        </div>
      ) : cars.length === 0 ? (
        <EmptyState
          title="Nenhum carro disponível"
          description="A loja não tem veículos disponíveis no momento."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cars.map((c) => {
            const label = [c.make, c.model, c.year].filter(Boolean).join(" ");
            return (
              <Card key={c.id} className="flex flex-col gap-3 p-4">
                <div className="aspect-video overflow-hidden rounded-lg bg-slate-100">
                  {c.image ? (
                    <img src={c.image} alt={label} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-slate-400">
                      sem foto
                    </div>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{label}</p>
                  <p className="text-sm text-emerald-600">{formatCurrency(c.price)}</p>
                </div>
                <div className="mt-auto flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => copy(c.id)}>
                    Copiar link
                  </Button>
                  <Button className="flex-1" onClick={() => whatsapp(c.id, label)}>
                    WhatsApp
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

> Nota: confirme que `Button` aceita `className` (usado em outras páginas) e que `EmptyState` usa `title`/`description`. Se `seller.ref_code` não estiver no tipo `Seller` gerado, os tipos foram regenerados na Fase 1 (coluna `ref_code` existe) — rode `npm run build`; se reclamar, confirme que `database.generated.ts` inclui `ref_code` em `rv_sellers`.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: verde.

- [ ] **Step 3: Commit**

```bash
git add src/features/affiliate/pages/Carros.tsx
git commit -m "feat(affiliate): pagina Carros (link + WhatsApp + log de share)"
```

---

### Task 5: Página "Desempenho" (read-only)

**Files:**
- Modify: `src/features/affiliate/pages/Desempenho.tsx` (substitui o stub)

**Interfaces:**
- Consumes: `useAuth` (`personId`); `useAffiliatePerformance`; `@/components/ui-light` (`PageHeader`, `Card`, `Spinner`); `formatCurrency`.
- Produces: `export function Desempenho()`.

- [ ] **Step 1: Reescrever `src/features/affiliate/pages/Desempenho.tsx`**

```tsx
import { useAuth } from "@/features/auth/AuthProvider";
import { useAffiliatePerformance } from "../queries";
import { Card, PageHeader, Spinner } from "@/components/ui-light";
import { formatCurrency } from "@/lib/format";

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-5">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
    </Card>
  );
}

export function Desempenho() {
  const { personId } = useAuth();
  const perfQ = useAffiliatePerformance(personId ?? undefined);
  const p = perfQ.data;

  return (
    <div>
      <PageHeader
        title="Desempenho"
        subtitle="Seus compartilhamentos, cliques, vendas e comissões"
      />
      {perfQ.isLoading || !p ? (
        <div className="flex justify-center py-16 text-slate-500">
          <Spinner className="h-6 w-6" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <Metric label="Compartilhamentos" value={String(p.shares)} />
          <Metric label="Cliques recebidos" value={String(p.clicks)} />
          <Metric label="Vendas" value={String(p.salesCount)} />
          <Metric label="Volume vendido" value={formatCurrency(p.salesVolume)} />
          <Metric label="Comissão a receber" value={formatCurrency(p.commissionPending)} />
          <Metric label="Comissão recebida" value={formatCurrency(p.commissionPaid)} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: verde.

- [ ] **Step 3: Commit**

```bash
git add src/features/affiliate/pages/Desempenho.tsx
git commit -m "feat(affiliate): pagina Desempenho (read-only)"
```

---

### Task 6: Página "Meu perfil" (editar nome/telefone/avatar)

**Files:**
- Modify: `src/features/affiliate/pages/Perfil.tsx` (substitui o stub)

**Interfaces:**
- Consumes: `useAuth` (`seller`, `refreshSeller`); `useUpdateProfile` de `@/features/seller/queries`; `uploadMedia` de `@/lib/storage`; `@/components/ui-light`; `maskPhone`/`formatDate` se necessário.
- Produces: `export function Perfil()`.

- [ ] **Step 1: Reescrever `src/features/affiliate/pages/Perfil.tsx`**

```tsx
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/features/auth/AuthProvider";
import { useUpdateProfile } from "@/features/seller/queries";
import { uploadMedia } from "@/lib/storage";
import { Alert, Button, Card, Field, Input, PageHeader, Spinner } from "@/components/ui-light";

const schema = z.object({
  name: z.string().min(2, "Informe o nome"),
  phone: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export function Perfil() {
  const { seller, refreshSeller } = useAuth();
  const update = useUpdateProfile(seller);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: seller?.name ?? "", phone: seller?.phone ?? "" },
  });

  async function onSubmit(values: FormValues) {
    setErr(null);
    setMsg(null);
    try {
      await update.mutateAsync({ name: values.name, phone: values.phone || null });
      await refreshSeller();
      setMsg("Perfil atualizado.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro ao salvar o perfil.");
    }
  }

  async function onAvatar(file?: File) {
    if (!file) return;
    setErr(null);
    setUploading(true);
    try {
      const url = await uploadMedia("avatars", "affiliate", file);
      await update.mutateAsync({ avatar_url: url });
      await refreshSeller();
      setMsg("Foto atualizada.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro ao enviar a foto.");
    } finally {
      setUploading(false);
    }
  }

  if (!seller) {
    return (
      <div className="flex justify-center py-16 text-slate-500">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Meu perfil" subtitle="Seus dados de afiliado" />
      <Card className="flex flex-col gap-4 p-6">
        {msg && <Alert variant="success">{msg}</Alert>}
        {err && <Alert variant="error">{err}</Alert>}

        <div className="flex items-center gap-4">
          <div className="h-16 w-16 overflow-hidden rounded-full bg-slate-100">
            {seller.avatar_url ? (
              <img src={seller.avatar_url} alt={seller.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-xl text-slate-400">
                {seller.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <label className="cursor-pointer text-sm text-emerald-600 hover:underline">
            {uploading ? "Enviando…" : "Trocar foto"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onAvatar(e.target.files?.[0])}
            />
          </label>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <Field label="Nome" htmlFor="name" error={errors.name?.message}>
            <Input id="name" {...register("name")} />
          </Field>
          <Field label="Telefone" htmlFor="phone" error={errors.phone?.message}>
            <Input id="phone" placeholder="(00) 00000-0000" {...register("phone")} />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
```

> Nota: confirme a assinatura de `uploadMedia(bucket, folder, file)` em `@/lib/storage` (usada em `Profile.tsx` via `selectImage`); ajuste a chamada se a assinatura real diferir. Confirme que `ProfileInput` (tipo de `useUpdateProfile`) aceita `name`/`phone`/`avatar_url`. Confirme `Alert variant="success"` (senão use `"info"`).

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: verde.

- [ ] **Step 3: Commit**

```bash
git add src/features/affiliate/pages/Perfil.tsx
git commit -m "feat(affiliate): pagina Meu perfil (nome/telefone/avatar)"
```

---

## Verificação final (após Task 6)

- [ ] `supabase db reset` aplica 0038 sem erro; `npm run build` verde.
- [ ] (Manual, opcional) Logar como afiliado: `/afiliado` lista os carros disponíveis da loja com Copiar link / WhatsApp; o link tem `?ref=<ref_code>`; Desempenho mostra contadores; Perfil edita nome/telefone/foto.
- [ ] Deploy (junto com a 2A, conforme decidido): migrations 0038 no remoto (`supabase db push --db-url`); front build → rsync VPS → pm2 reload; e o deploy da edge function `invite-affiliate` (2A) por quem tem acesso à Management API.

## Self-Review (preenchido na escrita do plano)

- **Cobertura (Painel do afiliado):** RPC de share + RLS escopada (T1) ✓; auth/rota/layout (T2) ✓; queries (T3) ✓; Carros/links/share (T4) ✓; Desempenho read-only (T5) ✓; Perfil (T6) ✓. "Sinalizar venda" deferida p/ Fase 3 (declarado).
- **Placeholders:** nenhum — todo código presente.
- **Consistência:** `useAffiliateLojaCars(lojaId)`/`useAffiliatePerformance(personId)`/`useLogAffiliateShare` definidos em T3 e usados com os mesmos nomes em T4/T5; `AffiliateCar`/`AffiliatePerformance` idênticos; rotas `/afiliado*` casam entre RoleRedirect (T2) e o bloco de rotas (T2); `isAfiliado` adicionado em T2.
- **Pontos a confirmar na execução (anotados):** props de `Button(className)`/`EmptyState`/`Alert(variant)`; assinatura de `uploadMedia`; `ProfileInput` aceitar `avatar_url`; `ref_code` no tipo `Seller`.
