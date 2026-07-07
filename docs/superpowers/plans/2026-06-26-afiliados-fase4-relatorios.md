# Afiliados — Fase 4 (relatórios: visão do garagista + visão global do admin) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar os relatórios de afiliados: o garagista vê a visão geral dos afiliados dele (KPIs, ranking, comissões a pagar) e o admin vê a visão global (lista afiliado→garagista, KPIs, rankings, drill-down), ambos com filtros por afiliado/garagista/período.

**Architecture:** Puramente front-end (read-only) — NÃO há migrations nem edge functions. As policies de RLS já existentes escopam os dados (afiliado vê o próprio; garagista vê `parent_id = current_loja()`; admin via `is_admin()` vê tudo). Os relatórios buscam as linhas filtradas (`rv_sales`, `rv_commissions`, `rv_click_events`, `rv_sellers`) e agregam por `affiliate_id` no cliente, reaproveitando um helper puro compartilhado. Segue o padrão de `useAdminSales` (filtros `{from,to,...}` + embeds FK + `keepPreviousData`) e de `useAffiliatePerformance` (agregação client-side).

**Tech Stack:** React + TypeScript + Vite, @tanstack/react-query, supabase-js, componentes `@/components/ui-light` (Card, PageHeader, Select, Input, Badge, Button, Alert, Spinner, EmptyState), `formatCurrency`/`formatDate` de `@/lib/format`.

## Global Constraints

- **Gate de front:** `npm run build` (`tsc -b && vite build`) verde. Sem framework de testes unitários — o "teste" de cada task é o build + a verificação manual leve descrita na task.
- **SEM migrations e SEM edge functions nesta fase.** Tudo é leitura sobre tabelas/colunas que já existem (`rv_sales.affiliate_id`, `rv_commissions.affiliate_id/amount/status`, `rv_click_events.kind/affiliate_id/seller_id/created_at`, `rv_sellers`). NÃO criar arquivos em `supabase/`.
- **Escopo de dados = RLS (não reimplementar no cliente como segurança):** o garagista é escopado por RLS a `parent_id = current_loja()`; mesmo assim, por consistência com o padrão do projeto, filtra-se explicitamente por `seller_id = lojaId` nas queries do garagista (defesa em profundidade). O admin (is_admin) lê global; os filtros do admin são por conveniência, não segurança.
- **Valores de domínio (verbatim):** `kind` de clique = `'affiliate_share'` (compartilhamento) e `'affiliate_link_visit'` (clique recebido). Comissão: `status === 'paid'` é paga; qualquer outro valor conta como pendente (mesma regra de `useAffiliatePerformance`). Sempre `Number(...)` em `sale_price`/`amount` (vêm como string/numeric).
- **Período:** o filtro de período aplica-se a `rv_sales.sale_date`, `rv_click_events.created_at` e `rv_commissions.created_at` (datas ISO `yyyy-mm-dd`, inclusivas: `.gte(from)` / `.lte(to)`).
- **Garagista:** a visão geral é uma SEÇÃO na página existente `src/features/seller/pages/Afiliados.tsx` (gated pelo plano, já é), NÃO uma página nova.
- **Admin:** página NOVA `/dashboard/afiliados` ("Afiliados") no `ADMIN_NAV` de `src/features/admin/AdminLayout.tsx` e rota em `src/App.tsx`. Filtros no padrão da Movimentações.
- **Fora de escopo (YAGNI):** agregação server-side/RPC (o volume atual cabe no cliente, igual aos outros painéis); exportação CSV; gráficos; paginação (limite alto + ordenação no cliente).
- **Deploy:** build → backup → `rsync -az --delete --chown=ubuntu:ubuntu -e "ssh -o BatchMode=yes" dist/ root@72.60.243.106:/var/www/revvio/` → `ssh root@72.60.243.106 'pm2 reload revvio'` → HTTP 200. Sem migrations/edge nesta fase.

---

## File Structure

**Novo:**
- `src/features/affiliate/report.ts` — helper puro `buildAffiliateMetrics` + tipos `AffiliateMetrics` (usado por garagista e admin).
- `src/features/admin/pages/Afiliados.tsx` — página global do admin (filtros, KPIs, tabela, rankings, drill-down).

**Modificado:**
- `src/features/seller/queries.ts` — `useLojaAffiliateReport` (hook do garagista).
- `src/features/seller/pages/Afiliados.tsx` — seção "Visão geral" no topo.
- `src/features/admin/queries.ts` — `useAdminAffiliateReport` (hook global + KPIs + rankings).
- `src/features/admin/AdminLayout.tsx` — item de nav "Afiliados".
- `src/App.tsx` — rota lazy `/dashboard/afiliados`.

---

## Task 1: Helper de agregação + hook do garagista

**Files:**
- Create: `src/features/affiliate/report.ts`
- Modify: `src/features/seller/queries.ts`

**Interfaces:**
- Produces: `AffiliateMetrics` type; `emptyMetrics(): AffiliateMetrics`; `buildAffiliateMetrics(input): Map<string, AffiliateMetrics>`; `AffiliateReportFilters` type; `AffiliateReportRow` type; `useLojaAffiliateReport(lojaId?, filters?): UseQueryResult<AffiliateReportRow[]>`.

- [ ] **Step 1: Criar o helper puro**

Criar `src/features/affiliate/report.ts`:

```ts
// Agregação client-side de métricas de afiliado, compartilhada entre a visão
// do garagista (escopo da loja) e a do admin (global). Puro: sem I/O.

export type AffiliateMetrics = {
  shares: number;
  clicks: number;
  salesCount: number;
  salesVolume: number;
  commissionPending: number;
  commissionPaid: number;
};

export function emptyMetrics(): AffiliateMetrics {
  return {
    shares: 0,
    clicks: 0,
    salesCount: 0,
    salesVolume: 0,
    commissionPending: 0,
    commissionPaid: 0,
  };
}

export type AggInput = {
  sales: { affiliate_id: string | null; sale_price: number | string }[];
  commissions: { affiliate_id: string | null; amount: number | string; status: string }[];
  clicks: { affiliate_id: string | null; kind: string }[];
};

/** Soma métricas por affiliate_id. Linhas com affiliate_id nulo são ignoradas. */
export function buildAffiliateMetrics(input: AggInput): Map<string, AffiliateMetrics> {
  const m = new Map<string, AffiliateMetrics>();
  const get = (id: string): AffiliateMetrics => {
    let x = m.get(id);
    if (!x) {
      x = emptyMetrics();
      m.set(id, x);
    }
    return x;
  };
  for (const s of input.sales) {
    if (!s.affiliate_id) continue;
    const x = get(s.affiliate_id);
    x.salesCount += 1;
    x.salesVolume += Number(s.sale_price);
  }
  for (const c of input.commissions) {
    if (!c.affiliate_id) continue;
    const x = get(c.affiliate_id);
    if (c.status === "paid") x.commissionPaid += Number(c.amount);
    else x.commissionPending += Number(c.amount);
  }
  for (const e of input.clicks) {
    if (!e.affiliate_id) continue;
    const x = get(e.affiliate_id);
    if (e.kind === "affiliate_share") x.shares += 1;
    else if (e.kind === "affiliate_link_visit") x.clicks += 1;
  }
  return m;
}
```

- [ ] **Step 2: Adicionar o hook do garagista**

Em `src/features/seller/queries.ts`, adicionar (perto dos outros hooks de afiliado; confirme que `buildAffiliateMetrics`/`emptyMetrics`/`AffiliateMetrics` são importados de `@/features/affiliate/report`):

```ts
export type AffiliateReportFilters = { affiliateId?: string; from?: string; to?: string };

export type AffiliateReportRow = AffiliateMetrics & {
  affiliateId: string;
  name: string;
  status: string;
  rate: number;
};

/** Visão geral dos afiliados da loja (agregada). RLS já escopa à loja; filtra
 *  explicitamente por seller_id=lojaId por consistência/defesa em profundidade. */
export function useLojaAffiliateReport(
  lojaId?: string,
  filters: AffiliateReportFilters = {}
): UseQueryResult<AffiliateReportRow[]> {
  const { affiliateId, from, to } = filters;
  return useQuery({
    queryKey: ["loja-affiliate-report", lojaId, affiliateId ?? null, from ?? null, to ?? null],
    enabled: !!lojaId,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let salesQ = supabase
        .from("rv_sales")
        .select("affiliate_id, sale_price")
        .eq("seller_id", lojaId!)
        .not("affiliate_id", "is", null);
      let commsQ = supabase
        .from("rv_commissions")
        .select("affiliate_id, amount, status")
        .eq("seller_id", lojaId!)
        .not("affiliate_id", "is", null);
      let clicksQ = supabase
        .from("rv_click_events")
        .select("affiliate_id, kind")
        .eq("seller_id", lojaId!)
        .in("kind", ["affiliate_share", "affiliate_link_visit"]);
      if (affiliateId) {
        salesQ = salesQ.eq("affiliate_id", affiliateId);
        commsQ = commsQ.eq("affiliate_id", affiliateId);
        clicksQ = clicksQ.eq("affiliate_id", affiliateId);
      }
      if (from) {
        salesQ = salesQ.gte("sale_date", from);
        commsQ = commsQ.gte("created_at", from);
        clicksQ = clicksQ.gte("created_at", from);
      }
      if (to) {
        salesQ = salesQ.lte("sale_date", to);
        commsQ = commsQ.lte("created_at", to);
        clicksQ = clicksQ.lte("created_at", to);
      }
      const affQ = supabase
        .from("rv_sellers")
        .select("id, name, status, commission_rate")
        .eq("parent_id", lojaId!)
        .eq("role", "afiliado");

      const [sales, comms, clicks, affs] = await Promise.all([salesQ, commsQ, clicksQ, affQ]);
      for (const r of [sales, comms, clicks, affs]) if (r.error) throw r.error;

      const metrics = buildAffiliateMetrics({
        sales: (sales.data ?? []) as AggRow["sales"],
        commissions: (comms.data ?? []) as AggRow["commissions"],
        clicks: (clicks.data ?? []) as AggRow["clicks"],
      });
      type AffRaw = { id: string; name: string; status: string; commission_rate: number };
      let rows = ((affs.data ?? []) as AffRaw[]).map((a) => ({
        affiliateId: a.id,
        name: a.name,
        status: a.status,
        rate: Number(a.commission_rate),
        ...(metrics.get(a.id) ?? emptyMetrics()),
      }));
      if (affiliateId) rows = rows.filter((r) => r.affiliateId === affiliateId);
      return rows.sort((x, y) => y.salesVolume - x.salesVolume);
    },
  });
}
```

> Use o tipo do helper para os casts: importe `type { AggInput } from "@/features/affiliate/report"` e troque `AggRow["sales"]` etc. por `AggInput["sales"]`/`AggInput["commissions"]`/`AggInput["clicks"]`. Se algum `.select()` exigir cast por tipagem do supabase, use `as unknown as AggInput["..."]`. Confirme que `keepPreviousData` já está importado no arquivo (é usado por outros hooks); se não, importe de `@tanstack/react-query`.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build verde.

- [ ] **Step 4: Commit**

```bash
git add src/features/affiliate/report.ts src/features/seller/queries.ts
git commit -m "feat(affiliate): helper de metricas + hook de relatorio do garagista"
```

---

## Task 2: Seção "Visão geral" na página Afiliados do garagista

**Files:**
- Modify: `src/features/seller/pages/Afiliados.tsx`

**Interfaces:**
- Consumes: `useLojaAffiliateReport(lojaId, {affiliateId?, from?, to?})`, `AffiliateReportRow` (Task 1).

- [ ] **Step 1: Renderizar a seção com filtros + KPIs + tabela**

Em `src/features/seller/pages/Afiliados.tsx`, importar `useLojaAffiliateReport` de `../queries`, `formatCurrency` de `@/lib/format`, e `useState`. Adicionar estado de filtro e a seção ACIMA do CRUD/lista existente:

```tsx
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [affiliateId, setAffiliateId] = useState("");
  const report = useLojaAffiliateReport(lojaId ?? undefined, {
    affiliateId: affiliateId || undefined,
    from: from || undefined,
    to: to || undefined,
  });
  const rows = report.data ?? [];
  const totals = rows.reduce(
    (acc, r) => ({
      salesCount: acc.salesCount + r.salesCount,
      salesVolume: acc.salesVolume + r.salesVolume,
      commissionPending: acc.commissionPending + r.commissionPending,
    }),
    { salesCount: 0, salesVolume: 0, commissionPending: 0 }
  );
```

E o JSX da seção (use os afiliados já carregados na página para o dropdown — a página já tem a lista de afiliados via `useAffiliates`; reaproveite essa data para popular o `<Select>`):

```tsx
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Visão geral dos afiliados</h2>
        <div className="mb-4 flex flex-wrap gap-3">
          <Select value={affiliateId} onChange={(e) => setAffiliateId(e.target.value)}>
            <option value="">Todos os afiliados</option>
            {(affiliates.data ?? []).map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </Select>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
          <Card className="p-4"><p className="text-xs uppercase text-slate-500">Vendas geradas</p><p className="mt-1 text-2xl font-semibold">{totals.salesCount}</p></Card>
          <Card className="p-4"><p className="text-xs uppercase text-slate-500">Volume</p><p className="mt-1 text-2xl font-semibold">{formatCurrency(totals.salesVolume)}</p></Card>
          <Card className="p-4"><p className="text-xs uppercase text-slate-500">Comissões a pagar</p><p className="mt-1 text-2xl font-semibold">{formatCurrency(totals.commissionPending)}</p></Card>
        </div>
        {report.isError ? (
          <Alert variant="error">Não foi possível carregar o relatório.</Alert>
        ) : report.isLoading ? (
          <div className="flex justify-center py-8 text-slate-500"><Spinner className="h-5 w-5" /></div>
        ) : rows.length === 0 ? (
          <EmptyState title="Sem dados" description="Nenhum afiliado com atividade no período." />
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-hair text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Afiliado</th>
                  <th className="px-4 py-3 font-medium">Comp.</th>
                  <th className="px-4 py-3 font-medium">Cliques</th>
                  <th className="px-4 py-3 font-medium">Vendas</th>
                  <th className="px-4 py-3 font-medium">Volume</th>
                  <th className="px-4 py-3 font-medium">Com. pend.</th>
                  <th className="px-4 py-3 font-medium">Com. paga</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.affiliateId} className="border-b border-hair last:border-0">
                    <td className="px-4 py-3 font-medium text-slate-900">{r.name}</td>
                    <td className="px-4 py-3">{r.shares}</td>
                    <td className="px-4 py-3">{r.clicks}</td>
                    <td className="px-4 py-3">{r.salesCount}</td>
                    <td className="px-4 py-3">{formatCurrency(r.salesVolume)}</td>
                    <td className="px-4 py-3">{formatCurrency(r.commissionPending)}</td>
                    <td className="px-4 py-3">{formatCurrency(r.commissionPaid)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>
```

Confirme que `Select`, `Input`, `Card`, `Alert`, `Spinner`, `EmptyState` estão importados de `@/components/ui-light` (adicione os que faltarem).

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: build verde.

- [ ] **Step 3: Verificação manual leve**

Como garagista com afiliados que geraram venda: a seção mostra KPIs e a tabela ordenada por volume; filtrar por afiliado e por período altera os números.

- [ ] **Step 4: Commit**

```bash
git add src/features/seller/pages/Afiliados.tsx
git commit -m "feat(seller): secao visao geral dos afiliados (KPIs + tabela + filtros)"
```

---

## Task 3: Hook global do admin (linhas + KPIs + rankings)

**Files:**
- Modify: `src/features/admin/queries.ts`

**Interfaces:**
- Consumes: `buildAffiliateMetrics`, `emptyMetrics`, `AffiliateMetrics`, `AggInput` (Task 1).
- Produces: `AdminAffiliateFilters`, `AdminAffiliateRow`, `AdminAffiliateReport`, `useAdminAffiliateReport(filters?): UseQueryResult<AdminAffiliateReport>`.

- [ ] **Step 1: Adicionar o hook**

Em `src/features/admin/queries.ts` (importe os helpers/types de `@/features/affiliate/report`):

```ts
export type AdminAffiliateFilters = {
  garagistaId?: string;
  affiliateId?: string;
  from?: string;
  to?: string;
};

export type AdminAffiliateRow = AffiliateMetrics & {
  affiliateId: string;
  name: string;
  status: string;
  rate: number;
  garagistaId: string;
  garagistaName: string;
};

export type AdminAffiliateReport = {
  rows: AdminAffiliateRow[];
  kpis: {
    totalSalesCount: number;
    totalSalesVolume: number;
    activeAffiliates: number;
    commissionPending: number;
  };
  topByVolume: AdminAffiliateRow[]; // top 5
  topByCount: AdminAffiliateRow[];  // top 5
  topGaragistas: { garagistaId: string; garagistaName: string; salesCount: number; salesVolume: number }[]; // top 5
};

/** Relatório global de afiliados (admin: is_admin lê tudo). */
export function useAdminAffiliateReport(
  filters: AdminAffiliateFilters = {}
): UseQueryResult<AdminAffiliateReport> {
  const { garagistaId, affiliateId, from, to } = filters;
  return useQuery({
    queryKey: ["admin-affiliate-report", garagistaId ?? null, affiliateId ?? null, from ?? null, to ?? null],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let salesQ = supabase.from("rv_sales").select("affiliate_id, sale_price, seller_id").not("affiliate_id", "is", null);
      let commsQ = supabase.from("rv_commissions").select("affiliate_id, amount, status").not("affiliate_id", "is", null);
      let clicksQ = supabase.from("rv_click_events").select("affiliate_id, kind").in("kind", ["affiliate_share", "affiliate_link_visit"]);
      let affQ = supabase.from("rv_sellers").select("id, name, status, commission_rate, parent_id").eq("role", "afiliado");

      if (garagistaId) {
        salesQ = salesQ.eq("seller_id", garagistaId);
        clicksQ = clicksQ.eq("seller_id", garagistaId);
        affQ = affQ.eq("parent_id", garagistaId);
      }
      if (affiliateId) {
        salesQ = salesQ.eq("affiliate_id", affiliateId);
        commsQ = commsQ.eq("affiliate_id", affiliateId);
        clicksQ = clicksQ.eq("affiliate_id", affiliateId);
      }
      if (from) { salesQ = salesQ.gte("sale_date", from); commsQ = commsQ.gte("created_at", from); clicksQ = clicksQ.gte("created_at", from); }
      if (to) { salesQ = salesQ.lte("sale_date", to); commsQ = commsQ.lte("created_at", to); clicksQ = clicksQ.lte("created_at", to); }

      // nomes de garagistas (lojas): role garagista/admin
      const garQ = supabase.from("rv_sellers").select("id, name").in("role", ["garagista", "admin"]);

      const [sales, comms, clicks, affs, gars] = await Promise.all([salesQ, commsQ, clicksQ, affQ, garQ]);
      for (const r of [sales, comms, clicks, affs, gars]) if (r.error) throw r.error;

      const metrics = buildAffiliateMetrics({
        sales: (sales.data ?? []) as AggInput["sales"],
        commissions: (comms.data ?? []) as AggInput["commissions"],
        clicks: (clicks.data ?? []) as AggInput["clicks"],
      });
      const garName = new Map<string, string>();
      for (const g of (gars.data ?? []) as { id: string; name: string }[]) garName.set(g.id, g.name);

      type AffRaw = { id: string; name: string; status: string; commission_rate: number; parent_id: string | null };
      let rows: AdminAffiliateRow[] = ((affs.data ?? []) as AffRaw[]).map((a) => ({
        affiliateId: a.id,
        name: a.name,
        status: a.status,
        rate: Number(a.commission_rate),
        garagistaId: a.parent_id ?? "",
        garagistaName: a.parent_id ? garName.get(a.parent_id) ?? "—" : "—",
        ...(metrics.get(a.id) ?? emptyMetrics()),
      }));
      if (affiliateId) rows = rows.filter((r) => r.affiliateId === affiliateId);
      rows.sort((x, y) => y.salesVolume - x.salesVolume);

      const kpis = {
        totalSalesCount: rows.reduce((a, r) => a + r.salesCount, 0),
        totalSalesVolume: rows.reduce((a, r) => a + r.salesVolume, 0),
        activeAffiliates: rows.filter((r) => r.status === "active").length,
        commissionPending: rows.reduce((a, r) => a + r.commissionPending, 0),
      };
      const topByVolume = [...rows].sort((a, b) => b.salesVolume - a.salesVolume).slice(0, 5);
      const topByCount = [...rows].sort((a, b) => b.salesCount - a.salesCount).slice(0, 5);
      const garAgg = new Map<string, { garagistaId: string; garagistaName: string; salesCount: number; salesVolume: number }>();
      for (const r of rows) {
        if (!r.garagistaId) continue;
        let g = garAgg.get(r.garagistaId);
        if (!g) { g = { garagistaId: r.garagistaId, garagistaName: r.garagistaName, salesCount: 0, salesVolume: 0 }; garAgg.set(r.garagistaId, g); }
        g.salesCount += r.salesCount;
        g.salesVolume += r.salesVolume;
      }
      const topGaragistas = [...garAgg.values()].sort((a, b) => b.salesVolume - a.salesVolume).slice(0, 5);

      return { rows, kpis, topByVolume, topByCount, topGaragistas };
    },
  });
}
```

> Confirme `keepPreviousData` importado no arquivo (já é usado por `useAdminSales`).

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: build verde.

- [ ] **Step 3: Commit**

```bash
git add src/features/admin/queries.ts
git commit -m "feat(admin): hook de relatorio global de afiliados (linhas+KPIs+rankings)"
```

---

## Task 4: Página do admin — rota, nav, filtros, KPIs e tabela

**Files:**
- Create: `src/features/admin/pages/Afiliados.tsx`
- Modify: `src/features/admin/AdminLayout.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `useAdminAffiliateReport` (Task 3). Para os dropdowns de filtro: lista de garagistas e de afiliados — reaproveite `useSellers`/equivalente do admin (ver `admin/queries.ts`); se não houver um hook pronto, filtre a própria `report.data.rows` para o dropdown de afiliados e use uma query simples de garagistas.

- [ ] **Step 1: Criar a página (filtros + KPIs + tabela afiliado→garagista)**

Criar `src/features/admin/pages/Afiliados.tsx`:

```tsx
import { useState } from "react";
import { useAdminAffiliateReport } from "../queries";
import { Card, PageHeader, Select, Input, Badge, Alert, Spinner, EmptyState } from "@/components/ui-light";
import { formatCurrency } from "@/lib/format";

export function Afiliados() {
  const [garagistaId, setGaragistaId] = useState("");
  const [affiliateId, setAffiliateId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const q = useAdminAffiliateReport({
    garagistaId: garagistaId || undefined,
    affiliateId: affiliateId || undefined,
    from: from || undefined,
    to: to || undefined,
  });
  const data = q.data;
  const rows = data?.rows ?? [];
  // opções de dropdown derivadas (sem filtro de afiliado aplicado, garagista pode estar aplicado)
  const garagistas = Array.from(
    new Map(rows.map((r) => [r.garagistaId, r.garagistaName])).entries()
  ).filter(([id]) => id);

  return (
    <div>
      <PageHeader title="Afiliados" subtitle="Visão global dos afiliados de todos os garagistas" />
      <div className="mb-4 flex flex-wrap gap-3">
        <Select value={garagistaId} onChange={(e) => { setGaragistaId(e.target.value); setAffiliateId(""); }}>
          <option value="">Todos os garagistas</option>
          {garagistas.map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </Select>
        <Select value={affiliateId} onChange={(e) => setAffiliateId(e.target.value)}>
          <option value="">Todos os afiliados</option>
          {rows.map((r) => (
            <option key={r.affiliateId} value={r.affiliateId}>{r.name}</option>
          ))}
        </Select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>

      {q.isError ? (
        <Alert variant="error">Não foi possível carregar o relatório.</Alert>
      ) : q.isLoading || !data ? (
        <div className="flex justify-center py-16 text-slate-500"><Spinner className="h-6 w-6" /></div>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card className="p-4"><p className="text-xs uppercase text-slate-500">Vendas por afiliados</p><p className="mt-1 text-2xl font-semibold">{data.kpis.totalSalesCount}</p></Card>
            <Card className="p-4"><p className="text-xs uppercase text-slate-500">Volume (R$)</p><p className="mt-1 text-2xl font-semibold">{formatCurrency(data.kpis.totalSalesVolume)}</p></Card>
            <Card className="p-4"><p className="text-xs uppercase text-slate-500">Afiliados ativos</p><p className="mt-1 text-2xl font-semibold">{data.kpis.activeAffiliates}</p></Card>
            <Card className="p-4"><p className="text-xs uppercase text-slate-500">Comissões a pagar</p><p className="mt-1 text-2xl font-semibold">{formatCurrency(data.kpis.commissionPending)}</p></Card>
          </div>

          {rows.length === 0 ? (
            <EmptyState title="Sem dados" description="Nenhum afiliado com atividade no período/filtro." />
          ) : (
            <Card className="overflow-x-auto p-0">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-hair text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Afiliado</th>
                    <th className="px-4 py-3 font-medium">Garagista</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Taxa</th>
                    <th className="px-4 py-3 font-medium">Cliques</th>
                    <th className="px-4 py-3 font-medium">Vendas</th>
                    <th className="px-4 py-3 font-medium">Volume</th>
                    <th className="px-4 py-3 font-medium">Com. pend.</th>
                    <th className="px-4 py-3 font-medium">Com. paga</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.affiliateId} className="border-b border-hair last:border-0">
                      <td className="px-4 py-3 font-medium text-slate-900">{r.name}</td>
                      <td className="px-4 py-3 text-slate-600">{r.garagistaName}</td>
                      <td className="px-4 py-3"><Badge tone={r.status === "active" ? "green" : "slate"}>{r.status}</Badge></td>
                      <td className="px-4 py-3">{r.rate}%</td>
                      <td className="px-4 py-3">{r.clicks}</td>
                      <td className="px-4 py-3">{r.salesCount}</td>
                      <td className="px-4 py-3">{formatCurrency(r.salesVolume)}</td>
                      <td className="px-4 py-3">{formatCurrency(r.commissionPending)}</td>
                      <td className="px-4 py-3">{formatCurrency(r.commissionPaid)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
```

> Confirme o conjunto de props `tone` aceitos por `Badge` em `@/components/ui-light` (use valores existentes, ex.: `"green"`/`"slate"`/`"sky"`; ajuste se os nomes diferirem). Confirme que `Select`/`Input`/`EmptyState` são exportados de ui-light (são usados em outras telas).

- [ ] **Step 2: Adicionar o item de nav**

Em `src/features/admin/AdminLayout.tsx`, no array `ADMIN_NAV`, adicionar (depois de "Planos" ou de "Movimentações"):

```ts
  { to: "/dashboard/afiliados", label: "Afiliados", icon: "users" },
```

- [ ] **Step 3: Registrar a rota**

Em `src/App.tsx`, adicionar o lazy import (perto dos outros `Admin*`):

```ts
const AdminAfiliados = lazy(() =>
  import("@/features/admin/pages/Afiliados").then((m) => ({ default: m.Afiliados }))
);
```
E a rota dentro do bloco de rotas do admin (perto de `movimentacoes`):
```tsx
          <Route path="afiliados" element={<AdminAfiliados />} />
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: build verde.

- [ ] **Step 5: Verificação manual leve**

Como admin, abrir `/dashboard/afiliados`: KPIs e tabela global aparecem; filtros por garagista/afiliado/período alteram os números; rota e item de menu funcionam.

- [ ] **Step 6: Commit**

```bash
git add src/features/admin/pages/Afiliados.tsx src/features/admin/AdminLayout.tsx src/App.tsx
git commit -m "feat(admin): pagina global de afiliados (rota+nav+filtros+KPIs+tabela)"
```

---

## Task 5: Admin — rankings + drill-down por afiliado

**Files:**
- Modify: `src/features/admin/pages/Afiliados.tsx`

**Interfaces:**
- Consumes: `data.topByVolume`, `data.topByCount`, `data.topGaragistas` (Task 3); `data.rows` (drill-down expande a linha de um afiliado mostrando suas vendas).

- [ ] **Step 1: Seção de rankings**

Em `src/features/admin/pages/Afiliados.tsx`, ENTRE os KPIs e a tabela, adicionar três cartões de ranking (top 5):

```tsx
          <div className="mb-5 grid grid-cols-1 gap-3 lg:grid-cols-3">
            <Card className="p-4">
              <p className="mb-2 text-xs uppercase text-slate-500">Top afiliados — volume</p>
              {data.topByVolume.filter((r) => r.salesVolume > 0).length === 0 ? (
                <p className="text-sm text-slate-400">Sem vendas no período.</p>
              ) : (
                <ol className="flex flex-col gap-1 text-sm">
                  {data.topByVolume.filter((r) => r.salesVolume > 0).map((r, i) => (
                    <li key={r.affiliateId} className="flex justify-between">
                      <span className="truncate">{i + 1}. {r.name}</span>
                      <span className="font-medium">{formatCurrency(r.salesVolume)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
            <Card className="p-4">
              <p className="mb-2 text-xs uppercase text-slate-500">Top afiliados — nº de vendas</p>
              {data.topByCount.filter((r) => r.salesCount > 0).length === 0 ? (
                <p className="text-sm text-slate-400">Sem vendas no período.</p>
              ) : (
                <ol className="flex flex-col gap-1 text-sm">
                  {data.topByCount.filter((r) => r.salesCount > 0).map((r, i) => (
                    <li key={r.affiliateId} className="flex justify-between">
                      <span className="truncate">{i + 1}. {r.name}</span>
                      <span className="font-medium">{r.salesCount}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
            <Card className="p-4">
              <p className="mb-2 text-xs uppercase text-slate-500">Garagistas que mais usam afiliados</p>
              {data.topGaragistas.filter((g) => g.salesVolume > 0).length === 0 ? (
                <p className="text-sm text-slate-400">Sem vendas no período.</p>
              ) : (
                <ol className="flex flex-col gap-1 text-sm">
                  {data.topGaragistas.filter((g) => g.salesVolume > 0).map((g, i) => (
                    <li key={g.garagistaId} className="flex justify-between">
                      <span className="truncate">{i + 1}. {g.garagistaName}</span>
                      <span className="font-medium">{formatCurrency(g.salesVolume)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          </div>
```

- [ ] **Step 2: Drill-down (linha clicável → vendas do afiliado)**

O drill-down mostra as vendas individuais de um afiliado. Reaproveite o `useAdminSales` existente (em `admin/queries.ts`) que já aceita filtros; ele não filtra por `affiliate_id`, então adicione um filtro opcional `affiliateId` a `ReasonFilters`/`useAdminSales` OU crie um hook enxuto. Caminho recomendado (mínimo): estender `ReasonFilters` com `affiliateId?: string` e, em `useAdminSales`, aplicar `if (affiliateId) q = q.eq("affiliate_id", affiliateId)`. Depois, na página, ao clicar numa linha da tabela, alternar um estado `expandedId` e, quando setado, renderizar abaixo da tabela um cartão com as vendas (`useAdminSales({ affiliateId: expandedId, from, to })`): comprador, veículo, valor, data.

Implemente:
1. Em `admin/queries.ts`: adicionar `affiliateId?: string` ao tipo `ReasonFilters`; em `useAdminSales`, incluir no `queryKey` e aplicar `if (affiliateId) q = q.eq("affiliate_id", affiliateId)`.
2. Em `Afiliados.tsx`: `const [expandedId, setExpandedId] = useState<string | null>(null);`, tornar cada `<tr>` clicável (`onClick={() => setExpandedId(expandedId === r.affiliateId ? null : r.affiliateId)}` + `className` com `cursor-pointer`), e abaixo da tabela:
```tsx
          {expandedId && (
            <AffiliateSalesDrill affiliateId={expandedId} from={from} to={to} name={rows.find((r) => r.affiliateId === expandedId)?.name ?? ""} />
          )}
```
3. Componente `AffiliateSalesDrill` no mesmo arquivo:
```tsx
function AffiliateSalesDrill({ affiliateId, from, to, name }: { affiliateId: string; from: string; to: string; name: string }) {
  const salesQ = useAdminSales({ affiliateId, from: from || undefined, to: to || undefined });
  const sales = salesQ.data ?? [];
  return (
    <Card className="mt-4 p-4">
      <p className="mb-3 text-sm font-semibold text-slate-900">Vendas de {name}</p>
      {salesQ.isLoading ? (
        <div className="flex justify-center py-6 text-slate-500"><Spinner className="h-5 w-5" /></div>
      ) : sales.length === 0 ? (
        <p className="text-sm text-slate-400">Nenhuma venda no período.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="border-b border-hair text-xs uppercase text-slate-500">
            <tr><th className="px-3 py-2 font-medium">Data</th><th className="px-3 py-2 font-medium">Comprador</th><th className="px-3 py-2 font-medium">Veículo</th><th className="px-3 py-2 font-medium">Valor</th></tr>
          </thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id} className="border-b border-hair last:border-0">
                <td className="px-3 py-2">{formatDate(s.sale_date)}</td>
                <td className="px-3 py-2">{s.buyer_name}</td>
                <td className="px-3 py-2">{s.vehicle_label}</td>
                <td className="px-3 py-2">{formatCurrency(s.sale_price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
```
Importar `useAdminSales` de `../queries` e `formatDate` de `@/lib/format`.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build verde.

- [ ] **Step 4: Verificação manual leve**

Rankings mostram top 5 por volume/qtd/garagista; clicar numa linha da tabela expande as vendas daquele afiliado; clicar de novo recolhe.

- [ ] **Step 5: Commit**

```bash
git add src/features/admin/pages/Afiliados.tsx src/features/admin/queries.ts
git commit -m "feat(admin): rankings + drill-down de vendas por afiliado"
```

---

## Task 6: Deploy (build + VPS + push)

**Files:** nenhum (deploy).

- [ ] **Step 1: Build de produção**

Run: `npm run build`
Expected: verde. Conferir `dist/assets/index-*.js` aponta para `ahtisetxygjyfvhguckl.supabase.co` (não `127.0.0.1` como endpoint).

- [ ] **Step 2: Deploy VPS**

```bash
ssh -o BatchMode=yes root@72.60.243.106 "cp -a /var/www/revvio /var/www/revvio.bak-$(date +%Y%m%d-%H%M)"
rsync -az --delete --chown=ubuntu:ubuntu -e "ssh -o BatchMode=yes" dist/ root@72.60.243.106:/var/www/revvio/
ssh -o BatchMode=yes root@72.60.243.106 'pm2 reload revvio'
```

- [ ] **Step 3: Verificar**

```bash
ssh -o BatchMode=yes root@72.60.243.106 "curl -s -o /dev/null -w '%{http_code}' localhost:3115/"
```
Expected: `200`; bundle servido == hash local.

- [ ] **Step 4: Push**

```bash
git push origin main
```

> SEM migrations e SEM edge functions nesta fase — nada a aplicar no remoto além do front.

---

## Self-Review (cobertura do spec)

- **AC#7 (garagista vê visão geral dos afiliados dele, escopada à loja, com KPIs/ranking/comissões a pagar + filtros afiliado/período):** Tasks 1+2. ✓
- **AC#8 (admin vê visão global: lista afiliado→garagista, KPIs de vendas geradas, rankings por volume/qtd + garagistas que mais usam, drill-down, filtros garagista/afiliado/período):** Tasks 3+4+5. ✓
- **AC#9 (RLS garante escopo; build verde):** garantido pelas policies já existentes (Fase 1/2B); cada task termina com build verde. ✓
- **Reuso/DRY:** `buildAffiliateMetrics` compartilhado entre garagista e admin (Task 1). ✓
- **Sem over-build:** sem RPC de agregação, sem CSV, sem gráficos (YAGNI, conforme Global Constraints).
- **Decisão de período em comissões:** aplicado a `created_at` de `rv_commissions` (consistente com sales/clicks). "Comissões a pagar" reflete o que foi gerado no período filtrado; sem filtro de data = tudo. Documentar na verificação.

## Notas

- Confirmar nomes exatos de props de `Badge` (`tone`) e exports de ui-light antes de usar; ajustar aos valores existentes.
- Os dropdowns de filtro do admin derivam as opções de `report.data.rows`; quando um filtro de garagista está aplicado, o dropdown de afiliados mostra só os daquele garagista (comportamento aceitável). Se o produto quiser sempre a lista completa, trocar por queries dedicadas de garagistas/afiliados — fora do escopo mínimo.
