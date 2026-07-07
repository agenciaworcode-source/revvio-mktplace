# Fase C — Painel do Garagista (Equipe + comissões + venda por vendedor) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar o painel do garagista funcional: gerenciar a equipe de vendedores, registrar venda atribuindo a um vendedor da equipe, e dar baixa nas comissões da loja.

**Architecture:** Reusa o `rv_sellers` (vendedores = linhas com `parent_id` = loja) e a Edge Function `invite-vendedor` (Fase B). As RPCs `mark_commission_*` passam a aceitar o garagista (manager da própria loja). A UI do painel ganha a tela **Equipe**, um seletor de vendedor na venda e a gestão de comissões da loja.

**Tech Stack:** React 18 · TypeScript · TanStack Query · React Hook Form + Zod · Supabase JS · Postgres (migration + teste SQL).

## Global Constraints

- Postgres no container `supabase_db_revvio` (`docker ps -qf name=supabase_db`).
- Rodar SQL: `docker exec -i $(docker ps -qf name=supabase_db) psql -U postgres -d postgres -v ON_ERROR_STOP=1 < <file.sql>`.
- Aplicar migrations: `supabase db reset`.
- Build verde obrigatório a cada task de front: `npx tsc -b` (0) e `npm run build` (0).
- **Preservar a UI atual do `/dashboard` (admin)** — Fase C só mexe no painel do garagista (`/painel`).
- Papéis: `useAuth()` expõe `role`, `lojaId`, `personId`, `isGaragista`, `isVendedor`, `isAdmin` (Fase B).
- Vendedor = linha `rv_sellers` com `role='vendedor'` e `parent_id` = id da loja. Comissão = `commission_rate` da linha do vendedor.
- Convite de vendedor SEMPRE via `supabase.functions.invoke("invite-vendedor", ...)` (nunca insert direto do cliente — `auth.users` exige service-role).
- UI segue o kit `@/components/ui-light` (PageHeader, Card, Field, Input, Select, Button, Alert, Badge, EmptyState, Modal, Spinner, StatCard).

---

### Task C1: RPCs de comissão liberadas para o garagista

**Files:**
- Create: `supabase/migrations/0018_commission_manager.sql`
- Test: `docs/superpowers/tests/c1_commission_manager_test.sql`

**Interfaces:**
- Consumes: `is_admin()`, `is_loja_manager()`, `current_loja()` (Fases A/B).
- Produces: `mark_commission_paid(uuid)` e `mark_commission_pending(uuid)` aceitam o garagista para comissões da própria loja (além do admin).

- [ ] **Step 1: Escrever o teste (falha primeiro)**

Create `docs/superpowers/tests/c1_commission_manager_test.sql`:

```sql
begin;
insert into auth.users (instance_id,id,aud,role,email,created_at,updated_at) values
 ('00000000-0000-0000-0000-000000000000','55555555-5555-5555-5555-555555555555','authenticated','authenticated','cg@t.dev',now(),now()),
 ('00000000-0000-0000-0000-000000000000','55555555-5555-5555-5555-5555555555a1','authenticated','authenticated','cv@t.dev',now(),now());
insert into public.rv_sellers (id,user_id,name,slug,status,role,commission_rate) values
 ('aaaa5555-5555-5555-5555-555555555555','55555555-5555-5555-5555-555555555555','CLoja','cloja','active','garagista',0);
insert into public.rv_sellers (id,user_id,name,status,role,parent_id,commission_rate) values
 ('aaaa5555-5555-5555-5555-5555555555a1','55555555-5555-5555-5555-5555555555a1','CVend','active','vendedor','aaaa5555-5555-5555-5555-555555555555',10);
insert into public.rv_vehicles (id,seller_id,make,model,price,status) overriding system value values
 (920001,'aaaa5555-5555-5555-5555-555555555555','VW','Polo',60000,'sold');
insert into public.rv_sales (id,vehicle_id,seller_id,vendedor_id,buyer_name,sale_price,payment_method) values
 ('aaaa5555-5555-5555-5555-5555555555ff',920001,'aaaa5555-5555-5555-5555-555555555555','aaaa5555-5555-5555-5555-5555555555a1','Comp',60000,'pix');
insert into public.rv_commissions (id,sale_id,seller_id,vendedor_id,amount,rate,status) values
 ('aaaa5555-5555-5555-5555-55555555c001','aaaa5555-5555-5555-5555-5555555555ff','aaaa5555-5555-5555-5555-555555555555','aaaa5555-5555-5555-5555-5555555555a1',6000,10,'pending');

do $$
declare st text;
begin
  perform set_config('role','authenticated',true);

  -- VENDEDOR não pode quitar
  perform set_config('request.jwt.claims', json_build_object('sub','55555555-5555-5555-5555-5555555555a1','role','authenticated')::text, true);
  begin
    perform public.mark_commission_paid('aaaa5555-5555-5555-5555-55555555c001');
    raise exception 'FALHA: vendedor conseguiu quitar comissão';
  exception when others then null; -- esperado: bloqueado
  end;

  -- GARAGISTA da loja quita
  perform set_config('request.jwt.claims', json_build_object('sub','55555555-5555-5555-5555-555555555555','role','authenticated')::text, true);
  perform public.mark_commission_paid('aaaa5555-5555-5555-5555-55555555c001');
  select status into st from public.rv_commissions where id='aaaa5555-5555-5555-5555-55555555c001';
  assert st = 'paid', 'FALHA: garagista não quitou a comissão da própria loja';

  -- e reverte
  perform public.mark_commission_pending('aaaa5555-5555-5555-5555-55555555c001');
  select status into st from public.rv_commissions where id='aaaa5555-5555-5555-5555-55555555c001';
  assert st in ('pending','overdue'), 'FALHA: garagista não reverteu a comissão';

  raise notice '✅ C1 commission manager OK';
end $$;
rollback;
```

- [ ] **Step 2: Rodar (deve FALHAR)**

Run: `docker exec -i $(docker ps -qf name=supabase_db) psql -U postgres -d postgres -v ON_ERROR_STOP=1 < docs/superpowers/tests/c1_commission_manager_test.sql`
Expected: FALHA — hoje `mark_commission_paid` é admin-only, o garagista é bloqueado (assert "garagista não quitou").

- [ ] **Step 3: Escrever a migration**

Create `supabase/migrations/0018_commission_manager.sql`:

```sql
-- ============================================================
-- Fase C · comissão: o GARAGISTA (manager da própria loja) pode
-- quitar/reverter as comissões da sua loja (além do admin).
-- ============================================================

create or replace function public.mark_commission_paid(p_commission_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_loja uuid;
begin
  select seller_id into v_loja from public.rv_commissions where id = p_commission_id;
  if v_loja is null then raise exception 'Comissão % não encontrada.', p_commission_id; end if;
  if not (public.is_admin() or (public.is_loja_manager() and v_loja = public.current_loja())) then
    raise exception 'Sem permissão para quitar esta comissão.';
  end if;
  update public.rv_commissions set status = 'paid', paid_at = now() where id = p_commission_id;
end;
$$;

create or replace function public.mark_commission_pending(p_commission_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_loja uuid;
begin
  select seller_id into v_loja from public.rv_commissions where id = p_commission_id;
  if v_loja is null then raise exception 'Comissão % não encontrada.', p_commission_id; end if;
  if not (public.is_admin() or (public.is_loja_manager() and v_loja = public.current_loja())) then
    raise exception 'Sem permissão para alterar esta comissão.';
  end if;
  update public.rv_commissions
    set status = case when due_date is not null and due_date < current_date then 'overdue' else 'pending' end,
        paid_at = null
  where id = p_commission_id;
end;
$$;
```

- [ ] **Step 4: Aplicar e rodar (deve PASSAR)**

Run:
```bash
supabase db reset
docker exec -i $(docker ps -qf name=supabase_db) psql -U postgres -d postgres -v ON_ERROR_STOP=1 < docs/superpowers/tests/c1_commission_manager_test.sql
```
Expected: `✅ C1 commission manager OK`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0018_commission_manager.sql docs/superpowers/tests/c1_commission_manager_test.sql
git commit -m "feat(db): garagista pode quitar/reverter comissões da própria loja"
```

---

### Task C2: Data layer da equipe + tela Equipe

**Files:**
- Modify: `src/features/seller/queries.ts`
- Create: `src/features/seller/pages/Equipe.tsx`
- Modify: `src/features/seller/PainelLayout.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `useAuth()` (`lojaId`, `isGaragista`, `isAdmin`); Edge Function `invite-vendedor`.
- Produces: `useTeam(lojaId)`, `useInviteVendedor(lojaId)`, `useSetVendedorRate(lojaId)`, `useSetVendedorStatus(lojaId)`; rota `/painel/equipe`; item de nav "Equipe" (só garagista/admin).

- [ ] **Step 1: Adicionar as queries da equipe**

Em `src/features/seller/queries.ts`, ao final do arquivo, adicionar:

```ts
/* ── Equipe (vendedores da loja) ────────────────────────── */
export function useTeam(lojaId?: string): UseQueryResult<Seller[]> {
  return useQuery({
    queryKey: ["team", lojaId],
    enabled: !!lojaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rv_sellers")
        .select("*")
        .eq("parent_id", lojaId!)
        .eq("role", "vendedor")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Seller[];
    },
  });
}

export function useInviteVendedor(lojaId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; email: string; commission_rate: number }) => {
      const { data, error } = await supabase.functions.invoke("invite-vendedor", {
        body: input,
      });
      if (error) throw error;
      if ((data as { error?: string })?.error)
        throw new Error((data as { error: string }).error);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team", lojaId] }),
  });
}

export function useSetVendedorRate(lojaId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; rate: number }) => {
      const { error } = await supabase
        .from("rv_sellers")
        .update({ commission_rate: input.rate })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team", lojaId] }),
  });
}

export function useSetVendedorStatus(lojaId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; status: "active" | "suspended" }) => {
      const { error } = await supabase
        .from("rv_sellers")
        .update({ status: input.status })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team", lojaId] }),
  });
}
```

- [ ] **Step 2: Criar a tela Equipe**

Create `src/features/seller/pages/Equipe.tsx`:

```tsx
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/features/auth/AuthProvider";
import {
  useTeam,
  useInviteVendedor,
  useSetVendedorRate,
  useSetVendedorStatus,
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

const schema = z.object({
  name: z.string().min(2, "Informe o nome"),
  email: z.string().email("E-mail inválido"),
  commission_rate: z.coerce.number().min(0).max(100),
});
type FormValues = z.infer<typeof schema>;

function InviteModal({ lojaId, onClose }: { lojaId?: string; onClose: () => void }) {
  const invite = useInviteVendedor(lojaId);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { commission_rate: 5 } });

  async function onSubmit(values: FormValues) {
    setError(null);
    try {
      await invite.mutateAsync(values);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao convidar o vendedor.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      {error && <Alert variant="error">{error}</Alert>}
      <Field label="Nome" htmlFor="name" error={errors.name?.message}>
        <Input id="name" placeholder="Nome do vendedor" {...register("name")} />
      </Field>
      <Field label="E-mail" htmlFor="email" error={errors.email?.message}>
        <Input id="email" type="email" placeholder="vendedor@email.com" {...register("email")} />
      </Field>
      <Field label="Comissão (%)" htmlFor="rate" error={errors.commission_rate?.message}>
        <Input id="rate" type="number" step="0.01" {...register("commission_rate")} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" type="button" onClick={onClose}>Cancelar</Button>
        <Button type="submit" loading={invite.isPending}>Enviar convite</Button>
      </div>
    </form>
  );
}

export function Equipe() {
  const { lojaId } = useAuth();
  const { data, isLoading } = useTeam(lojaId);
  const setRate = useSetVendedorRate(lojaId);
  const setStatus = useSetVendedorStatus(lojaId);
  const [inviting, setInviting] = useState(false);

  return (
    <div>
      <PageHeader
        title="Equipe"
        subtitle="Vendedores da sua loja. A comissão de cada venda usa a taxa do vendedor."
        action={<Button onClick={() => setInviting(true)}>Convidar vendedor</Button>}
      />

      {isLoading ? (
        <div className="flex justify-center py-16 text-slate-500"><Spinner /></div>
      ) : !data || data.length === 0 ? (
        <EmptyState
          title="Nenhum vendedor ainda"
          description="Convide um vendedor para começar a registrar vendas em nome dele."
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Vendedor</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Comissão (%)</th>
                <th className="px-5 py-3 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((v) => (
                <tr key={v.id}>
                  <td className="px-5 py-3">
                    <div className="font-medium text-slate-900">{v.name}</div>
                    <div className="text-xs text-slate-400">{v.email ?? "—"}</div>
                  </td>
                  <td className="px-5 py-3">
                    <Badge tone={v.status === "active" ? "green" : "red"}>
                      {v.status === "active" ? "Ativo" : "Suspenso"}
                    </Badge>
                  </td>
                  <td className="px-5 py-3">
                    <Input
                      type="number"
                      step="0.01"
                      defaultValue={String(v.commission_rate)}
                      className="w-24"
                      onBlur={(e) => {
                        const rate = Number(e.target.value);
                        if (rate !== Number(v.commission_rate))
                          setRate.mutate({ id: v.id, rate });
                      }}
                    />
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Button
                      variant="outline"
                      className="px-3 py-1 text-xs"
                      onClick={() =>
                        setStatus.mutate({
                          id: v.id,
                          status: v.status === "active" ? "suspended" : "active",
                        })
                      }
                    >
                      {v.status === "active" ? "Suspender" : "Reativar"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {inviting && (
        <Modal title="Convidar vendedor" onClose={() => setInviting(false)}>
          <InviteModal lojaId={lojaId} onClose={() => setInviting(false)} />
        </Modal>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Nav com "Equipe" para garagista/admin**

Substituir `src/features/seller/PainelLayout.tsx` por:

```tsx
import { useAuth } from "@/features/auth/AuthProvider";
import { PanelShell, type PanelNavItem } from "@/components/PanelShell";

export function PainelLayout() {
  const { seller, isGaragista, isAdmin } = useAuth();
  const nav: PanelNavItem[] = [
    { to: "/painel", label: "Dashboard", icon: "grid", end: true },
    { to: "/painel/veiculos", label: "Veículos", icon: "car" },
    ...(isGaragista || isAdmin
      ? [{ to: "/painel/equipe", label: "Equipe", icon: "users" } as PanelNavItem]
      : []),
    { to: "/painel/vendas", label: "Vendas", icon: "dollar" },
    { to: "/painel/financeiro", label: "Financeiro", icon: "wallet" },
    { to: "/painel/perfil", label: "Perfil / Mini-Loja", icon: "store" },
  ];
  return <PanelShell nav={nav} badge={seller?.name ? "Garagista" : "Painel"} />;
}
```

- [ ] **Step 4: Registrar a rota `/painel/equipe`**

Em `src/App.tsx`, adicionar o lazy import (junto aos demais do seller):

```tsx
const SellerEquipe = lazy(() =>
  import("@/features/seller/pages/Equipe").then((m) => ({ default: m.Equipe }))
);
```

E a rota dentro do bloco `/painel` (após `veiculos`):

```tsx
        <Route path="equipe" element={<SellerEquipe />} />
```

- [ ] **Step 5: Verificar build verde**

Run: `npx tsc -b && npm run build`
Expected: ambos exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/features/seller/queries.ts src/features/seller/pages/Equipe.tsx src/features/seller/PainelLayout.tsx src/App.tsx
git commit -m "feat(garagista): tela Equipe (convidar/taxa/suspender vendedores)"
```

---

### Task C3: Seletor de vendedor ao registrar venda

**Files:**
- Modify: `src/features/seller/pages/Sales.tsx`

**Interfaces:**
- Consumes: `useAuth()` (`personId`, `lojaId`, `isVendedor`); `useTeam(lojaId)`.
- Produces: o formulário de venda envia `vendedor_id` escolhido (garagista) ou o próprio (vendedor).

- [ ] **Step 1: Incluir o vendedor no schema e no formulário**

Em `src/features/seller/pages/Sales.tsx`:

(a) adicionar ao `schema` o campo:

```ts
  vendedor_id: z.string().min(1, "Selecione o vendedor"),
```

(b) no componente `RegisterSaleForm`, ler o contexto e a equipe (logo após `const { seller } = useAuth();`):

```tsx
  const { seller, personId, lojaId, isVendedor } = useAuth();
  const team = useTeam(lojaId);
```

(c) nos `defaultValues` do `useForm`, pré-selecionar: vendedor usa a si mesmo:

```tsx
    defaultValues: {
      sale_date: today(),
      payment_method: "pix",
      vendedor_id: isVendedor ? personId ?? "" : "",
    },
```

(d) trocar a chamada de `mutateAsync` para enviar o `vendedor_id` do formulário (remover o provisório `seller?.id`):

```tsx
      await register_.mutateAsync({
        vehicle_id: values.vehicle_id,
        vendedor_id: values.vendedor_id,
        buyer_name: values.buyer_name,
        buyer_phone: values.buyer_phone || null,
        sale_price: values.sale_price,
        payment_method: values.payment_method,
        sale_date: values.sale_date,
      });
```

(e) adicionar o campo de seleção no formulário (logo antes do campo do veículo). O vendedor (não-garagista) não escolhe — vai oculto travado em si mesmo:

```tsx
        {isVendedor ? (
          <input type="hidden" value={personId ?? ""} {...register("vendedor_id")} />
        ) : (
          <Field label="Vendedor" htmlFor="vendedor_id" error={errors.vendedor_id?.message}>
            <Select id="vendedor_id" {...register("vendedor_id")}>
              <option value="">Selecione o vendedor</option>
              {(team.data ?? [])
                .filter((v) => v.status === "active")
                .map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.commission_rate}%)
                  </option>
                ))}
            </Select>
          </Field>
        )}
```

(f) garantir o import de `useTeam` (no import já existente de `../queries`): incluir `useTeam` na lista (`import { useRegisterSale, useSales, useVehicles, useTeam } from "../queries";`).

- [ ] **Step 2: Verificar build verde**

Run: `npx tsc -b && npm run build`
Expected: ambos exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/features/seller/pages/Sales.tsx
git commit -m "feat(garagista): venda atribuída a um vendedor da equipe (seletor)"
```

---

### Task C4: Gestão de comissões da loja (com baixa) no Financeiro

**Files:**
- Modify: `src/features/seller/queries.ts`
- Modify: `src/features/seller/pages/Financial.tsx`

**Interfaces:**
- Consumes: `useAuth()` (`lojaId`, `isVendedor`); RPCs `mark_commission_paid`/`mark_commission_pending` (C1).
- Produces: `useLojaCommissions(lojaId)` (comissões da loja + nome do vendedor); `useMarkCommission(lojaId)`. Financeiro mostra a visão da loja (com baixa) para o garagista; o vendedor mantém a visão das próprias (somente leitura).

- [ ] **Step 1: Queries de comissões da loja**

Em `src/features/seller/queries.ts`, ao final, adicionar:

```ts
/* ── Comissões da loja (visão do garagista) ─────────────── */
export type LojaCommission = Commission & {
  vendedor: { name: string } | null;
};

export function useLojaCommissions(lojaId?: string): UseQueryResult<LojaCommission[]> {
  return useQuery({
    queryKey: ["loja-commissions", lojaId],
    enabled: !!lojaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rv_commissions")
        .select("*, vendedor:rv_sellers!rv_commissions_vendedor_id_fkey(name)")
        .eq("seller_id", lojaId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as LojaCommission[];
    },
  });
}

export function useMarkCommission(lojaId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; paid: boolean }) => {
      const rpc = input.paid ? "mark_commission_paid" : "mark_commission_pending";
      const { error } = await supabase.rpc(rpc, { p_commission_id: input.id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["loja-commissions", lojaId] });
      qc.invalidateQueries({ queryKey: ["commissions"] });
    },
  });
}
```

- [ ] **Step 2: Financeiro com visão da loja para o garagista**

Substituir `src/features/seller/pages/Financial.tsx` por:

```tsx
import { useAuth } from "@/features/auth/AuthProvider";
import { useCommissions, useLojaCommissions, useMarkCommission } from "../queries";
import { formatCurrency, formatDate } from "@/lib/format";
import type { CommissionStatus } from "@/lib/database.types";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Spinner,
  StatCard,
} from "@/components/ui-light";

const statusMeta: Record<
  CommissionStatus,
  { label: string; tone: "amber" | "green" | "red" }
> = {
  pending: { label: "Pendente", tone: "amber" },
  paid: { label: "Paga", tone: "green" },
  overdue: { label: "Atrasada", tone: "red" },
};

/* ── Visão do garagista: comissões da loja, por vendedor, com baixa ─ */
function LojaView({ lojaId }: { lojaId?: string }) {
  const { data, isLoading } = useLojaCommissions(lojaId);
  const mark = useMarkCommission(lojaId);

  const sumBy = (s: CommissionStatus) =>
    data?.filter((c) => c.status === s).reduce((a, c) => a + Number(c.amount), 0) ?? 0;

  return (
    <div>
      <PageHeader
        title="Financeiro"
        subtitle="Comissões da equipe sobre as vendas da loja. Dê baixa quando acertar com o vendedor."
      />
      {isLoading ? (
        <div className="flex justify-center py-16 text-slate-500"><Spinner /></div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="A pagar (pendente)" value={formatCurrency(sumBy("pending"))} />
            <StatCard label="Pagas" value={formatCurrency(sumBy("paid"))} />
            <StatCard label="Atrasadas" value={formatCurrency(sumBy("overdue"))} />
          </div>
          <h2 className="mb-3 mt-10 text-lg font-bold text-slate-900">Comissões da loja</h2>
          {!data || data.length === 0 ? (
            <EmptyState title="Sem comissões ainda" description="Aparecem conforme a equipe registra vendas." />
          ) : (
            <Card className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Vendedor</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Vencimento</th>
                    <th className="px-5 py-3 text-right font-medium">Valor</th>
                    <th className="px-5 py-3 text-right font-medium">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.map((c) => (
                    <tr key={c.id}>
                      <td className="px-5 py-3 text-slate-900">{c.vendedor?.name ?? "—"}</td>
                      <td className="px-5 py-3">
                        <Badge tone={statusMeta[c.status].tone}>{statusMeta[c.status].label}</Badge>
                      </td>
                      <td className="px-5 py-3 text-slate-600">{formatDate(c.due_date)}</td>
                      <td className="px-5 py-3 text-right font-semibold text-slate-900">
                        {formatCurrency(c.amount)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Button
                          variant={c.status === "paid" ? "ghost" : "outline"}
                          className="px-3 py-1 text-xs"
                          loading={mark.isPending && mark.variables?.id === c.id}
                          onClick={() => mark.mutate({ id: c.id, paid: c.status !== "paid" })}
                        >
                          {c.status === "paid" ? "Reverter" : "Marcar paga"}
                        </Button>
                      </td>
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

/* ── Visão do vendedor: as próprias comissões (somente leitura) ─ */
function VendedorView({ personId, rate }: { personId?: string; rate: number }) {
  const { data, isLoading } = useCommissions(personId);
  const sumBy = (s: CommissionStatus) =>
    data?.filter((c) => c.status === s).reduce((a, c) => a + Number(c.amount), 0) ?? 0;

  return (
    <div>
      <PageHeader
        title="Financeiro"
        subtitle={`Suas comissões pelas vendas intermediadas (taxa atual: ${rate}%).`}
      />
      {isLoading ? (
        <div className="flex justify-center py-16 text-slate-500"><Spinner /></div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="A receber" value={formatCurrency(sumBy("pending"))} />
            <StatCard label="Pagas" value={formatCurrency(sumBy("paid"))} />
            <StatCard label="Atrasadas" value={formatCurrency(sumBy("overdue"))} />
          </div>
          <h2 className="mb-3 mt-10 text-lg font-bold text-slate-900">Histórico de comissões</h2>
          {!data || data.length === 0 ? (
            <EmptyState title="Sem comissões ainda" description="Aparecem conforme você registra vendas." />
          ) : (
            <Card className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Vencimento</th>
                    <th className="px-5 py-3 font-medium">Pago em</th>
                    <th className="px-5 py-3 text-right font-medium">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.map((c) => (
                    <tr key={c.id}>
                      <td className="px-5 py-3">
                        <Badge tone={statusMeta[c.status].tone}>{statusMeta[c.status].label}</Badge>
                      </td>
                      <td className="px-5 py-3 text-slate-600">{formatDate(c.due_date)}</td>
                      <td className="px-5 py-3 text-slate-600">{formatDate(c.paid_at)}</td>
                      <td className="px-5 py-3 text-right font-semibold text-slate-900">
                        {formatCurrency(c.amount)}
                      </td>
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

export function Financial() {
  const { seller, lojaId, personId, isVendedor } = useAuth();
  if (isVendedor)
    return <VendedorView personId={personId ?? undefined} rate={seller?.commission_rate ?? 0} />;
  return <LojaView lojaId={lojaId ?? undefined} />;
}
```

- [ ] **Step 3: Verificar build verde**

Run: `npx tsc -b && npm run build`
Expected: ambos exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/features/seller/queries.ts src/features/seller/pages/Financial.tsx
git commit -m "feat(garagista): comissões da loja por vendedor com baixa; vendedor vê as próprias"
```

---

## Self-Review (preenchido)

**Spec coverage (Seção 5 — Painel do Garagista):**
- Equipe (convidar/taxa/suspender) → C2 ✓
- Vendas com seleção de vendedor → C3 ✓
- Comissões da loja por vendedor + marcar paga (migra do admin para o garagista) → C1 (RPC) + C4 (UI) ✓
- Dashboard/Veículos/Perfil → permanecem (sem mudança nesta fase)

**Placeholder scan:** sem TBD/TODO; o provisório da Fase A (`vendedor_id: seller?.id` no Sales) é REMOVIDO em C3.

**Type consistency:** `useTeam`/`useInviteVendedor`/`useSetVendedorRate`/`useSetVendedorStatus` (C2) e `useLojaCommissions`/`useMarkCommission` (C4) definidos em `queries.ts` e consumidos por Equipe/Sales/Financial. `mark_commission_paid(uuid)`/`mark_commission_pending(uuid)` (C1) batem com `useMarkCommission`. Nav usa ícone `users` (já usado no admin). FK `rv_commissions_vendedor_id_fkey` é o nome do constraint criado na 0013.

**Nota de ambiente:** C2/C3/C4 verificados por `tsc -b` + `npm run build` (sem runner unitário). C1 tem teste SQL. O convite real (Edge Function) já foi validado na Fase B (teste b3).

**Atenção (verificar na execução):** confirmar o nome do constraint da FK em `useLojaCommissions` (`rv_commissions_vendedor_id_fkey`) — se o embed do PostgREST reclamar de ambiguidade (há duas FKs de `rv_commissions` para `rv_sellers`: `seller_id` e `vendedor_id`), usar o nome exato do constraint da coluna `vendedor_id`.
```
