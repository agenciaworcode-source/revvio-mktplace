# Fase D — Painel do Vendedor (modo limitado) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o vendedor operar no `/painel` com o estoque compartilhado da loja e ver apenas as próprias vendas/comissões, com a navegação reduzida.

**Architecture:** As telas do painel passam a escopar veículos/vendas pela **loja** (`lojaId`), não pela pessoa — o RLS já estreita o que cada papel enxerga (vendedor vê só as próprias vendas/comissões; catálogo é público; estoque é da loja). O Dashboard e a navegação se adaptam ao papel.

**Tech Stack:** React 18 · TypeScript · TanStack Query · Supabase JS.

## Global Constraints

- Build verde obrigatório por task: `npx tsc -b` (0) e `npm run build` (0).
- **Preservar a UI do `/dashboard` (admin)** — Fase D só toca o `/painel`.
- `useAuth()` expõe `lojaId` (loja), `personId` (a própria linha), `isVendedor`, `isGaragista`, `isAdmin`.
- Estoque (`rv_vehicles.seller_id`) e vendas/comissões (`rv_sales.seller_id`/`rv_commissions.seller_id`) são escopados pela **loja** = `lojaId`. O RLS (Fase A) estreita por papel: o vendedor só lê as próprias vendas/comissões; o estoque é público; uploads de mídia vão para a pasta `<lojaId>/`.
- Não alterar regras de RLS nesta fase (apenas o front passa a usar `lojaId`).

---

### Task D1: Escopar estoque e vendas pela loja (não pela pessoa)

**Files:**
- Modify: `src/features/seller/pages/Vehicles.tsx`
- Modify: `src/features/seller/pages/Sales.tsx`
- Modify: `src/features/seller/pages/Dashboard.tsx`

**Interfaces:**
- Consumes: `useAuth().lojaId`; `useVehicles`/`useSaveVehicle`/`useDeleteVehicle`/`useSales`/`useRegisterSale` (já existentes, recebem o id da loja).
- Produces: todas as telas do painel passam a usar `lojaId` para veículos/vendas e para a pasta de upload. Comportamento do garagista é idêntico (para ele `lojaId === seller.id`); o vendedor passa a ver o estoque/registrar venda na loja.

- [ ] **Step 1: Vehicles.tsx — usar lojaId no form e na lista**

Em `src/features/seller/pages/Vehicles.tsx`:

(a) no editor (por volta da linha 101), trocar:

```tsx
  const { seller, lojaId } = useAuth();
  const save = useSaveVehicle(lojaId ?? undefined);
```

(b) no upload (por volta da linha 116-123), usar a pasta da loja:

```tsx
  async function handleFiles(files: FileList | null) {
    if (!files?.length || !lojaId) return;
    setUploading(true);
    setError(null);
    try {
      const urls = await Promise.all(
        Array.from(files).map((f) => uploadMedia("vehicle-images", lojaId, f))
      );
      setImages((prev) => [...prev, ...urls]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha no upload da imagem.");
    } finally {
      setUploading(false);
    }
  }
```

(c) na lista (por volta da linha 314-316), trocar:

```tsx
  const { lojaId } = useAuth();
  const { data, isLoading } = useVehicles(lojaId ?? undefined);
  const remove = useDeleteVehicle(lojaId ?? undefined);
```

(Se o componente da lista ainda referenciar `seller` em outro ponto, manter o que for necessário; o objetivo é só trocar a fonte do id para `lojaId`.)

- [ ] **Step 2: Sales.tsx — usar lojaId para veículos/vendas/registro**

Em `src/features/seller/pages/Sales.tsx`:

(a) no `RegisterSaleForm` (por volta da linha 43-47):

```tsx
  const { seller, personId, lojaId, isVendedor } = useAuth();
  const vehicles = useVehicles(lojaId ?? undefined);
  const team = useTeam(lojaId ?? undefined);
  const register_ = useRegisterSale(lojaId ?? undefined);
```

(b) na lista de vendas (por volta da linha 184):

```tsx
  const { lojaId } = useAuth();
  const { data, isLoading } = useSales(lojaId ?? undefined);
```

- [ ] **Step 3: Dashboard.tsx — veículos/vendas pela loja**

Em `src/features/seller/pages/Dashboard.tsx` (por volta da linha 22-25):

```tsx
  const { seller, lojaId, personId, isVendedor } = useAuth();
  const vehicles = useVehicles(lojaId ?? undefined);
  const sales = useSales(lojaId ?? undefined);
  const commissions = useCommissions(
    (isVendedor ? personId : lojaId) ?? undefined
  );
```

(O ajuste fino de rótulo das comissões fica na Task D2; aqui só corrige a fonte dos dados.)

- [ ] **Step 4: Verificar build verde**

Run: `npx tsc -b && npm run build`
Expected: ambos exit 0.

- [ ] **Step 5: Regressão de isolamento (RLS continua válido)**

Run: `docker exec -i $(docker ps -qf name=supabase_db) psql -U postgres -d postgres -v ON_ERROR_STOP=1 < docs/superpowers/tests/a3_rls_test.sql`
Expected: `✅ A3 RLS 3 níveis OK` (o front mudou, o RLS que garante o isolamento não — confirmamos que segue verde).

- [ ] **Step 6: Commit**

```bash
git add src/features/seller/pages/Vehicles.tsx src/features/seller/pages/Sales.tsx src/features/seller/pages/Dashboard.tsx
git commit -m "feat(vendedor): estoque/vendas escopados pela loja (estoque compartilhado)"
```

---

### Task D2: Dashboard por papel + navegação limitada do vendedor

**Files:**
- Modify: `src/features/seller/pages/Dashboard.tsx`
- Modify: `src/features/seller/PainelLayout.tsx`

**Interfaces:**
- Consumes: `useAuth()` (`isVendedor`, `isGaragista`, `isAdmin`).
- Produces: KPI de comissões com rótulo correto por papel; nav do vendedor sem "Equipe" (já) e sem "Perfil / Mini-Loja".

- [ ] **Step 1: Rótulo de comissões por papel no Dashboard**

Em `src/features/seller/pages/Dashboard.tsx`, no `StatCard` de comissões (hoje "Comissões a receber" / hint "Seu ganho pelas vendas intermediadas"), trocar por rótulo condicional:

```tsx
            <StatCard
              label={isVendedor ? "Comissões a receber" : "Comissões a pagar"}
              value={formatCurrency(pendingCommission)}
              hint={isVendedor ? "Seu ganho pelas vendas intermediadas" : "Para a equipe da loja"}
            />
```

- [ ] **Step 2: Nav limitada do vendedor (esconder Perfil/Mini-Loja)**

Substituir `src/features/seller/PainelLayout.tsx` por:

```tsx
import { useAuth } from "@/features/auth/AuthProvider";
import { PanelShell, type PanelNavItem } from "@/components/PanelShell";

export function PainelLayout() {
  const { seller, isGaragista, isAdmin } = useAuth();
  const manager = isGaragista || isAdmin;
  const nav: PanelNavItem[] = [
    { to: "/painel", label: "Dashboard", icon: "grid", end: true },
    { to: "/painel/veiculos", label: "Veículos", icon: "car" },
    ...(manager
      ? [{ to: "/painel/equipe", label: "Equipe", icon: "users" } as PanelNavItem]
      : []),
    { to: "/painel/vendas", label: "Vendas", icon: "dollar" },
    { to: "/painel/financeiro", label: "Financeiro", icon: "wallet" },
    ...(manager
      ? [{ to: "/painel/perfil", label: "Perfil / Mini-Loja", icon: "store" } as PanelNavItem]
      : []),
  ];
  return (
    <PanelShell nav={nav} badge={manager ? "Garagista" : seller ? "Vendedor" : "Painel"} />
  );
}
```

- [ ] **Step 3: Verificar build verde**

Run: `npx tsc -b && npm run build`
Expected: ambos exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/features/seller/pages/Dashboard.tsx src/features/seller/PainelLayout.tsx
git commit -m "feat(vendedor): dashboard por papel + navegação limitada (sem Equipe/Perfil)"
```

---

## Self-Review (preenchido)

**Spec coverage (Seção 5 — Painel do Vendedor, modo limitado):**
- Veículos = estoque da loja (vendedor cadastra/registra venda) → D1 ✓
- Minhas vendas / Minhas comissões (RLS estreita ao próprio) → D1 (sales por loja, RLS narrow) + Financial (Fase C já separa vendedor) ✓
- Dashboard próprio (own sales via RLS; own commissions via personId) → D1 + D2 ✓
- Nav reduzida (sem Equipe/Perfil) → D2 ✓
- Perfil básico (sem slug público) — mini-loja é do garagista; o item some da nav do vendedor → D2 ✓

**Placeholder scan:** sem TBD/TODO. Corrige o bug real (vendedor não via estoque por usar `seller.id` em vez de `lojaId`).

**Type consistency:** todas as queries (`useVehicles`/`useSales`/`useSaveVehicle`/`useDeleteVehicle`/`useRegisterSale`/`useCommissions`) já aceitam `string | undefined`; passamos `lojaId ?? undefined`. Chaves de cache passam a usar `lojaId` consistentemente entre Dashboard/Vehicles/Sales (para o garagista `lojaId === seller.id`, sem mudança de comportamento).

**Nota de ambiente:** verificação por `tsc -b` + `npm run build` (sem runner unitário) + regressão do RLS (`a3_rls_test.sql`), que garante o isolamento que sustenta o "modo limitado".
