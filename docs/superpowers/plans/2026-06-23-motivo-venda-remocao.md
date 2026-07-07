# Motivo de venda e motivo de remoção — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registrar um motivo obrigatório toda vez que um veículo sai do inventário ativo — "Motivo da venda" ao registrar venda e "Motivo da remoção" ao excluir veículo (soft-delete).

**Architecture:** Migrations adicionam o valor de enum `removed`, colunas de motivo em `rv_sales`/`rv_vehicles` e `register_sale` v3 com `p_sale_reason`. A exclusão vira `update status='removed'` (RLS de update já cobre garagista e admin). Um componente `ReasonField` (Select + "Outro") é reaproveitado nos 3 pontos de UI. Tipos novos entram via a camada de aliases `database.types.ts`.

**Tech Stack:** React 18 + TS, react-hook-form + zod, @tanstack/react-query, supabase-js, Tailwind, Postgres/Supabase migrations.

## Global Constraints

- Gate do projeto = `npm run build` (`tsc -b && vite build`) verde. Não há framework de testes; a verificação de cada task é build verde + checagem manual descrita.
- Commits terminam com o trailer:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- Após o gate verde no fim: commit → push origin/main → deploy na VPS (rsync `dist/` + `pm2 reload revvio`), conforme fluxo do projeto.
- Não editar `src/lib/database.generated.ts` à mão; campos novos entram em `src/lib/database.types.ts`.
- Listas de motivos (fixas):
  - Venda: `À vista`, `Financiada`, `Troca`, `Repasse/lojista`, `Consignação`, `Outro`
  - Remoção: `Vendido fora da plataforma`, `Desistência do proprietário`, `Cadastro duplicado`, `Erro de cadastro`, `Veículo indisponível`, `Outro`

---

### Task 1: Migrations (enum + colunas + register_sale v3)

**Files:**
- Create: `supabase/migrations/0030_vehicle_status_removed.sql`
- Create: `supabase/migrations/0031_sale_removal_reasons.sql`

**Interfaces:**
- Produces: coluna `rv_sales.sale_reason text`; colunas `rv_vehicles.removal_reason text`, `removed_at timestamptz`, `removed_by uuid`; valor de enum `vehicle_status` `'removed'`; função `register_sale(bigint, uuid, varchar, numeric, payment_method, varchar, date, text)`.

- [ ] **Step 1: Criar 0030 (valor de enum isolado)**

`supabase/migrations/0030_vehicle_status_removed.sql`:
```sql
-- ============================================================
-- Soft-delete de veículos: novo status 'removed'
-- (em migration isolada: o Postgres exige o valor de enum
--  commitado antes de poder ser usado.)
-- ============================================================
alter type vehicle_status add value if not exists 'removed';
```

- [ ] **Step 2: Criar 0031 (colunas + register_sale v3)**

`supabase/migrations/0031_sale_removal_reasons.sql`:
```sql
-- ============================================================
-- Motivo de venda e motivo de remoção
-- ============================================================

-- Motivo da venda
alter table public.rv_sales
  add column if not exists sale_reason text;

-- Motivo/dados da remoção (soft-delete)
alter table public.rv_vehicles
  add column if not exists removal_reason text;
alter table public.rv_vehicles
  add column if not exists removed_at timestamptz;
alter table public.rv_vehicles
  add column if not exists removed_by uuid;

-- register_sale v3: + p_sale_reason
drop function if exists public.register_sale(
  bigint, uuid, varchar, numeric, payment_method, varchar, date
);

create or replace function public.register_sale(
  p_vehicle_id     bigint,
  p_vendedor_id    uuid,
  p_buyer_name     varchar,
  p_sale_price     numeric,
  p_payment_method payment_method,
  p_buyer_phone    varchar default null,
  p_sale_date      date    default current_date,
  p_sale_reason    text    default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_loja          uuid;
  v_vendedor_loja uuid;
  v_rate          numeric(5,2);
  v_sale_id       uuid;
begin
  v_loja := public.current_loja();
  if v_loja is null then
    raise exception 'Usuário atual não pertence a uma loja.';
  end if;

  if not public.is_loja_manager() and p_vendedor_id <> public.current_person() then
    raise exception 'Vendedor só pode registrar a própria venda.';
  end if;

  select coalesce(parent_id, id) into v_vendedor_loja
  from public.rv_sellers where id = p_vendedor_id;
  if v_vendedor_loja is distinct from v_loja then
    raise exception 'Vendedor não pertence à loja.';
  end if;

  if not public.is_admin()
     and not exists (select 1 from public.rv_vehicles
                     where id = p_vehicle_id and seller_id = v_loja) then
    raise exception 'Veículo % não pertence à loja.', p_vehicle_id;
  end if;

  select commission_rate into v_rate from public.rv_sellers where id = p_vendedor_id;

  insert into public.rv_sales (
    vehicle_id, seller_id, vendedor_id, buyer_name, buyer_phone,
    sale_price, payment_method, sale_date, sale_reason
  ) values (
    p_vehicle_id, v_loja, p_vendedor_id, p_buyer_name, p_buyer_phone,
    p_sale_price, p_payment_method, p_sale_date, p_sale_reason
  ) returning id into v_sale_id;

  insert into public.rv_commissions (
    sale_id, seller_id, vendedor_id, amount, rate, status, due_date
  ) values (
    v_sale_id, v_loja, p_vendedor_id,
    round(p_sale_price * v_rate / 100, 2), v_rate, 'pending',
    p_sale_date + interval '30 days'
  );

  update public.rv_vehicles set status = 'sold', updated_at = now()
  where id = p_vehicle_id;

  return v_sale_id;
end;
$$;

grant execute on function public.register_sale(
  bigint, uuid, varchar, numeric, payment_method, varchar, date, text
) to authenticated;
```

- [ ] **Step 3: Validar SQL localmente (sintaxe)**

Run: `ls -1 supabase/migrations/0030_vehicle_status_removed.sql supabase/migrations/0031_sale_removal_reasons.sql`
Expected: ambos os arquivos listados. (A aplicação no remoto acontece na Task 8.)

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0030_vehicle_status_removed.sql supabase/migrations/0031_sale_removal_reasons.sql
git commit -m "$(printf 'feat(db): motivo de venda, motivo de remocao e status removed\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 2: Aliases de tipo (campos novos)

**Files:**
- Modify: `src/lib/database.types.ts:20-22`

**Interfaces:**
- Consumes: tipos gerados em `database.generated.ts`.
- Produces: `Vehicle` com `removal_reason`/`removed_at`/`removed_by`; `Sale` com `sale_reason`; `VehicleStatus = "available" | "reserved" | "sold" | "removed"`.

- [ ] **Step 1: Estender os aliases**

Em `src/lib/database.types.ts`, localize:
```ts
export type Vehicle = Tables["rv_vehicles"]["Row"];
```
e a linha do `Sale`:
```ts
export type Sale = Tables["rv_sales"]["Row"];
```
Substitua por:
```ts
export type Vehicle = Tables["rv_vehicles"]["Row"] & {
  /** Soft-delete: preenchidos quando status = 'removed' (ainda não nos tipos gerados). */
  removal_reason: string | null;
  removed_at: string | null;
  removed_by: string | null;
};

/** Status de veículo incluindo o soft-delete 'removed'. */
export type VehicleStatus = "available" | "reserved" | "sold" | "removed";
```
e
```ts
export type Sale = Tables["rv_sales"]["Row"] & {
  /** Motivo da venda (ainda não nos tipos gerados). */
  sale_reason: string | null;
};
```

- [ ] **Step 2: Build**

Run: `npm run build 2>&1 | tail -3`
Expected: `✓ built` (sem erros de tipo).

- [ ] **Step 3: Commit**

```bash
git add src/lib/database.types.ts
git commit -m "$(printf 'feat(types): campos de motivo de venda/remocao e status removed\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 3: Componente compartilhado ReasonField

**Files:**
- Create: `src/components/ReasonField.tsx`

**Interfaces:**
- Consumes: `Field`, `Select`, `Input` de `@/components/ui-light`.
- Produces:
  - `SALE_REASONS: readonly string[]`, `REMOVAL_REASONS: readonly string[]`
  - `ReasonField` props: `{ label: string; options: readonly string[]; error?: string; onResolved: (value: string) => void }` — mantém estado interno do dropdown e do texto "Outro" e reporta o valor resolvido (rótulo, ou texto quando "Outro") via `onResolved`.

- [ ] **Step 1: Criar o componente**

`src/components/ReasonField.tsx`:
```tsx
import { useEffect, useState } from "react";
import { Field, Input, Select } from "@/components/ui-light";

export const SALE_REASONS = [
  "À vista",
  "Financiada",
  "Troca",
  "Repasse/lojista",
  "Consignação",
  "Outro",
] as const;

export const REMOVAL_REASONS = [
  "Vendido fora da plataforma",
  "Desistência do proprietário",
  "Cadastro duplicado",
  "Erro de cadastro",
  "Veículo indisponível",
  "Outro",
] as const;

export function ReasonField({
  label,
  options,
  error,
  onResolved,
}: {
  label: string;
  options: readonly string[];
  error?: string;
  onResolved: (value: string) => void;
}) {
  const [sel, setSel] = useState("");
  const [outro, setOutro] = useState("");
  const resolved = sel === "Outro" ? outro.trim() : sel;

  useEffect(() => {
    onResolved(resolved);
    // onResolved é um setter estável; só reportamos quando o valor muda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved]);

  return (
    <Field label={label} error={error}>
      <Select value={sel} onChange={(e) => setSel(e.target.value)}>
        <option value="" disabled>
          Selecione…
        </option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </Select>
      {sel === "Outro" && (
        <Input
          className="mt-2"
          placeholder="Descreva o motivo"
          value={outro}
          onChange={(e) => setOutro(e.target.value)}
        />
      )}
    </Field>
  );
}
```

- [ ] **Step 2: Build**

Run: `npm run build 2>&1 | tail -3`
Expected: `✓ built` (componente compila; ainda não é usado).

- [ ] **Step 3: Commit**

```bash
git add src/components/ReasonField.tsx
git commit -m "$(printf 'feat(ui): ReasonField (Select + Outro) reaproveitavel\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 4: Motivo da venda — mutation

**Files:**
- Modify: `src/features/seller/queries.ts` (`RegisterSaleInput` ~180-188 e `useRegisterSale` ~189-211)

**Interfaces:**
- Consumes: RPC `register_sale` com `p_sale_reason` (Task 1).
- Produces: `RegisterSaleInput` com `sale_reason: string`; `useRegisterSale` enviando `p_sale_reason`.

- [ ] **Step 1: Adicionar `sale_reason` ao input e ao RPC**

Localize:
```ts
export type RegisterSaleInput = {
  vehicle_id: number;
  vendedor_id: string;
  buyer_name: string;
  buyer_phone: string | null;
  sale_price: number;
  payment_method: PaymentMethod;
  sale_date: string;
};
```
Adicione o campo:
```ts
export type RegisterSaleInput = {
  vehicle_id: number;
  vendedor_id: string;
  buyer_name: string;
  buyer_phone: string | null;
  sale_price: number;
  payment_method: PaymentMethod;
  sale_date: string;
  sale_reason: string;
};
```
Em `useRegisterSale`, localize a chamada do RPC:
```ts
      const { data, error } = await supabase.rpc("register_sale", {
        p_vehicle_id: input.vehicle_id,
        p_vendedor_id: input.vendedor_id,
        p_buyer_name: input.buyer_name,
        p_sale_price: input.sale_price,
        p_payment_method: input.payment_method,
        p_buyer_phone: input.buyer_phone ?? undefined,
        p_sale_date: input.sale_date,
      });
```
Substitua por (o `as never` evita o erro de tipo enquanto os tipos gerados não incluem `p_sale_reason`, mesmo padrão de cast já usado no projeto):
```ts
      const { data, error } = await supabase.rpc("register_sale", {
        p_vehicle_id: input.vehicle_id,
        p_vendedor_id: input.vendedor_id,
        p_buyer_name: input.buyer_name,
        p_sale_price: input.sale_price,
        p_payment_method: input.payment_method,
        p_buyer_phone: input.buyer_phone ?? undefined,
        p_sale_date: input.sale_date,
        p_sale_reason: input.sale_reason,
      } as never);
```

- [ ] **Step 2: Build**

Run: `npm run build 2>&1 | tail -3`
Expected: `✓ built`.

- [ ] **Step 3: Commit**

```bash
git add src/features/seller/queries.ts
git commit -m "$(printf 'feat(vendas): envia motivo da venda no register_sale\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 5: Motivo da venda — UI (Sales.tsx)

**Files:**
- Modify: `src/features/seller/pages/Sales.tsx` (schema ~29-37; defaultValues ~61-66; onSubmit ~68-84; render do form ~193-196; tabela ~241-274)

**Interfaces:**
- Consumes: `ReasonField`, `SALE_REASONS` (Task 3); `RegisterSaleInput.sale_reason` (Task 4); `Sale.sale_reason` (Task 2).

- [ ] **Step 1: Importar ReasonField/SALE_REASONS**

No topo, após o import de `maskPhone`:
```ts
import { ReasonField, SALE_REASONS } from "@/components/ReasonField";
```

- [ ] **Step 2: Adicionar `sale_reason` ao schema**

Localize o `schema` e adicione o campo antes do fechamento:
```ts
const schema = z.object({
  vehicle_id: z.coerce.number().int().positive("Selecione o veículo"),
  vendedor_id: z.string().min(1, "Selecione o vendedor"),
  buyer_name: z.string().min(2, "Informe o comprador"),
  buyer_phone: z.string().optional(),
  sale_price: z.coerce.number().gt(0, "Informe o valor"),
  payment_method: z.enum(["pix", "financiamento", "a_vista"]),
  sale_date: z.string().min(1, "Informe a data"),
  sale_reason: z.string().min(1, "Informe o motivo da venda"),
});
```

- [ ] **Step 3: defaultValue para `sale_reason`**

Em `defaultValues`, adicione `sale_reason: ""`:
```ts
    defaultValues: {
      sale_date: today(),
      payment_method: "pix",
      vendedor_id: isVendedor ? personId ?? "" : "",
      sale_reason: "",
    },
```

- [ ] **Step 4: Enviar `sale_reason` no submit**

Em `onSubmit`, dentro de `register_.mutateAsync({ ... })`, adicione a linha:
```ts
        sale_date: values.sale_date,
        sale_reason: values.sale_reason,
      });
```
(insira `sale_reason: values.sale_reason,` logo após `sale_date: values.sale_date,`).

- [ ] **Step 5: Renderizar o campo no form**

Localize o `Field` de "Data da venda":
```tsx
        <Field label="Data da venda" error={errors.sale_date?.message}>
          <Input type="date" {...register("sale_date")} />
        </Field>
      </div>
```
Logo após o `</div>` que fecha o grid, antes do `<Alert variant="info">`, adicione:
```tsx
      <Controller
        control={control}
        name="sale_reason"
        render={({ field }) => (
          <ReasonField
            label="Motivo da venda"
            options={SALE_REASONS}
            error={errors.sale_reason?.message}
            onResolved={field.onChange}
          />
        )}
      />
```

- [ ] **Step 6: Coluna "Motivo" na tabela**

No `<thead>`, após o `<th>` de "Pagamento", adicione:
```tsx
                <th className="px-5 py-3 font-medium">Motivo</th>
```
No `<tbody>`, na linha de cada venda, após a `<td>` do `Badge` de pagamento, adicione:
```tsx
                  <td className="px-5 py-3 text-slate-600">{s.sale_reason ?? "—"}</td>
```

- [ ] **Step 7: Build**

Run: `npm run build 2>&1 | tail -3`
Expected: `✓ built`.

- [ ] **Step 8: Commit**

```bash
git add src/features/seller/pages/Sales.tsx
git commit -m "$(printf 'feat(vendas): campo obrigatorio Motivo da venda + coluna na tabela\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 6: Soft-delete — vendedor

**Files:**
- Modify: `src/features/seller/queries.ts` (`useVehicles` ~32-46; `useDeleteVehicle` ~166-176)
- Modify: `src/features/seller/pages/Vehicles.tsx` (`confirmDelete` ~627-635; modal ~920-947)

**Interfaces:**
- Consumes: `ReasonField`, `REMOVAL_REASONS` (Task 3); `useAuth().personId`.
- Produces: `useDeleteVehicle` com input `{ id: number; reason: string; personId: string | null }`.

- [ ] **Step 1: Filtrar `removed` em `useVehicles`**

Localize:
```ts
      const { data, error } = await supabase
        .from("rv_vehicles")
        .select("*, owner:rv_vehicle_owners(owner_name, owner_phone)")
        .eq("seller_id", sellerId!)
        .order("created_at", { ascending: false });
```
Adicione o filtro `.neq("status", "removed")`:
```ts
      const { data, error } = await supabase
        .from("rv_vehicles")
        .select("*, owner:rv_vehicle_owners(owner_name, owner_phone)")
        .eq("seller_id", sellerId!)
        .neq("status", "removed")
        .order("created_at", { ascending: false });
```

- [ ] **Step 2: Soft-delete em `useDeleteVehicle`**

Substitua a função inteira:
```ts
export function useDeleteVehicle(sellerId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("rv_vehicles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vehicles", sellerId] }),
  });
}
```
por:
```ts
export function useDeleteVehicle(sellerId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      reason,
      personId,
    }: {
      id: number;
      reason: string;
      personId: string | null;
    }) => {
      const { error } = await supabase
        .from("rv_vehicles")
        .update({
          status: "removed",
          removal_reason: reason,
          removed_at: new Date().toISOString(),
          removed_by: personId,
        } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vehicles", sellerId] }),
  });
}
```

- [ ] **Step 3: Importar ReasonField/REMOVAL_REASONS + estado do motivo**

No topo de `src/features/seller/pages/Vehicles.tsx`, adicione:
```ts
import { ReasonField, REMOVAL_REASONS } from "@/components/ReasonField";
```
No componente `Vehicles`, junto aos outros `useState` (após `const [deleting, setDeleting] = useState<VehicleWithOwner | null>(null);`), adicione:
```ts
  const { personId } = useAuth();
  const [removalReason, setRemovalReason] = useState("");
```
> Nota: `useAuth` já é importado neste arquivo (usado para `lojaId`). Se a desestruturação de `lojaId` estiver separada, apenas inclua `personId` na mesma chamada `useAuth()` existente em vez de chamar duas vezes.

- [ ] **Step 4: Atualizar `confirmDelete` (vendedor)**

Substitua:
```ts
  async function confirmDelete() {
    if (!deleting) return;
    try {
      await remove.mutateAsync(deleting.id);
      setDeleting(null);
    } catch {
      /* erro exibido no modal via remove.isError */
    }
  }
```
por:
```ts
  async function confirmDelete() {
    if (!deleting || !removalReason.trim()) return;
    try {
      await remove.mutateAsync({ id: deleting.id, reason: removalReason.trim(), personId });
      setDeleting(null);
      setRemovalReason("");
    } catch {
      /* erro exibido no modal via remove.isError */
    }
  }
```

- [ ] **Step 5: Campo de motivo no modal + reset ao fechar**

Localize o modal de exclusão e substitua o bloco:
```tsx
      {deleting && (
        <Modal open onClose={() => setDeleting(null)} title="Excluir veículo">
          <p className="text-sm text-slate-600">
            Excluir{" "}
            <strong className="text-slate-900">
              {deleting.make} {deleting.model}
            </strong>
            ? Essa ação não pode ser desfeita.
          </p>
          {remove.isError && (
            <div className="mt-4">
              <Alert variant="error">Erro ao excluir o veículo. Tente novamente.</Alert>
            </div>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setDeleting(null)}
              disabled={remove.isPending}
            >
              Cancelar
            </Button>
            <Button variant="danger" loading={remove.isPending} onClick={confirmDelete}>
              Excluir
            </Button>
          </div>
        </Modal>
      )}
```
por:
```tsx
      {deleting && (
        <Modal
          open
          onClose={() => {
            setDeleting(null);
            setRemovalReason("");
          }}
          title="Excluir veículo"
        >
          <p className="text-sm text-slate-600">
            Excluir{" "}
            <strong className="text-slate-900">
              {deleting.make} {deleting.model}
            </strong>
            ? O veículo sai das listagens, mas o registro é mantido para histórico.
          </p>
          <div className="mt-4">
            <ReasonField
              label="Motivo da remoção"
              options={REMOVAL_REASONS}
              onResolved={setRemovalReason}
            />
          </div>
          {remove.isError && (
            <div className="mt-4">
              <Alert variant="error">Erro ao excluir o veículo. Tente novamente.</Alert>
            </div>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setDeleting(null);
                setRemovalReason("");
              }}
              disabled={remove.isPending}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              loading={remove.isPending}
              disabled={!removalReason.trim()}
              onClick={confirmDelete}
            >
              Excluir
            </Button>
          </div>
        </Modal>
      )}
```

- [ ] **Step 6: Build**

Run: `npm run build 2>&1 | tail -3`
Expected: `✓ built`.

- [ ] **Step 7: Commit**

```bash
git add src/features/seller/queries.ts src/features/seller/pages/Vehicles.tsx
git commit -m "$(printf 'feat(veiculos): soft-delete com motivo no painel do garagista\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 7: Soft-delete — admin

**Files:**
- Modify: `src/features/admin/queries.ts` (`useAdminVehicles` ~364-377; `useAdminDeleteVehicle` ~410-419)
- Modify: `src/features/admin/pages/Vehicles.tsx` (estado + `confirmDelete` ~70-82; modal ~353-377)

**Interfaces:**
- Consumes: `ReasonField`, `REMOVAL_REASONS` (Task 3). O painel admin não exige `removed_by` (sem person vinculada obrigatória) → envia `null`.
- Produces: `useAdminDeleteVehicle` com input `{ id: number; reason: string }`.

- [ ] **Step 1: Filtrar `removed` em `useAdminVehicles`**

Localize:
```ts
      const { data, error } = await supabase
        .from("rv_vehicles")
        .select(
          "id, make, model, year, price, fipe_price, images, status, seller_id, clicks, blocked, seller:rv_sellers!rv_vehicles_seller_id_fkey(name)"
        )
        .order("created_at", { ascending: false });
```
Adicione o filtro:
```ts
      const { data, error } = await supabase
        .from("rv_vehicles")
        .select(
          "id, make, model, year, price, fipe_price, images, status, seller_id, clicks, blocked, seller:rv_sellers!rv_vehicles_seller_id_fkey(name)"
        )
        .neq("status", "removed")
        .order("created_at", { ascending: false });
```

- [ ] **Step 2: Soft-delete em `useAdminDeleteVehicle`**

Substitua:
```ts
export function useAdminDeleteVehicle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("rv_vehicles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-vehicles"] }),
  });
}
```
por:
```ts
export function useAdminDeleteVehicle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      const { error } = await supabase
        .from("rv_vehicles")
        .update({
          status: "removed",
          removal_reason: reason,
          removed_at: new Date().toISOString(),
        } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-vehicles"] }),
  });
}
```

- [ ] **Step 3: Importar ReasonField/REMOVAL_REASONS + estado**

No topo de `src/features/admin/pages/Vehicles.tsx`, adicione:
```ts
import { ReasonField, REMOVAL_REASONS } from "@/components/ReasonField";
```
No componente `Vehicles`, junto aos `useState` (após `const [deleting, setDeleting] = useState<AdminVehicle | null>(null);`), adicione:
```ts
  const [removalReason, setRemovalReason] = useState("");
```

- [ ] **Step 4: Atualizar `confirmDelete` (admin)**

Substitua:
```ts
  async function confirmDelete() {
    if (!deleting) return;
    try {
      await removeVehicle.mutateAsync(deleting.id);
      setDeleting(null);
    } catch {
      /* erro exibido no modal via removeVehicle.isError */
    }
  }
```
por:
```ts
  async function confirmDelete() {
    if (!deleting || !removalReason.trim()) return;
    try {
      await removeVehicle.mutateAsync({ id: deleting.id, reason: removalReason.trim() });
      setDeleting(null);
      setRemovalReason("");
    } catch {
      /* erro exibido no modal via removeVehicle.isError */
    }
  }
```

- [ ] **Step 5: Campo de motivo no modal admin + reset ao fechar**

Substitua o bloco do modal:
```tsx
      {deleting && (
        <Modal open onClose={() => setDeleting(null)} title="Excluir veículo">
          <div className="flex flex-col gap-4">
            <p className="text-sm text-slate-600">
              Excluir{" "}
              <strong className="text-slate-900">
                {deleting.make} {deleting.model}
              </strong>{" "}
              da garagem {deleting.seller?.name ?? "—"}? Essa ação não pode ser desfeita.
            </p>
            {removeVehicle.isError && (
              <Alert variant="error">Não foi possível excluir o veículo. Tente novamente.</Alert>
            )}
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setDeleting(null)}>
                Cancelar
              </Button>
              <Button variant="danger" loading={removeVehicle.isPending} onClick={confirmDelete}>
                Excluir
              </Button>
            </div>
          </div>
        </Modal>
      )}
```
por:
```tsx
      {deleting && (
        <Modal
          open
          onClose={() => {
            setDeleting(null);
            setRemovalReason("");
          }}
          title="Excluir veículo"
        >
          <div className="flex flex-col gap-4">
            <p className="text-sm text-slate-600">
              Excluir{" "}
              <strong className="text-slate-900">
                {deleting.make} {deleting.model}
              </strong>{" "}
              da garagem {deleting.seller?.name ?? "—"}? O veículo sai das listagens, mas o
              registro é mantido para histórico.
            </p>
            <ReasonField
              label="Motivo da remoção"
              options={REMOVAL_REASONS}
              onResolved={setRemovalReason}
            />
            {removeVehicle.isError && (
              <Alert variant="error">Não foi possível excluir o veículo. Tente novamente.</Alert>
            )}
            <div className="flex justify-end gap-3">
              <Button
                variant="ghost"
                onClick={() => {
                  setDeleting(null);
                  setRemovalReason("");
                }}
              >
                Cancelar
              </Button>
              <Button
                variant="danger"
                loading={removeVehicle.isPending}
                disabled={!removalReason.trim()}
                onClick={confirmDelete}
              >
                Excluir
              </Button>
            </div>
          </div>
        </Modal>
      )}
```

- [ ] **Step 6: Build**

Run: `npm run build 2>&1 | tail -3`
Expected: `✓ built`.

- [ ] **Step 7: Commit**

```bash
git add src/features/admin/queries.ts src/features/admin/pages/Vehicles.tsx
git commit -m "$(printf 'feat(admin): soft-delete de veiculo com motivo\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 8: Aplicar migrations no remoto + deploy

**Files:** nenhum (operacional).

**Interfaces:**
- Consumes: migrations 0030/0031 (Task 1); `dist/` do build final.

- [ ] **Step 1: Push do código**

```bash
git push origin main
```

- [ ] **Step 2: Aplicar migrations no remoto**

Conforme o fluxo do projeto (`supabase db push --db-url <REMOTE_DB_URL>`; ver memória "Migrations no remoto"). Se o histórico remoto estiver atrás, rodar `supabase migration repair` para os números pendentes antes de aplicar 0030/0031.

Run: `supabase db push --db-url "$SUPABASE_DB_URL"`
Expected: aplica `0030_vehicle_status_removed` e `0031_sale_removal_reasons` sem erro.

> Se `$SUPABASE_DB_URL` não estiver no ambiente, pedir a connection string ao usuário (`! supabase ...` no prompt) antes de seguir.

- [ ] **Step 3: Verificar schema via REST (sem psql)**

Verificar que `rv_sales.sale_reason` e `rv_vehicles.removal_reason` existem (ex.: `select` via REST com `?select=id,sale_reason&limit=1` e `?select=id,removal_reason&limit=1` retornam 200, não 400 "column does not exist").

- [ ] **Step 4: Build final + deploy VPS**

```bash
npm run build
rsync -az --delete dist/ root@72.60.243.106:/var/www/revvio/
ssh root@72.60.243.106 "pm2 reload revvio"
```
Expected: build `✓ built`; `[PM2] [revvio] ✓`.

- [ ] **Step 5: Smoke test em produção**

- Registrar uma venda exige selecionar "Motivo da venda" ("Outro" pede texto); a venda aparece com a coluna "Motivo".
- Excluir um veículo (garagista e admin) exige "Motivo da remoção"; o veículo some das listagens e não reaparece após refresh.

---

## Self-Review

**1. Cobertura do spec:**
- Motivo da venda (lista+Outro, obrigatório, persistido, exibido) → Tasks 1, 4, 5. ✅
- Motivo da remoção (lista+Outro, obrigatório, soft-delete) → Tasks 1, 6, 7. ✅
- Soft-delete + filtragem das listagens (vendedor e admin) → Tasks 6, 7. ✅
- `register_sale` v3 → Task 1. ✅
- Tipos novos sem editar generated → Task 2. ✅
- Build verde + migrations no remoto → Tasks (todas) + Task 8. ✅
- Fora de escopo (tela de removidos, hard purge, edição de motivo) → não há tasks, correto.

**2. Placeholders:** nenhum "TBD/TODO"; todo passo de código mostra o código.

**3. Consistência de tipos/nomes:**
- `ReasonField`/`SALE_REASONS`/`REMOVAL_REASONS` definidos na Task 3 e consumidos com a mesma assinatura (`onResolved`) nas Tasks 5/6/7. ✅
- `useDeleteVehicle({ id, reason, personId })` (Task 6) e `useAdminDeleteVehicle({ id, reason })` (Task 7) batem com as chamadas em `confirmDelete`. ✅
- `RegisterSaleInput.sale_reason` (Task 4) consumido na Task 5. ✅
- `Sale.sale_reason`/`Vehicle.removal_reason` (Task 2) usados nas Tasks 5/6/7. ✅
