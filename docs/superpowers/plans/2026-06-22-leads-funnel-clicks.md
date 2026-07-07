# Leads (captura, funil kanban, ranking de cliques) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capturar leads do formulário do veículo, gerenciá-los no painel do garagista (cards + funil kanban com drag-and-drop) e mostrar os anúncios mais clicados, com visão no superadmin filtrável por garagista.

**Architecture:** Nova tabela `rv_leads` + enum `lead_stage` + contador `clicks` em `rv_vehicles` (RPC `increment_vehicle_clicks`). Captura pública no `LeadForm`; tracking no mount da página de detalhes. Feature React em `src/features/leads/` (queries + componentes compartilhados) consumida por páginas finas no painel do garagista e no admin.

**Tech Stack:** React + TypeScript, Supabase (Postgres + RLS + PostgREST), TanStack Query, Tailwind, `@dnd-kit` para o kanban.

## Global Constraints

- Gate de cada task: `npx tsc --noEmit` deve sair com código 0; `npm run build` deve concluir. (Não há framework de testes — verificação é typecheck + build + checagem REST/manual.)
- Após gate verde: commit. Deploy (push + VPS) só ao final ou quando indicado — seguir `[[commit-push-sempre]]`.
- Não editar `src/lib/database.generated.ts` à mão. Tipos da feature ficam em `src/features/leads/types.ts`.
- Padrões de RLS existentes: `public.current_loja()` (loja do usuário), `public.is_admin()`. Reusar.
- Conexão de banco remoto: `SUPABASE_DB_URL` no `.env.local`. Service role: `SUPABASE_SERVICE_ROLE_KEY`. URL/anon: `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
- Componentes de UI: `@/components/ui-light` (Button, Card, Input, Select, Textarea, Badge, Spinner, PageHeader, Alert, EmptyState). Painel admin usa `@/components/panel` (PanelHeader, SectionCard) e `AdminActions` para export CSV.
- Ícones: `@/features/public/components/icons` (`Icon name=...`).

## File Structure

- Create `supabase/migrations/0028_leads.sql` — enum, tabela, clicks, RPC, RLS.
- Create `src/features/leads/types.ts` — `LeadStage`, `Lead`, `LeadWithVehicle`, `TopClickedVehicle`.
- Create `src/features/leads/leadStages.ts` — ordem/labels/cores das colunas.
- Create `src/features/leads/queries.ts` — hooks (`useLeads`, `useCreateLead`, `useUpdateLeadStage`, `useTopClicked`, `useTrackVehicleClick`).
- Create `src/features/leads/components/TopClickedCards.tsx`, `LeadFilters.tsx`, `LeadCard.tsx`, `LeadKanban.tsx`, `LeadsView.tsx` (monta filtros + toggle cards/kanban + lista).
- Create `src/features/seller/pages/Leads.tsx`, `src/features/admin/pages/Leads.tsx`.
- Modify `src/features/public/pages/VehicleDetails.tsx` (campo cidade + insert do lead + track click).
- Modify `src/features/seller/PainelLayout.tsx`, `src/features/admin/AdminLayout.tsx` (menu).
- Modify `src/App.tsx` (rotas `/painel/leads` e `/dashboard/leads`).
- Modify `package.json` (deps `@dnd-kit/core`, `@dnd-kit/sortable`).

---

### Task 1: Migration — tabela, clicks e RPC

**Files:**
- Create: `supabase/migrations/0028_leads.sql`

**Interfaces:**
- Produces: tabela `public.rv_leads(id uuid, seller_id uuid, vehicle_id bigint, name text, phone text, email text, city text, message text, financing bool, stage lead_stage, created_at, updated_at)`; enum `lead_stage('novo','em_contato','negociando','ganho','perdido')`; coluna `rv_vehicles.clicks int`; RPC `public.increment_vehicle_clicks(p_id bigint) returns void`.

- [ ] **Step 1: Escrever a migration**

```sql
-- ============================================================
-- 0028_leads.sql — Leads + funil + tracking de cliques
-- ============================================================
create type lead_stage as enum ('novo','em_contato','negociando','ganho','perdido');

create table public.rv_leads (
  id          uuid primary key default gen_random_uuid(),
  seller_id   uuid not null references public.rv_sellers(id) on delete cascade,
  vehicle_id  bigint references public.rv_vehicles(id) on delete set null,
  name        text not null,
  phone       text,
  email       text,
  city        text,
  message     text,
  financing   boolean not null default false,
  stage       lead_stage not null default 'novo',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index idx_rv_leads_seller_id  on public.rv_leads(seller_id);
create index idx_rv_leads_stage      on public.rv_leads(stage);
create index idx_rv_leads_created_at on public.rv_leads(created_at desc);

create trigger trg_rv_leads_updated_at
  before update on public.rv_leads
  for each row execute function public.set_updated_at();

-- contador de cliques no anúncio
alter table public.rv_vehicles add column if not exists clicks int not null default 0;

create or replace function public.increment_vehicle_clicks(p_id bigint)
returns void language sql security definer set search_path = public as $$
  update public.rv_vehicles set clicks = clicks + 1 where id = p_id;
$$;
revoke all on function public.increment_vehicle_clicks(bigint) from public;
grant execute on function public.increment_vehicle_clicks(bigint) to anon, authenticated;

-- ── RLS ──
alter table public.rv_leads enable row level security;

-- captura pública: qualquer um insere
create policy "rv_leads_insert_public" on public.rv_leads
  for insert with check (true);

-- leitura/edição: dono da loja ou admin
create policy "rv_leads_read_scope" on public.rv_leads
  for select using (public.is_admin() or seller_id = public.current_loja());
create policy "rv_leads_update_scope" on public.rv_leads
  for update using (public.is_admin() or seller_id = public.current_loja())
  with check (public.is_admin() or seller_id = public.current_loja());
create policy "rv_leads_delete_scope" on public.rv_leads
  for delete using (public.is_admin() or seller_id = public.current_loja());
```

- [ ] **Step 2: Aplicar no remoto**

Run: `cd "<repo>" && set -a && source .env.local && set +a && supabase db push --db-url "$SUPABASE_DB_URL"`
Expected: aplica `0028_leads.sql` sem erro. (Fallback se o push falhar: pedir ao usuário para colar o SQL no Supabase Studio → SQL Editor via `! ...`.)

- [ ] **Step 3: Verificar via REST**

```bash
set -a && source .env.local && set +a
curl -s "$VITE_SUPABASE_URL/rest/v1/rv_leads?select=id&limit=1" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```
Expected: `[]` (200, tabela existe e vazia). Conferir também: `rv_vehicles?select=id,clicks&limit=1` retorna a coluna `clicks`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0028_leads.sql && git commit -m "feat(db): tabela rv_leads, enum lead_stage, clicks + RPC e RLS"
```

---

### Task 2: Tipos e estágios da feature

**Files:**
- Create: `src/features/leads/types.ts`
- Create: `src/features/leads/leadStages.ts`

**Interfaces:**
- Produces:
  - `type LeadStage = "novo" | "em_contato" | "negociando" | "ganho" | "perdido"`
  - `interface Lead { id, seller_id, vehicle_id, name, phone, email, city, message, financing, stage, created_at, updated_at }`
  - `interface LeadWithVehicle extends Lead { vehicle: { id: number; make: string; model: string; year: number | null } | null }`
  - `interface TopClickedVehicle { id: number; make: string; model: string; year: number | null; images: string[]; clicks: number }`
  - `LEAD_STAGES: { key: LeadStage; label: string; badge: string; column: string }[]` (ordem das colunas)
  - `stageMeta(stage): { label, badge }`

- [ ] **Step 1: Criar `types.ts`**

```ts
export type LeadStage = "novo" | "em_contato" | "negociando" | "ganho" | "perdido";

export interface Lead {
  id: string;
  seller_id: string;
  vehicle_id: number | null;
  name: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  message: string | null;
  financing: boolean;
  stage: LeadStage;
  created_at: string;
  updated_at: string;
}

export interface LeadWithVehicle extends Lead {
  vehicle: { id: number; make: string; model: string; year: number | null } | null;
}

export interface TopClickedVehicle {
  id: number;
  make: string;
  model: string;
  year: number | null;
  images: string[];
  clicks: number;
}
```

- [ ] **Step 2: Criar `leadStages.ts`**

```ts
import type { LeadStage } from "./types";

export const LEAD_STAGES: {
  key: LeadStage;
  label: string;
  badge: string;   // classes do Badge/pill
  column: string;  // classes do header da coluna kanban
}[] = [
  { key: "novo", label: "Novo", badge: "bg-blue-50 text-blue-700 ring-blue-200", column: "border-blue-300" },
  { key: "em_contato", label: "Em contato", badge: "bg-amber-50 text-amber-700 ring-amber-200", column: "border-amber-300" },
  { key: "negociando", label: "Negociando", badge: "bg-violet-50 text-violet-700 ring-violet-200", column: "border-violet-300" },
  { key: "ganho", label: "Ganho", badge: "bg-emerald-50 text-emerald-700 ring-emerald-200", column: "border-emerald-300" },
  { key: "perdido", label: "Perdido", badge: "bg-red-50 text-red-700 ring-red-200", column: "border-red-300" },
];

export function stageMeta(stage: LeadStage) {
  return LEAD_STAGES.find((s) => s.key === stage) ?? LEAD_STAGES[0];
}
```

- [ ] **Step 3: Gate + commit**

Run: `npx tsc --noEmit` → EXIT 0.
```bash
git add src/features/leads/types.ts src/features/leads/leadStages.ts && git commit -m "feat(leads): tipos e estágios do funil"
```

---

### Task 3: Hooks de dados (`queries.ts`)

**Files:**
- Create: `src/features/leads/queries.ts`

**Interfaces:**
- Consumes: `Lead`, `LeadWithVehicle`, `LeadStage`, `TopClickedVehicle` (Task 2); `supabase` de `@/lib/supabase`.
- Produces:
  - `useLeads(sellerId?: string): UseQueryResult<LeadWithVehicle[]>` — se `sellerId` informado filtra por loja; senão (admin) traz todos. Ordena `created_at desc`.
  - `useCreateLead(): mutation((input: NewLead) => Promise<void>)` onde `NewLead = { seller_id, vehicle_id, name, phone, email, city, message, financing }`.
  - `useUpdateLeadStage(): mutation(({ id, stage, sellerId }) => Promise<void>)` — invalida `["leads", sellerId]`.
  - `useTopClicked(sellerId?: string, limit=5): UseQueryResult<TopClickedVehicle[]>` — `rv_vehicles` ordenado por `clicks desc`, `clicks>0`, filtra por `seller_id` se informado.
  - `useTrackVehicleClick(): (id: number) => void` — chama a RPC (best-effort, ignora erro).

- [ ] **Step 1: Implementar**

```ts
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Lead, LeadStage, LeadWithVehicle, TopClickedVehicle } from "./types";

const LEAD_COLS =
  "*, vehicle:rv_vehicles(id, make, model, year)";

export function useLeads(sellerId?: string): UseQueryResult<LeadWithVehicle[]> {
  return useQuery({
    queryKey: ["leads", sellerId ?? "all"],
    queryFn: async () => {
      let q = supabase.from("rv_leads").select(LEAD_COLS).order("created_at", { ascending: false });
      if (sellerId) q = q.eq("seller_id", sellerId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as LeadWithVehicle[];
    },
  });
}

export type NewLead = Pick<
  Lead,
  "seller_id" | "vehicle_id" | "name" | "phone" | "email" | "city" | "message" | "financing"
>;

export function useCreateLead() {
  return useMutation({
    mutationFn: async (input: NewLead) => {
      const { error } = await supabase.from("rv_leads").insert(input);
      if (error) throw error;
    },
  });
}

export function useUpdateLeadStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: LeadStage; sellerId?: string }) => {
      const { error } = await supabase.from("rv_leads").update({ stage }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["leads", vars.sellerId ?? "all"] });
    },
  });
}

export function useTopClicked(sellerId?: string, limit = 5): UseQueryResult<TopClickedVehicle[]> {
  return useQuery({
    queryKey: ["top-clicked", sellerId ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("rv_vehicles")
        .select("id, make, model, year, images, clicks")
        .gt("clicks", 0)
        .order("clicks", { ascending: false })
        .limit(limit);
      if (sellerId) q = q.eq("seller_id", sellerId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as TopClickedVehicle[];
    },
  });
}

export function useTrackVehicleClick() {
  return (id: number) => {
    // best-effort; RPC não está no tipo gerado → cast
    (supabase.rpc as unknown as (fn: string, args: object) => Promise<unknown>)(
      "increment_vehicle_clicks",
      { p_id: id }
    ).catch?.(() => {});
  };
}
```

- [ ] **Step 2: Gate + commit**

Run: `npx tsc --noEmit` → EXIT 0.
```bash
git add src/features/leads/queries.ts && git commit -m "feat(leads): hooks de dados (leads, stage, top-clicked, track)"
```

---

### Task 4: Captura pública (cidade + insert) e tracking de clique

**Files:**
- Modify: `src/features/public/pages/VehicleDetails.tsx`

**Interfaces:**
- Consumes: `useCreateLead`, `useTrackVehicleClick` (Task 3).

- [ ] **Step 1: Importar hooks e React useEffect**

No topo de `VehicleDetails.tsx`, adicionar:
```ts
import { useEffect } from "react";
import { useCreateLead, useTrackVehicleClick } from "@/features/leads/queries";
```
(`useState` já é importado; juntar `useEffect` ao import existente de "react".)

- [ ] **Step 2: Campo Cidade no `LeadForm`**

Adicionar estado e validação:
```ts
const [cidade, setCidade] = useState("");
const createLead = useCreateLead();
```
Em `validate()`, acrescentar: `if (!cidade.trim()) e.cidade = "Informe sua cidade.";`
No JSX, após o input de E-mail e antes do Textarea, inserir:
```tsx
<div>
  <Input
    placeholder="Cidade *"
    value={cidade}
    onChange={(e) => setCidade(e.target.value)}
    className={errors.cidade ? "!border-red-400 focus:!border-red-400 focus:!ring-red-400" : ""}
  />
  {errors.cidade && <p className="mt-1 text-[12px] text-red-500">{errors.cidade}</p>}
</div>
```

- [ ] **Step 3: Persistir o lead no `enviar()`**

Dentro de `enviar()`, após `if (!validate()) return;` e antes de abrir o WhatsApp:
```ts
if (seller?.id) {
  createLead.mutate({
    seller_id: seller.id,
    vehicle_id: v.id,
    name: nome.trim(),
    phone: celular || null,
    email: email.trim() || null,
    city: cidade.trim() || null,
    message: mensagem.trim() || null,
    financing: financiamento,
  });
}
```
(O insert é best-effort; mesmo se falhar, segue abrindo o WhatsApp.)

- [ ] **Step 4: Tracking de clique no mount da página**

Em `VehicleDetails()` (o componente de página), adicionar:
```ts
const track = useTrackVehicleClick();
useEffect(() => {
  if (data?.id) track(data.id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [data?.id]);
```

- [ ] **Step 5: Gate + verificação manual + commit**

Run: `npx tsc --noEmit` → EXIT 0; `npm run build` → conclui.
Verificação REST (após abrir a página `/veiculo/17` localmente ou em prod e enviar o form): `curl rv_leads?select=*` deve listar o lead; `rv_vehicles?select=id,clicks&id=eq.17` deve mostrar `clicks` incrementado.
```bash
git add src/features/public/pages/VehicleDetails.tsx && git commit -m "feat(veiculo): captura lead (com cidade) e tracking de cliques"
```

---

### Task 5: Componentes compartilhados — TopClicked, Filtros, Card

**Files:**
- Create: `src/features/leads/components/TopClickedCards.tsx`
- Create: `src/features/leads/components/LeadFilters.tsx`
- Create: `src/features/leads/components/LeadCard.tsx`

**Interfaces:**
- Consumes: `useTopClicked` (Task 3), `LeadWithVehicle`, `stageMeta` (Task 2), `whatsappLink` de `@/lib/whatsapp`, `formatDate` de `@/lib/format`, `Icon`.
- Produces:
  - `TopClickedCards({ sellerId }: { sellerId?: string })`
  - `LeadFiltersValue = { term: string; from: string; to: string; city: string }`
  - `LeadFilters({ value, onChange, cities }: { value: LeadFiltersValue; onChange: (v: LeadFiltersValue) => void; cities: string[] })`
  - `LeadCard({ lead }: { lead: LeadWithVehicle })`
  - `filterLeads(leads: LeadWithVehicle[], f: LeadFiltersValue): LeadWithVehicle[]` (exportada de `LeadFilters.tsx`)

- [ ] **Step 1: `TopClickedCards.tsx`**

```tsx
import { Link } from "react-router-dom";
import { useTopClicked } from "../queries";

export function TopClickedCards({ sellerId }: { sellerId?: string }) {
  const { data } = useTopClicked(sellerId);
  const list = data ?? [];
  if (list.length === 0) return null;
  return (
    <div className="mb-6">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
        Anúncios mais clicados
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {list.map((v) => (
          <Link
            key={v.id}
            to={`/veiculo/${v.id}`}
            target="_blank"
            className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 hover:border-brand"
          >
            {v.images?.[0] ? (
              <img src={v.images[0]} alt="" className="h-12 w-16 rounded-lg object-cover" />
            ) : (
              <span className="h-12 w-16 rounded-lg bg-slate-100" />
            )}
            <div className="min-w-0">
              <p className="truncate text-[13px] font-bold text-slate-900">
                {v.make} {v.model}
              </p>
              <p className="text-[12px] text-slate-500">
                {v.clicks} clique{v.clicks === 1 ? "" : "s"}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `LeadFilters.tsx` (com `filterLeads`)**

```tsx
import { Input, Select } from "@/components/ui-light";
import type { LeadWithVehicle } from "../types";

export interface LeadFiltersValue {
  term: string;
  from: string;
  to: string;
  city: string;
}

export const EMPTY_FILTERS: LeadFiltersValue = { term: "", from: "", to: "", city: "all" };

export function filterLeads(leads: LeadWithVehicle[], f: LeadFiltersValue): LeadWithVehicle[] {
  const term = f.term.trim().toLowerCase();
  const from = f.from ? new Date(f.from + "T00:00:00").getTime() : null;
  const to = f.to ? new Date(f.to + "T23:59:59").getTime() : null;
  return leads.filter((l) => {
    if (term) {
      const hay = `${l.name} ${l.email ?? ""} ${l.phone ?? ""} ${l.city ?? ""}`.toLowerCase();
      if (!hay.includes(term)) return false;
    }
    const t = new Date(l.created_at).getTime();
    if (from !== null && t < from) return false;
    if (to !== null && t > to) return false;
    if (f.city !== "all" && (l.city ?? "") !== f.city) return false;
    return true;
  });
}

export function LeadFilters({
  value,
  onChange,
  cities,
}: {
  value: LeadFiltersValue;
  onChange: (v: LeadFiltersValue) => void;
  cities: string[];
}) {
  const set = (patch: Partial<LeadFiltersValue>) => onChange({ ...value, ...patch });
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
      <Input
        placeholder="Buscar por nome, cidade ou telefone…"
        value={value.term}
        onChange={(e) => set({ term: e.target.value })}
        className="min-w-[220px] flex-1"
      />
      <Input type="date" value={value.from} onChange={(e) => set({ from: e.target.value })} className="w-40" />
      <span className="text-slate-400">–</span>
      <Input type="date" value={value.to} onChange={(e) => set({ to: e.target.value })} className="w-40" />
      <Select value={value.city} onChange={(e) => set({ city: e.target.value })} className="w-48">
        <option value="all">Todas as cidades</option>
        {cities.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </Select>
    </div>
  );
}
```

- [ ] **Step 3: `LeadCard.tsx`**

```tsx
import { Icon } from "@/features/public/components/icons";
import { Badge } from "@/components/ui-light";
import { formatDate } from "@/lib/format";
import { whatsappLink } from "@/lib/whatsapp";
import { stageMeta } from "../leadStages";
import type { LeadWithVehicle } from "../types";

export function LeadCard({ lead }: { lead: LeadWithVehicle }) {
  const meta = stageMeta(lead.stage);
  const wa = whatsappLink(lead.phone, `Olá ${lead.name}!`);
  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-400">
            <Icon name="users" size={18} />
          </span>
          <div className="min-w-0">
            <p className="truncate font-bold text-slate-900">{lead.name}</p>
            <p className="truncate text-[13px] text-slate-500">{lead.email ?? "—"}</p>
            <p className="mt-0.5 text-[12px] text-slate-400">{formatDate(lead.created_at)}</p>
          </div>
        </div>
        <Badge tone="neutral" className={`ring-1 ring-inset ${meta.badge}`}>{meta.label}</Badge>
      </div>

      <div className="mt-3 space-y-1 text-[13px] text-slate-600">
        <p className="flex items-center gap-2">
          <Icon name="phone" size={15} className="text-slate-400" />
          {lead.phone || "Telefone não informado"}
        </p>
        <p className="flex items-center gap-2">
          <Icon name="mapPin" size={15} className="text-slate-400" />
          {lead.city || "Cidade não informada"}
        </p>
        {lead.vehicle && (
          <p className="flex items-center gap-2">
            <Icon name="car" size={15} className="text-slate-400" />
            {lead.vehicle.make} {lead.vehicle.model}
          </p>
        )}
      </div>

      <a
        href={wa ?? undefined}
        target="_blank"
        rel="noreferrer"
        aria-disabled={!wa}
        className={`mt-4 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold ${
          wa
            ? "bg-emerald-500 text-white hover:bg-emerald-600"
            : "pointer-events-none bg-slate-100 text-slate-400"
        }`}
      >
        <Icon name="whatsapp" size={16} /> {wa ? "WhatsApp" : "Sem WhatsApp"}
      </a>
    </div>
  );
}
```
(Nota: `Badge` deve aceitar `className`; se não aceitar, conferir em `ui-light` e ajustar para um `<span>` com as classes de `meta.badge`.)

- [ ] **Step 4: Gate + commit**

Run: `npx tsc --noEmit` → EXIT 0.
```bash
git add src/features/leads/components/TopClickedCards.tsx src/features/leads/components/LeadFilters.tsx src/features/leads/components/LeadCard.tsx && git commit -m "feat(leads): componentes TopClicked, Filtros e LeadCard"
```

---

### Task 6: Kanban com drag-and-drop

**Files:**
- Modify: `package.json` (add deps)
- Create: `src/features/leads/components/LeadKanban.tsx`

**Interfaces:**
- Consumes: `useUpdateLeadStage` (Task 3), `LEAD_STAGES`, `stageMeta` (Task 2), `LeadWithVehicle`, `LeadCard` (Task 5).
- Produces: `LeadKanban({ leads, sellerId }: { leads: LeadWithVehicle[]; sellerId?: string })`.

- [ ] **Step 1: Instalar dependências**

Run: `npm install @dnd-kit/core @dnd-kit/sortable`
Expected: adiciona ao `package.json`/lock sem erro.

- [ ] **Step 2: Implementar o kanban**

```tsx
import { useMemo } from "react";
import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { useDroppable, useDraggable } from "@dnd-kit/core";
import { LEAD_STAGES } from "../leadStages";
import type { LeadStage, LeadWithVehicle } from "../types";
import { useUpdateLeadStage } from "../queries";
import { LeadCard } from "./LeadCard";

function Column({ stage, label, count, children }: { stage: LeadStage; label: string; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <div ref={setNodeRef} className={`flex w-72 shrink-0 flex-col rounded-xl bg-slate-50 p-3 ${isOver ? "ring-2 ring-brand" : ""}`}>
      <div className="mb-3 flex items-center justify-between px-1">
        <span className="text-[13px] font-bold text-slate-700">{label}</span>
        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500">{count}</span>
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

function DraggableCard({ lead }: { lead: LeadWithVehicle }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)`, opacity: isDragging ? 0.5 : 1 } : undefined;
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing">
      <LeadCard lead={lead} />
    </div>
  );
}

export function LeadKanban({ leads, sellerId }: { leads: LeadWithVehicle[]; sellerId?: string }) {
  const updateStage = useUpdateLeadStage();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const byStage = useMemo(() => {
    const map: Record<LeadStage, LeadWithVehicle[]> = { novo: [], em_contato: [], negociando: [], ganho: [], perdido: [] };
    for (const l of leads) map[l.stage].push(l);
    return map;
  }, [leads]);

  function onDragEnd(e: DragEndEvent) {
    const id = String(e.active.id);
    const dest = e.over?.id as LeadStage | undefined;
    if (!dest) return;
    const lead = leads.find((l) => l.id === id);
    if (!lead || lead.stage === dest) return;
    updateStage.mutate({ id, stage: dest, sellerId });
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {LEAD_STAGES.map((s) => (
          <Column key={s.key} stage={s.key} label={s.label} count={byStage[s.key].length}>
            {byStage[s.key].map((l) => (
              <DraggableCard key={l.id} lead={l} />
            ))}
          </Column>
        ))}
      </div>
    </DndContext>
  );
}
```

- [ ] **Step 3: Gate + commit**

Run: `npx tsc --noEmit` → EXIT 0; `npm run build` → conclui.
```bash
git add package.json package-lock.json src/features/leads/components/LeadKanban.tsx && git commit -m "feat(leads): kanban do funil com drag-and-drop (@dnd-kit)"
```

---

### Task 7: `LeadsView` + página do garagista + menu/rota

**Files:**
- Create: `src/features/leads/components/LeadsView.tsx`
- Create: `src/features/seller/pages/Leads.tsx`
- Modify: `src/features/seller/PainelLayout.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `useLeads` (Task 3), `LeadFilters`/`filterLeads`/`EMPTY_FILTERS`, `LeadCard`, `TopClickedCards` (Task 5), `LeadKanban` (Task 6).
- Produces: `LeadsView({ sellerId, extraHeader }: { sellerId?: string; extraHeader?: React.ReactNode })` reutilizável por garagista e admin.

- [ ] **Step 1: `LeadsView.tsx`**

```tsx
import { useMemo, useState } from "react";
import { Button, Spinner } from "@/components/ui-light";
import { Icon } from "@/features/public/components/icons";
import { useLeads } from "../queries";
import { LeadFilters, filterLeads, EMPTY_FILTERS } from "./LeadFilters";
import { LeadCard } from "./LeadCard";
import { LeadKanban } from "./LeadKanban";
import { TopClickedCards } from "./TopClickedCards";

export function LeadsView({ sellerId, extraHeader }: { sellerId?: string; extraHeader?: React.ReactNode }) {
  const { data, isLoading } = useLeads(sellerId);
  const leads = useMemo(() => data ?? [], [data]);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [view, setView] = useState<"cards" | "kanban">("cards");

  const cities = useMemo(
    () => Array.from(new Set(leads.map((l) => l.city).filter(Boolean) as string[])).sort(),
    [leads]
  );
  const filtered = useMemo(() => filterLeads(leads, filters), [leads, filters]);

  function exportCsv() {
    const rows = filtered.map((l) => ({
      nome: l.name, email: l.email ?? "", telefone: l.phone ?? "", cidade: l.city ?? "",
      veiculo: l.vehicle ? `${l.vehicle.make} ${l.vehicle.model}` : "", estagio: l.stage, data: l.created_at,
    }));
    const head = Object.keys(rows[0] ?? { nome: "" });
    const csv = [head.join(","), ...rows.map((r) => head.map((h) => `"${String((r as Record<string,string>)[h]).replace(/"/g, '""')}"`).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = "leads.csv"; a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div>
      {extraHeader}
      <TopClickedCards sellerId={sellerId} />
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex rounded-lg border border-slate-200 p-0.5">
          <button onClick={() => setView("cards")} className={`rounded-md px-3 py-1.5 text-sm font-semibold ${view === "cards" ? "bg-brand text-white" : "text-slate-500"}`}>Cards</button>
          <button onClick={() => setView("kanban")} className={`rounded-md px-3 py-1.5 text-sm font-semibold ${view === "kanban" ? "bg-brand text-white" : "text-slate-500"}`}>Funil</button>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={!filtered.length}>
          <Icon name="download" size={16} /> Exportar CSV
        </Button>
      </div>
      <LeadFilters value={filters} onChange={setFilters} cities={cities} />

      {isLoading ? (
        <div className="flex justify-center py-16 text-slate-400"><Spinner /></div>
      ) : filtered.length === 0 ? (
        <p className="py-16 text-center text-sm text-slate-400">Nenhum lead encontrado.</p>
      ) : view === "cards" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((l) => <LeadCard key={l.id} lead={l} />)}
        </div>
      ) : (
        <LeadKanban leads={filtered} sellerId={sellerId} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: `seller/pages/Leads.tsx`**

```tsx
import { Navigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthProvider";
import { PageHeader } from "@/components/ui-light";
import { LeadsView } from "@/features/leads/components/LeadsView";

export function Leads() {
  const { lojaId, isGaragista, isAdmin } = useAuth();
  if (!(isGaragista || isAdmin)) return <Navigate to="/painel" replace />;
  return (
    <div>
      <PageHeader title="Leads" subtitle="Gerencie os interessados nas suas ofertas." />
      <LeadsView sellerId={lojaId ?? undefined} />
    </div>
  );
}
```

- [ ] **Step 3: Menu no `PainelLayout.tsx`**

No bloco `manager`, adicionar como primeiro item:
```ts
{ to: "/painel/leads", label: "Leads", icon: "users" } as PanelNavItem,
```

- [ ] **Step 4: Rota em `App.tsx`**

Adicionar lazy import:
```ts
const SellerLeads = lazy(() =>
  import("@/features/seller/pages/Leads").then((m) => ({ default: m.Leads }))
);
```
E dentro das rotas de `/painel`:
```tsx
<Route path="leads" element={<SellerLeads />} />
```

- [ ] **Step 5: Gate + commit**

Run: `npx tsc --noEmit` → EXIT 0; `npm run build` → conclui.
```bash
git add src/features/leads/components/LeadsView.tsx src/features/seller/pages/Leads.tsx src/features/seller/PainelLayout.tsx src/App.tsx && git commit -m "feat(painel): tela de Leads do garagista (cards + funil + filtros + CSV)"
```

---

### Task 8: Página de Leads do superadmin (filtro por garagista)

**Files:**
- Create: `src/features/admin/pages/Leads.tsx`
- Modify: `src/features/admin/AdminLayout.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `LeadsView` (Task 7); `useActiveSellers`/lista de lojas (verificar hook existente em admin/queries — `useAdminStores`/`useSellers`). Produz select de garagista.

- [ ] **Step 1: `admin/pages/Leads.tsx`**

```tsx
import { useState } from "react";
import { PanelHeader } from "@/components/panel";
import { Select } from "@/components/ui-light";
import { useSellers } from "../queries"; // confirmar nome do hook de lojas/garagistas
import { LeadsView } from "@/features/leads/components/LeadsView";

export function Leads() {
  const { data: sellers } = useSellers();
  const garagistas = (sellers ?? []).filter((s) => s.role === "garagista");
  const [sellerId, setSellerId] = useState<string>("");

  return (
    <div>
      <PanelHeader title="Leads" subtitle="Interessados em todas as garagens" />
      <div className="mb-4 max-w-xs">
        <Select value={sellerId} onChange={(e) => setSellerId(e.target.value)}>
          <option value="">Todos os garagistas</option>
          {garagistas.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </Select>
      </div>
      <LeadsView sellerId={sellerId || undefined} />
    </div>
  );
}
```
(Antes de implementar: confirmar em `src/features/admin/queries.ts` o hook que lista garagistas e os campos `id/name/role`. Ajustar o import/uso conforme o existente — ex.: `useAdminSellers`.)

- [ ] **Step 2: Menu no `AdminLayout.tsx`**

Adicionar item de menu "Leads" → `/dashboard/leads` (ícone `users`), seguindo o padrão dos itens existentes do AdminLayout.

- [ ] **Step 3: Rota em `App.tsx`**

Lazy import:
```ts
const AdminLeads = lazy(() =>
  import("@/features/admin/pages/Leads").then((m) => ({ default: m.Leads }))
);
```
Dentro das rotas de `/dashboard`:
```tsx
<Route path="leads" element={<AdminLeads />} />
```

- [ ] **Step 4: Gate + commit + deploy**

Run: `npx tsc --noEmit` → EXIT 0; `npm run build` → conclui.
```bash
git add src/features/admin/pages/Leads.tsx src/features/admin/AdminLayout.tsx src/App.tsx && git commit -m "feat(admin): página de Leads com filtro por garagista"
```
Deploy final (push + VPS) conforme `[[deploy-vps-revvio]]`.

---

## Self-Review

**Spec coverage:**
- Tabela/enum/clicks/RPC/RLS → Task 1. ✅
- Captura (cidade + insert) + tracking → Task 4. ✅
- Tela garagista cards + filtros + top clicados + CSV → Tasks 5+7. ✅
- Kanban DnD → Task 6. ✅
- Visão admin filtrável por garagista → Task 8. ✅
- Tipos/estágios → Task 2; hooks → Task 3. ✅

**Pontos a confirmar na execução (não bloqueiam o plano):**
- `Badge` de `ui-light` aceita `className`? Se não, trocar por `<span>` em `LeadCard` (Task 5, Step 3 já tem nota).
- Nome real do hook de listagem de garagistas no admin (Task 8, Step 1 tem nota).
- `supabase db push --db-url` aplica a migration; senão, fallback SQL Editor (Task 1).

**Type consistency:** `LeadStage`, `LeadWithVehicle`, `NewLead`, assinaturas de hooks conferidas entre tasks. `sellerId` opcional propagado em `useLeads`/`useUpdateLeadStage`/`useTopClicked`/`LeadsView`.
