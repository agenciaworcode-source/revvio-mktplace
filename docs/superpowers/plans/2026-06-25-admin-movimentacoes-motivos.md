# Visão do admin: motivos de venda e remoção (Movimentações) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar ao admin (dono da plataforma) uma página global "Movimentações" e cards no SellerDetail para ver os motivos de venda (`rv_sales.sale_reason`) e de remoção (`rv_vehicles.removal_reason`, soft-delete) dos garagistas.

**Architecture:** 100% frontend. Dois hooks de query novos em `admin/queries.ts` (com filtros opcionais) leem dados que a RLS já libera para o admin. Três componentes reutilizáveis (resumo + duas tabelas) consumidos por uma página global nova (com filtros) e por dois cards no SellerDetail (sem filtros).

**Tech Stack:** React 18, TypeScript, @tanstack/react-query v5, react-router-dom v6, Tailwind, Supabase JS. Componentes de UI em `@/components/ui-light` e `@/features/public/components/icons`.

## Global Constraints

- **Sem migrations / sem mudança de RLS.** Os dados já existem e o admin já tem leitura (`rv_sales` policy `rv_sales_read_scope` com `is_admin()`; `rv_vehicles` policy `rv_vehicles_public_read` com `using(true)`).
- **Gate de verificação = build.** O projeto não tem framework de testes. Cada task termina com `npm run build` (que roda `tsc -b && vite build`) **verde** + commit. Não introduzir vitest/jest (fora de escopo).
- **Listas de motivos:** reutilizar `SALE_REASONS` e `REMOVAL_REASONS` exportados de `src/components/ReasonField.tsx`. NÃO redefinir.
- **Padrão de tipos:** onde o TS reclamar de colunas novas (tipos gerados desatualizados), usar `as unknown as T[]` / cast pontual, como já feito em `useAdminVehicles` e `useAdminDeleteVehicle`.
- **Padrão de tabela:** `<Card className="overflow-x-auto p-0">` > `<table className="w-full text-sm">`, `<thead className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">`, células `className="px-5 py-3 ..."` (ver `src/features/seller/pages/Sales.tsx`).
- **Mensagens em PT-BR.**

---

## File Structure

- **Modify** `src/features/admin/queries.ts` — adicionar tipos `ReasonFilters`, `AdminSaleRow`, `AdminRemovalRow` e hooks `useAdminSales`, `useAdminRemovals`.
- **Create** `src/features/admin/components/MovimentacoesPanels.tsx` — componentes `ReasonSummary`, `SalesReasonTable`, `RemovalsReasonTable` (apresentação pura, recebem dados por props).
- **Create** `src/features/admin/pages/Movimentacoes.tsx` — página global com abas Vendas/Remoções, filtros, resumo e tabelas.
- **Modify** `src/features/admin/AdminLayout.tsx` — novo item de menu "Movimentações".
- **Modify** `src/App.tsx` — lazy import + `<Route path="movimentacoes" .../>`.
- **Modify** `src/features/admin/pages/SellerDetail.tsx` — dois cards (Vendas / Veículos removidos) escopados ao garagista.

> Nota de boundary: os componentes de apresentação não importam nada de páginas; recebem `rows` e `reasons` por props. As páginas fazem o data-fetching e passam para baixo. Isso mantém os componentes reutilizáveis entre a página global e o SellerDetail.

---

### Task 1: Camada de dados — hooks `useAdminSales` e `useAdminRemovals`

**Files:**
- Modify: `src/features/admin/queries.ts` (adicionar ao final, antes do fechamento do arquivo)

**Interfaces:**
- Consumes: `supabase` (já importado), `useQuery`, `UseQueryResult` (já importados).
- Produces:
  - `type ReasonFilters = { sellerId?: string; reason?: string; from?: string; to?: string }`
  - `type AdminSaleRow = { id: string; sale_date: string; buyer_name: string; sale_price: number; payment_method: string; sale_reason: string | null; seller_name: string; vehicle_label: string }`
  - `type AdminRemovalRow = { id: number; removed_at: string | null; removal_reason: string | null; price: number; seller_name: string; vehicle_label: string }`
  - `useAdminSales(filters?: ReasonFilters): UseQueryResult<AdminSaleRow[]>`
  - `useAdminRemovals(filters?: ReasonFilters): UseQueryResult<AdminRemovalRow[]>`

- [ ] **Step 1: Adicionar tipos e hooks ao final de `src/features/admin/queries.ts`**

```ts
/* ── Movimentações: motivos de venda e remoção (admin) ──── */
export type ReasonFilters = {
  sellerId?: string;
  reason?: string;
  from?: string; // ISO date (yyyy-mm-dd), inclusivo
  to?: string;   // ISO date (yyyy-mm-dd), inclusivo
};

export type AdminSaleRow = {
  id: string;
  sale_date: string;
  buyer_name: string;
  sale_price: number;
  payment_method: string;
  sale_reason: string | null;
  seller_name: string;
  vehicle_label: string;
};

export type AdminRemovalRow = {
  id: number;
  removed_at: string | null;
  removal_reason: string | null;
  price: number;
  seller_name: string;
  vehicle_label: string;
};

function vehicleLabel(v: { make?: string; model?: string; year?: number | null } | null): string {
  if (!v || (!v.make && !v.model)) return "Veículo removido";
  return [v.make, v.model, v.year].filter(Boolean).join(" ");
}

export function useAdminSales(filters: ReasonFilters = {}): UseQueryResult<AdminSaleRow[]> {
  const { sellerId, reason, from, to } = filters;
  return useQuery({
    queryKey: ["admin-sales", sellerId ?? null, reason ?? null, from ?? null, to ?? null],
    queryFn: async () => {
      let q = supabase
        .from("rv_sales")
        .select(
          "id, sale_date, buyer_name, sale_price, payment_method, sale_reason, seller_id, seller:rv_sellers!rv_sales_seller_id_fkey(name), vehicle:rv_vehicles(make, model, year)"
        )
        .order("sale_date", { ascending: false });
      if (sellerId) q = q.eq("seller_id", sellerId);
      if (reason) q = q.eq("sale_reason", reason);
      if (from) q = q.gte("sale_date", from);
      if (to) q = q.lte("sale_date", to);
      const { data, error } = await q;
      if (error) throw error;
      type Raw = {
        id: string; sale_date: string; buyer_name: string; sale_price: number;
        payment_method: string; sale_reason: string | null;
        seller: { name: string } | null;
        vehicle: { make: string; model: string; year: number | null } | null;
      };
      return ((data ?? []) as unknown as Raw[]).map((r) => ({
        id: r.id,
        sale_date: r.sale_date,
        buyer_name: r.buyer_name,
        sale_price: Number(r.sale_price),
        payment_method: r.payment_method,
        sale_reason: r.sale_reason,
        seller_name: r.seller?.name ?? "—",
        vehicle_label: vehicleLabel(r.vehicle),
      }));
    },
  });
}

export function useAdminRemovals(filters: ReasonFilters = {}): UseQueryResult<AdminRemovalRow[]> {
  const { sellerId, reason, from, to } = filters;
  return useQuery({
    queryKey: ["admin-removals", sellerId ?? null, reason ?? null, from ?? null, to ?? null],
    queryFn: async () => {
      let q = supabase
        .from("rv_vehicles")
        .select(
          "id, make, model, year, price, removal_reason, removed_at, seller_id, seller:rv_sellers!rv_vehicles_seller_id_fkey(name)"
        )
        .eq("status", "removed" as never)
        .order("removed_at", { ascending: false });
      if (sellerId) q = q.eq("seller_id", sellerId);
      if (reason) q = q.eq("removal_reason", reason);
      if (from) q = q.gte("removed_at", from);
      if (to) q = q.lte("removed_at", `${to}T23:59:59.999Z`);
      const { data, error } = await q;
      if (error) throw error;
      type Raw = {
        id: number; make: string; model: string; year: number | null; price: number;
        removal_reason: string | null; removed_at: string | null;
        seller: { name: string } | null;
      };
      return ((data ?? []) as unknown as Raw[]).map((r) => ({
        id: r.id,
        removed_at: r.removed_at,
        removal_reason: r.removal_reason,
        price: Number(r.price),
        seller_name: r.seller?.name ?? "—",
        vehicle_label: vehicleLabel({ make: r.make, model: r.model, year: r.year }),
      }));
    },
  });
}
```

- [ ] **Step 2: Build para verificar tipos**

Run: `npm run build`
Expected: build conclui sem erros de TypeScript (saída termina em `vite build` com `✓ built in ...`).

- [ ] **Step 3: Commit**

```bash
git add src/features/admin/queries.ts
git commit -m "feat(admin): hooks useAdminSales e useAdminRemovals (motivos)"
```

---

### Task 2: Componentes de apresentação reutilizáveis

**Files:**
- Create: `src/features/admin/components/MovimentacoesPanels.tsx`

**Interfaces:**
- Consumes: `AdminSaleRow`, `AdminRemovalRow` de `../queries`; `Card`, `Badge` de `@/components/ui-light`; `formatCurrency`, `formatDate` de `@/lib/format`.
- Produces:
  - `ReasonSummary({ rows, reasons }: { rows: { reason: string | null }[]; reasons: readonly string[] })`
  - `SalesReasonTable({ rows, showSeller }: { rows: AdminSaleRow[]; showSeller: boolean })`
  - `RemovalsReasonTable({ rows, showSeller }: { rows: AdminRemovalRow[]; showSeller: boolean })`

- [ ] **Step 1: Criar `src/features/admin/components/MovimentacoesPanels.tsx`**

```tsx
import { Badge, Card } from "@/components/ui-light";
import { formatCurrency, formatDate } from "@/lib/format";
import type { AdminRemovalRow, AdminSaleRow } from "../queries";

const PAYMENT_LABELS: Record<string, string> = {
  cash: "À vista",
  financing: "Financiamento",
  pix: "Pix",
  card: "Cartão",
  transfer: "Transferência",
};

/** Chips "motivo: contagem" do conjunto recebido (já filtrado). Omite zeros. */
export function ReasonSummary({
  rows,
  reasons,
}: {
  rows: { reason: string | null }[];
  reasons: readonly string[];
}) {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const key = r.reason ?? "—";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  // ordem: motivos conhecidos primeiro (na ordem da lista), depois extras/—
  const ordered = [
    ...reasons.filter((r) => counts.has(r)),
    ...[...counts.keys()].filter((k) => !reasons.includes(k)),
  ];
  if (ordered.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {ordered.map((r) => (
        <span
          key={r}
          className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700"
        >
          <span>{r}</span>
          <span className="font-semibold text-slate-900">{counts.get(r)}</span>
        </span>
      ))}
    </div>
  );
}

export function SalesReasonTable({
  rows,
  showSeller,
}: {
  rows: AdminSaleRow[];
  showSeller: boolean;
}) {
  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">Nenhuma venda no período/filtro.</p>;
  }
  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
          <tr>
            <th className="px-5 py-3 font-medium">Data</th>
            <th className="px-5 py-3 font-medium">Veículo</th>
            {showSeller && <th className="px-5 py-3 font-medium">Garagista</th>}
            <th className="px-5 py-3 font-medium">Comprador</th>
            <th className="px-5 py-3 font-medium">Pagamento</th>
            <th className="px-5 py-3 font-medium">Motivo</th>
            <th className="px-5 py-3 text-right font-medium">Valor</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((s) => (
            <tr key={s.id}>
              <td className="px-5 py-3 text-slate-600">{formatDate(s.sale_date)}</td>
              <td className="px-5 py-3 font-medium text-slate-900">{s.vehicle_label}</td>
              {showSeller && <td className="px-5 py-3 text-slate-600">{s.seller_name}</td>}
              <td className="px-5 py-3 text-slate-600">{s.buyer_name}</td>
              <td className="px-5 py-3">
                <Badge tone="sky">{PAYMENT_LABELS[s.payment_method] ?? s.payment_method}</Badge>
              </td>
              <td className="px-5 py-3 text-slate-600">{s.sale_reason ?? "—"}</td>
              <td className="px-5 py-3 text-right font-semibold text-slate-900">
                {formatCurrency(s.sale_price)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

export function RemovalsReasonTable({
  rows,
  showSeller,
}: {
  rows: AdminRemovalRow[];
  showSeller: boolean;
}) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-500">
        Nenhuma remoção no período/filtro.
      </p>
    );
  }
  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
          <tr>
            <th className="px-5 py-3 font-medium">Removido em</th>
            <th className="px-5 py-3 font-medium">Veículo</th>
            {showSeller && <th className="px-5 py-3 font-medium">Garagista</th>}
            <th className="px-5 py-3 font-medium">Motivo</th>
            <th className="px-5 py-3 text-right font-medium">Valor</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((v) => (
            <tr key={v.id}>
              <td className="px-5 py-3 text-slate-600">
                {v.removed_at ? formatDate(v.removed_at) : "—"}
              </td>
              <td className="px-5 py-3 font-medium text-slate-900">{v.vehicle_label}</td>
              {showSeller && <td className="px-5 py-3 text-slate-600">{v.seller_name}</td>}
              <td className="px-5 py-3 text-slate-600">{v.removal_reason ?? "—"}</td>
              <td className="px-5 py-3 text-right font-semibold text-slate-900">
                {formatCurrency(v.price)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
```

> Nota: `PAYMENT_LABELS` é uma duplicação pequena e intencional do mapa privado em `Sales.tsx` (mantém o componente self-contained). Se `formatDate` não aceitar string ISO com hora, ele já é usado assim em `SellerDetail`/`Sales` — seguir o mesmo uso. Confirme os valores reais do enum `payment_method` ao testar visualmente; o fallback `?? s.payment_method` cobre rótulos não mapeados.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: build verde.

- [ ] **Step 3: Commit**

```bash
git add src/features/admin/components/MovimentacoesPanels.tsx
git commit -m "feat(admin): componentes ReasonSummary/Sales/Removals tables"
```

---

### Task 3: Página global "Movimentações" + rota + menu

**Files:**
- Create: `src/features/admin/pages/Movimentacoes.tsx`
- Modify: `src/features/admin/AdminLayout.tsx` (lista de itens de nav)
- Modify: `src/App.tsx` (lazy import + rota dentro do bloco `/dashboard`)

**Interfaces:**
- Consumes: `useAdminSales`, `useAdminRemovals`, `useAdminSellers`, `ReasonFilters` de `../queries`; `ReasonSummary`, `SalesReasonTable`, `RemovalsReasonTable` de `../components/MovimentacoesPanels`; `SALE_REASONS`, `REMOVAL_REASONS` de `@/components/ReasonField`; `PageHeader`, `Card`, `Field`, `Select`, `Input`, `Button`, `Spinner` de `@/components/ui-light`.
- Produces: `export function Movimentacoes()`.

- [ ] **Step 1: Criar `src/features/admin/pages/Movimentacoes.tsx`**

```tsx
import { useState } from "react";
import {
  useAdminRemovals,
  useAdminSales,
  useAdminSellers,
  type ReasonFilters,
} from "../queries";
import {
  RemovalsReasonTable,
  ReasonSummary,
  SalesReasonTable,
} from "../components/MovimentacoesPanels";
import { REMOVAL_REASONS, SALE_REASONS } from "@/components/ReasonField";
import { Button, Card, Field, Input, PageHeader, Select, Spinner } from "@/components/ui-light";

type Tab = "vendas" | "remocoes";

function FiltersBar({
  sellerOptions,
  reasons,
  value,
  onChange,
}: {
  sellerOptions: { id: string; name: string }[];
  reasons: readonly string[];
  value: ReasonFilters;
  onChange: (next: ReasonFilters) => void;
}) {
  return (
    <Card className="flex flex-wrap items-end gap-4">
      <Field label="Garagista">
        <Select
          value={value.sellerId ?? ""}
          onChange={(e) => onChange({ ...value, sellerId: e.target.value || undefined })}
        >
          <option value="">Todos</option>
          {sellerOptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Motivo">
        <Select
          value={value.reason ?? ""}
          onChange={(e) => onChange({ ...value, reason: e.target.value || undefined })}
        >
          <option value="">Todos</option>
          {reasons.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="De">
        <Input
          type="date"
          value={value.from ?? ""}
          onChange={(e) => onChange({ ...value, from: e.target.value || undefined })}
        />
      </Field>
      <Field label="Até">
        <Input
          type="date"
          value={value.to ?? ""}
          onChange={(e) => onChange({ ...value, to: e.target.value || undefined })}
        />
      </Field>
      <Button variant="outline" onClick={() => onChange({})}>
        Limpar
      </Button>
    </Card>
  );
}

function VendasSection() {
  const [filters, setFilters] = useState<ReasonFilters>({});
  const sellersQ = useAdminSellers();
  const salesQ = useAdminSales(filters);
  const rows = salesQ.data ?? [];
  return (
    <div className="flex flex-col gap-4">
      <FiltersBar
        sellerOptions={sellersQ.data ?? []}
        reasons={SALE_REASONS}
        value={filters}
        onChange={setFilters}
      />
      <ReasonSummary rows={rows.map((r) => ({ reason: r.sale_reason }))} reasons={SALE_REASONS} />
      {salesQ.isLoading ? (
        <div className="flex justify-center py-12 text-slate-500">
          <Spinner className="h-6 w-6" />
        </div>
      ) : (
        <SalesReasonTable rows={rows} showSeller />
      )}
    </div>
  );
}

function RemocoesSection() {
  const [filters, setFilters] = useState<ReasonFilters>({});
  const sellersQ = useAdminSellers();
  const removalsQ = useAdminRemovals(filters);
  const rows = removalsQ.data ?? [];
  return (
    <div className="flex flex-col gap-4">
      <FiltersBar
        sellerOptions={sellersQ.data ?? []}
        reasons={REMOVAL_REASONS}
        value={filters}
        onChange={setFilters}
      />
      <ReasonSummary
        rows={rows.map((r) => ({ reason: r.removal_reason }))}
        reasons={REMOVAL_REASONS}
      />
      {removalsQ.isLoading ? (
        <div className="flex justify-center py-12 text-slate-500">
          <Spinner className="h-6 w-6" />
        </div>
      ) : (
        <RemovalsReasonTable rows={rows} showSeller />
      )}
    </div>
  );
}

export function Movimentacoes() {
  const [tab, setTab] = useState<Tab>("vendas");
  return (
    <div>
      <PageHeader title="Movimentações" subtitle="Motivos de venda e de remoção dos garagistas" />
      <div className="mb-4 flex gap-2">
        <Button variant={tab === "vendas" ? "primary" : "outline"} onClick={() => setTab("vendas")}>
          Vendas
        </Button>
        <Button
          variant={tab === "remocoes" ? "primary" : "outline"}
          onClick={() => setTab("remocoes")}
        >
          Remoções
        </Button>
      </div>
      {tab === "vendas" ? <VendasSection /> : <RemocoesSection />}
    </div>
  );
}
```

> Nota: confirme os nomes de `variant` aceitos por `Button` em `@/components/ui-light` (Task usa `"primary"` e `"outline"`; `"outline"` já é usado em `SellerDetail`). Se `"primary"` não existir, usar o variant default (omitir a prop) para a aba ativa e `"outline"` para a inativa.

- [ ] **Step 2: Adicionar item de menu em `src/features/admin/AdminLayout.tsx`**

Inserir logo após a linha do item "Veículos" (`{ to: "/dashboard/veiculos", label: "Veículos", icon: "car" },`):

```tsx
  { to: "/dashboard/movimentacoes", label: "Movimentações", icon: "clock" },
```

- [ ] **Step 3: Registrar a rota em `src/App.tsx`**

Adicionar o lazy import junto aos outros imports de admin (perto de `AdminVehicles`):

```tsx
const AdminMovimentacoes = lazy(() =>
  import("@/features/admin/pages/Movimentacoes").then((m) => ({ default: m.Movimentacoes }))
);
```

Adicionar a rota dentro do bloco `<Route path="/dashboard" ...>`, após `<Route path="veiculos" element={<AdminVehicles />} />`:

```tsx
          <Route path="movimentacoes" element={<AdminMovimentacoes />} />
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: build verde.

- [ ] **Step 5: Commit**

```bash
git add src/features/admin/pages/Movimentacoes.tsx src/features/admin/AdminLayout.tsx src/App.tsx
git commit -m "feat(admin): pagina Movimentacoes (vendas e remocoes com filtros)"
```

---

### Task 4: Cards no SellerDetail (por garagista)

**Files:**
- Modify: `src/features/admin/pages/SellerDetail.tsx`

**Interfaces:**
- Consumes: `useAdminSales`, `useAdminRemovals` de `../queries`; `ReasonSummary`, `SalesReasonTable`, `RemovalsReasonTable` de `../components/MovimentacoesPanels`; `SALE_REASONS`, `REMOVAL_REASONS` de `@/components/ReasonField`; `Card`, `Spinner` (já importados no arquivo).
- Produces: dois componentes locais `SalesReasonCard({ sellerId })` e `RemovalsReasonCard({ sellerId })`, renderizados na coluna de cards do `SellerDetail`.

- [ ] **Step 1: Adicionar imports no topo de `src/features/admin/pages/SellerDetail.tsx`**

```tsx
import { useAdminSales, useAdminRemovals } from "../queries";
import {
  ReasonSummary,
  SalesReasonTable,
  RemovalsReasonTable,
} from "../components/MovimentacoesPanels";
import { SALE_REASONS, REMOVAL_REASONS } from "@/components/ReasonField";
```

(Manter os imports existentes; adicionar `useAdminSales`/`useAdminRemovals` à lista que já vem de `../queries` se preferir consolidar.)

- [ ] **Step 2: Adicionar os dois cards locais (antes da função `SellerDetail`)**

```tsx
function SalesReasonCard({ sellerId }: { sellerId: string }) {
  const { data, isLoading } = useAdminSales({ sellerId });
  const rows = data ?? [];
  return (
    <Card className="p-0">
      <div className="flex items-center justify-between px-6 pt-5">
        <h3 className="text-sm font-semibold text-slate-900">Vendas</h3>
      </div>
      <div className="flex flex-col gap-3 p-6 pt-3">
        {isLoading ? (
          <div className="flex justify-center py-8 text-slate-500">
            <Spinner className="h-5 w-5" />
          </div>
        ) : (
          <>
            <ReasonSummary
              rows={rows.map((r) => ({ reason: r.sale_reason }))}
              reasons={SALE_REASONS}
            />
            <SalesReasonTable rows={rows} showSeller={false} />
          </>
        )}
      </div>
    </Card>
  );
}

function RemovalsReasonCard({ sellerId }: { sellerId: string }) {
  const { data, isLoading } = useAdminRemovals({ sellerId });
  const rows = data ?? [];
  return (
    <Card className="p-0">
      <div className="flex items-center justify-between px-6 pt-5">
        <h3 className="text-sm font-semibold text-slate-900">Veículos removidos</h3>
      </div>
      <div className="flex flex-col gap-3 p-6 pt-3">
        {isLoading ? (
          <div className="flex justify-center py-8 text-slate-500">
            <Spinner className="h-5 w-5" />
          </div>
        ) : (
          <>
            <ReasonSummary
              rows={rows.map((r) => ({ reason: r.removal_reason }))}
              reasons={REMOVAL_REASONS}
            />
            <RemovalsReasonTable rows={rows} showSeller={false} />
          </>
        )}
      </div>
    </Card>
  );
}
```

- [ ] **Step 3: Renderizar os cards na coluna de `SellerDetail`**

Dentro do `<div className="flex flex-col gap-6">` que já contém `StatusCard`/`CommissionsCard`/`ChargesCard`, adicionar após `<ChargesCard sellerId={seller.id} />`:

```tsx
        <SalesReasonCard sellerId={seller.id} />
        <RemovalsReasonCard sellerId={seller.id} />
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: build verde.

- [ ] **Step 5: Commit**

```bash
git add src/features/admin/pages/SellerDetail.tsx
git commit -m "feat(admin): cards de vendas e remocoes no detalhe do garagista"
```

---

## Verificação final (após Task 4)

- [ ] `npm run build` verde.
- [ ] Subir `npm run dev`, logar como admin, abrir `/dashboard/movimentacoes`: abas Vendas/Remoções, filtros (garagista/motivo/de/até), chips de contagem e tabelas com coluna Garagista.
- [ ] Abrir um garagista em `/dashboard/sellers/:id`: cards "Vendas" e "Veículos removidos" com motivo e chips, sem barra de filtros.
- [ ] Deploy conforme rotina do projeto (build estático → rsync VPS → pm2 reload) após o gate verde.

## Self-Review (preenchido na escrita do plano)

- **Cobertura do spec:** hooks com filtros (Task 1) ✓; componentes reutilizáveis + ReasonSummary (Task 2) ✓; página global com menu/rota/filtros/resumo/abas (Task 3) ✓; cards por garagista sem filtros (Task 4) ✓; sem migration/RLS ✓ (Global Constraints); critérios de aceite 1–6 cobertos.
- **Placeholders:** nenhum — todo código presente.
- **Consistência de tipos:** `AdminSaleRow`/`AdminRemovalRow`/`ReasonFilters` definidos na Task 1 e usados com os mesmos nomes nas Tasks 2–4; `ReasonSummary` recebe `{ reason }[]` em todos os call sites (mapeado de `sale_reason`/`removal_reason`).
- **Pontos a confirmar na execução (já anotados nas tasks):** variants do `Button` (`primary`/`outline`), valores reais do enum `payment_method`, comportamento de `formatDate` com ISO+hora. Todos têm fallback seguro.
