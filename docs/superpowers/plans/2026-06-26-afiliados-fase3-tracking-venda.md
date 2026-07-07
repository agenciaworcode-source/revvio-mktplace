# Afiliados — Fase 3 (tracking de visita + atribuição na venda + sugestão + sinalizar venda + gating admin) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar a malha do sistema de afiliados: capturar a visita via `?ref=` na página pública, permitir o garagista atribuir a venda a um afiliado (com sugestão automática), o afiliado sinalizar uma venda (in-app + e-mail), e o admin ligar/desligar afiliados por plano.

**Architecture:** Reaproveita o que já existe — `rv_sellers role='afiliado'`, `register_sale` v4 (já aceita `p_affiliate_id`), `rv_click_events` (`affiliate_link_visit`), `private.notify_email`, e o registry de templates de e-mail. Duas migrations novas (uma tabela de sinalização + dois RPCs), captura de ref no front público, e ajustes nas telas de venda (garagista), painel do afiliado, painel do garagista (Afiliados) e admin (Planos).

**Tech Stack:** React + TypeScript + Vite, react-hook-form + zod, @tanstack/react-query, supabase-js, Postgres/Supabase (RLS + funções security definer), Edge Functions Deno (send-email).

## Global Constraints

- **Gate de front:** `npm run build` (`tsc -b && vite build`) verde. Não há framework de testes unitários — o "teste" de cada task de front é o build + verificação manual leve descrita na task.
- **Gate de DB:** `supabase db reset` aplica a chain inteira (0001→nova) limpa no stack LOCAL (Docker já de pé). Checagem de SQL via `docker exec supabase_db_revvio psql -U postgres -d postgres -tAc "..."` (NÃO há `psql` no host).
- **Numeração de migrations:** a última é `0038`. As novas são `0039` e `0040`.
- **Edge functions NÃO são deployáveis pelo assistente** (conta sem Management API). `send-email` (novo template) e qualquer função são deployadas **pelo usuário** com `SUPABASE_ACCESS_TOKEN=<PAT da conta dona> supabase functions deploy <nome> --project-ref ahtisetxygjyfvhguckl`. Confirmar antes com `supabase projects list` que `ahtisetxygjyfvhguckl` aparece.
- **Migrations no remoto:** `DBURL=$(grep '^SUPABASE_DB_URL=' .env.local | cut -d= -f2- | tr -d '"'); supabase db push --db-url "$DBURL" --dry-run` e depois sem `--dry-run`. Histórico está em sync até 0038.
- **Tipos:** `npm run types:gen` (sempre `--local`; o remoto compartilhado tem tabelas não-Revvio). Casts `as never` temporários só até o regen incluir os novos RPCs/colunas.
- **Casas decimais / dinheiro:** usar `formatCurrency` de `@/lib/format`. Telefone: `maskPhone` de `@/lib/masks`.
- **Deploy VPS (front):** build → backup → `rsync -az --delete --chown=ubuntu:ubuntu -e "ssh -o BatchMode=yes" dist/ root@72.60.243.106:/var/www/revvio/` → `ssh root@72.60.243.106 'pm2 reload revvio'` → verificar HTTP 200.

---

## File Structure

**Migrations (novas):**
- `supabase/migrations/0039_affiliate_sale_signals.sql` — tabela `rv_affiliate_sale_signals` + RLS + RPC `signal_affiliate_sale` + trigger de e-mail.
- `supabase/migrations/0040_suggest_affiliate_for_sale.sql` — RPC `suggest_affiliate_for_sale`.

**Edge / e-mail:**
- `supabase/functions/_shared/email-templates.ts` — novo template `affiliate_sale_signal` (modificar).

**Front:**
- `src/features/public/pages/VehicleDetails.tsx` — captura do `?ref=` (modificar).
- `src/features/public/queries.ts` — `useLogAffiliateVisit` (modificar/adicionar).
- `src/features/seller/queries.ts` — `useLojaAffiliates`, `useSuggestAffiliate`, `useAffiliateSaleSignals`; estender `RegisterSaleInput`/`useRegisterSale` com `affiliate_id` (modificar).
- `src/features/seller/pages/Sales.tsx` — seletor "Responsável" (vendedor OU afiliado) + sugestão (modificar).
- `src/features/seller/pages/Afiliados.tsx` — seção "Vendas sinalizadas" (modificar).
- `src/features/affiliate/queries.ts` — `useSignalSale` (modificar).
- `src/features/affiliate/pages/Desempenho.tsx` — botão "Avisei uma venda" (modificar).
- `src/features/admin/pages/Plans.tsx` — checkbox `affiliates_enabled` no modal (modificar).
- `src/features/admin/queries.ts` — incluir `affiliates_enabled` no upsert e no tipo (modificar).

---

## Task 1: DB — tabela de sinalização + RPC `signal_affiliate_sale` + trigger de e-mail

**Files:**
- Create: `supabase/migrations/0039_affiliate_sale_signals.sql`

**Interfaces:**
- Produces (SQL): tabela `public.rv_affiliate_sale_signals(id uuid, loja_id uuid, affiliate_id uuid, vehicle_id bigint null, note text null, status text default 'novo', created_at timestamptz)`; função `public.signal_affiliate_sale(p_vehicle_id bigint default null, p_note text default null) returns uuid` (grant a `authenticated`).

- [ ] **Step 1: Escrever a migration**

Criar `supabase/migrations/0039_affiliate_sale_signals.sql`:

```sql
-- 0039_affiliate_sale_signals.sql
-- "Sinalizar venda": o afiliado avisa o garagista que ajudou numa venda.
-- NÃO cria venda — só um registro in-app + e-mail ao garagista.

create table public.rv_affiliate_sale_signals (
  id           uuid primary key default gen_random_uuid(),
  loja_id      uuid not null references public.rv_sellers(id) on delete cascade,
  affiliate_id uuid not null references public.rv_sellers(id) on delete cascade,
  vehicle_id   bigint references public.rv_vehicles(id) on delete set null,
  note         text,
  status       text not null default 'novo' check (status in ('novo','lido')),
  created_at   timestamptz not null default now()
);
create index idx_rv_aff_signals_loja on public.rv_affiliate_sale_signals(loja_id, created_at desc);
create index idx_rv_aff_signals_aff  on public.rv_affiliate_sale_signals(affiliate_id);

alter table public.rv_affiliate_sale_signals enable row level security;

-- Afiliado lê os próprios sinais; garagista/admin leem os da loja.
create policy "aff_signals_read" on public.rv_affiliate_sale_signals
  for select to authenticated using (
    public.is_admin()
    or (public.is_loja_manager() and loja_id = public.current_loja())
    or affiliate_id = public.current_person()
  );

-- Garagista/admin marcam como lido (status). Afiliado não atualiza.
create policy "aff_signals_update_manager" on public.rv_affiliate_sale_signals
  for update to authenticated using (
    public.is_admin()
    or (public.is_loja_manager() and loja_id = public.current_loja())
  ) with check (
    public.is_admin()
    or (public.is_loja_manager() and loja_id = public.current_loja())
  );
-- INSERT só pelo RPC security definer (sem policy de insert direto).

-- RPC: o afiliado sinaliza uma venda. Resolve loja/afiliado pelo current_person.
create or replace function public.signal_affiliate_sale(
  p_vehicle_id bigint default null,
  p_note       text   default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_aff   uuid;
  v_loja  uuid;
  v_id    uuid;
begin
  select id, parent_id into v_aff, v_loja
    from public.rv_sellers
   where user_id = auth.uid() and role = 'afiliado' and status = 'active';

  if v_aff is null or v_loja is null then
    raise exception 'Apenas afiliados ativos podem sinalizar vendas.';
  end if;

  -- se veio vehicle_id, ele precisa pertencer à loja do afiliado
  if p_vehicle_id is not null
     and not exists (select 1 from public.rv_vehicles
                      where id = p_vehicle_id and seller_id = v_loja) then
    raise exception 'Veículo % não pertence à loja.', p_vehicle_id;
  end if;

  insert into public.rv_affiliate_sale_signals (loja_id, affiliate_id, vehicle_id, note)
  values (v_loja, v_aff, p_vehicle_id, nullif(btrim(p_note), ''))
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.signal_affiliate_sale(bigint, text) from public;
grant execute on function public.signal_affiliate_sale(bigint, text) to authenticated;

-- Trigger de e-mail ao garagista (best-effort via private.notify_email).
create or replace function private.on_affiliate_signal_insert()
returns trigger language plpgsql security definer
set search_path = private, public as $$
declare
  v_garagista_email text;
  v_aff_name        text;
  v_veh             text;
begin
  select email into v_garagista_email
    from public.rv_sellers where id = new.loja_id;
  select name into v_aff_name
    from public.rv_sellers where id = new.affiliate_id;
  select coalesce(make || ' ' || model, '') into v_veh
    from public.rv_vehicles where id = new.vehicle_id;

  perform private.notify_email(
    'affiliate_sale_signal', v_garagista_email,
    jsonb_build_object(
      'affiliate', coalesce(v_aff_name, 'Afiliado'),
      'vehicle',   nullif(v_veh, ''),
      'note',      new.note
    )
  );
  return new;
end;
$$;

create trigger trg_affiliate_signal_email
  after insert on public.rv_affiliate_sale_signals
  for each row execute function private.on_affiliate_signal_insert();
```

- [ ] **Step 2: Aplicar e verificar a chain**

Run: `supabase db reset`
Expected: aplica até `0039` sem erro (`Applying migration 0039_affiliate_sale_signals.sql...` e termina limpo).

- [ ] **Step 3: Checar objetos criados**

Run:
```bash
docker exec supabase_db_revvio psql -U postgres -d postgres -tAc \
  "select to_regclass('public.rv_affiliate_sale_signals') is not null,
          (select count(*) from pg_proc where proname='signal_affiliate_sale')=1;"
```
Expected: `t|t`

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0039_affiliate_sale_signals.sql
git commit -m "feat(db): sinalizacao de venda do afiliado (tabela + RPC + email)"
```

---

## Task 2: E-mail — template `affiliate_sale_signal`

**Files:**
- Modify: `supabase/functions/_shared/email-templates.ts`

**Interfaces:**
- Consumes: `data` jsonb do trigger (`affiliate`, `vehicle`, `note`) definido na Task 1.
- Produces: entrada `affiliate_sale_signal` no `templates` registry.

> Não há gate de build para Deno (fora do tsconfig `include:["src"]`). O gate desta task é revisão de corretude + o fato de `npm run build` continuar verde (não toca em `src`). Deploy do `send-email` é do usuário (Task 9).

- [ ] **Step 1: Adicionar o template**

No objeto `export const templates: Record<string, Template> = { ... }` em `supabase/functions/_shared/email-templates.ts`, adicionar uma entrada (depois de `afiliado_welcome` para manter os afiliados juntos):

```ts
  // afiliado sinalizou uma venda (→ garagista)
  affiliate_sale_signal: (d) => ({
    subject: "Um afiliado sinalizou uma venda — REVVIO",
    html: layout({
      heading: "Venda sinalizada por afiliado",
      body: `<p>O afiliado <strong>${str(d, "affiliate")}</strong> avisou que ajudou numa venda${
        str(d, "vehicle") ? ` do <strong>${str(d, "vehicle")}</strong>` : ""
      }.</p>${
        str(d, "note") ? `<p style="margin-top:8px">Observação: "${str(d, "note")}"</p>` : ""
      }<p style="margin-top:8px">Abra o painel para registrar a venda e atribuí-la a este afiliado.</p>`,
      cta: { label: "Abrir Afiliados", href: `${APP_URL}/painel/afiliados` },
    }),
  }),
```

- [ ] **Step 2: Verificar que o registry continua válido (sem quebrar o build do front)**

Run: `npm run build`
Expected: build verde (o arquivo Deno não está em `src`, mas confirma que nada do front quebrou).

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/_shared/email-templates.ts
git commit -m "feat(email): template affiliate_sale_signal (aviso ao garagista)"
```

---

## Task 3: DB — RPC `suggest_affiliate_for_sale`

**Files:**
- Create: `supabase/migrations/0040_suggest_affiliate_for_sale.sql`

**Interfaces:**
- Produces (SQL): `public.suggest_affiliate_for_sale(p_vehicle_id bigint, p_buyer_phone text) returns table(affiliate_id uuid, affiliate_name text)` (grant a `authenticated`).

- [ ] **Step 1: Escrever a migration**

Criar `supabase/migrations/0040_suggest_affiliate_for_sale.sql`:

```sql
-- 0040_suggest_affiliate_for_sale.sql
-- Sugere o afiliado a partir do telefone do comprador: casa o telefone com
-- um rv_buyers e procura a visita mais recente via ref (affiliate_link_visit)
-- daquele comprador, escopada à loja do chamador. Só sugere se houver
-- comprador rastreável; senão retorna vazio (atribuição manual).

create or replace function public.suggest_affiliate_for_sale(
  p_vehicle_id bigint,
  p_buyer_phone text
) returns table (affiliate_id uuid, affiliate_name text)
language plpgsql security definer set search_path = public as $$
declare
  v_loja  uuid := public.current_loja();
  v_digits text := regexp_replace(coalesce(p_buyer_phone, ''), '\D', '', 'g');
begin
  if v_loja is null or length(v_digits) < 10 then
    return; -- sem loja ou telefone insuficiente → sem sugestão
  end if;

  return query
  select ce.affiliate_id, s.name
    from public.rv_click_events ce
    join public.rv_buyers b on b.id = ce.buyer_id
    join public.rv_sellers s on s.id = ce.affiliate_id
   where ce.kind = 'affiliate_link_visit'
     and ce.seller_id = v_loja
     and ce.affiliate_id is not null
     and (p_vehicle_id is null or ce.vehicle_id = p_vehicle_id)
     and regexp_replace(coalesce(b.phone, ''), '\D', '', 'g') = v_digits
     and s.status = 'active'
   order by ce.created_at desc
   limit 1;
end;
$$;

revoke all on function public.suggest_affiliate_for_sale(bigint, text) from public;
grant execute on function public.suggest_affiliate_for_sale(bigint, text) to authenticated;
```

> Nota de design: `rv_click_events.seller_id` guarda a loja (ver `log_affiliate_visit` em 0037, que insere `v_loja` em `seller_id`). A função é `security definer` para casar `rv_buyers` (RLS própria) sem expor a tabela; só devolve id+nome do afiliado.

- [ ] **Step 2: Aplicar e verificar a chain**

Run: `supabase db reset`
Expected: aplica até `0040` limpo.

- [ ] **Step 3: Checar a função**

Run:
```bash
docker exec supabase_db_revvio psql -U postgres -d postgres -tAc \
  "select count(*) from pg_proc where proname='suggest_affiliate_for_sale';"
```
Expected: `1`

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0040_suggest_affiliate_for_sale.sql
git commit -m "feat(db): RPC suggest_affiliate_for_sale (sugestao por telefone)"
```

---

## Task 4: Front — captura do `?ref=` na página pública

**Files:**
- Modify: `src/features/public/queries.ts`
- Modify: `src/features/public/pages/VehicleDetails.tsx`

**Interfaces:**
- Consumes: RPC `log_affiliate_visit(p_ref_code text, p_vehicle_id bigint)` (já existe, migration 0037).
- Produces: hook `useLogAffiliateVisit(): (refCode: string, vehicleId: number) => void` em `src/features/public/queries.ts`.

- [ ] **Step 1: Adicionar o hook de visita**

Em `src/features/public/queries.ts`, adicionar (no topo confirme os imports de `useMutation`/`supabase`; se não existirem, importe `import { useMutation } from "@tanstack/react-query";` e `import { supabase } from "@/lib/supabase";`):

```ts
/** Loga a visita de um carro via link de afiliado (?ref=). Best-effort. */
export function useLogAffiliateVisit() {
  const m = useMutation({
    mutationFn: async (input: { refCode: string; vehicleId: number }) => {
      const { error } = await supabase.rpc("log_affiliate_visit", {
        p_ref_code: input.refCode,
        p_vehicle_id: input.vehicleId,
      });
      if (error) throw error;
    },
  });
  return (refCode: string, vehicleId: number) =>
    m.mutate({ refCode, vehicleId }, { onError: () => {} });
}
```

- [ ] **Step 2: Capturar o ref no VehicleDetails**

Em `src/features/public/pages/VehicleDetails.tsx`:

1. Trocar o import de `react-router-dom` para incluir `useSearchParams`:
```ts
import { Link, useParams, useSearchParams } from "react-router-dom";
```
2. Adicionar o import do hook:
```ts
import { useLogAffiliateVisit } from "../queries";
```
3. Dentro de `export function VehicleDetails()`, logo após `const { data, isLoading } = usePublicVehicle(id);`, adicionar:
```ts
  const [searchParams] = useSearchParams();
  const logVisit = useLogAffiliateVisit();

  // Captura o ?ref= do afiliado: guarda no localStorage (sobrevive à navegação
  // até um eventual login) e loga a visita uma vez por carga, quando o carro
  // já estiver carregado.
  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) {
      try {
        localStorage.setItem("rv_ref", ref);
      } catch {
        /* storage pode falhar em modo privado; ignora */
      }
    }
    const stored = ref ?? (() => {
      try { return localStorage.getItem("rv_ref"); } catch { return null; }
    })();
    if (stored && data?.id) {
      logVisit(stored, data.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.id, searchParams]);
```
(O `useEffect` já está importado no topo do arquivo.)

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build verde.

- [ ] **Step 4: Verificação manual leve**

Abrir `/<host>/veiculo/:id?ref=<ref_code de um afiliado ativo>` no app local; confirmar (Network) uma chamada a `rpc/log_affiliate_visit` retornando 204. Conferir `localStorage.rv_ref`.

- [ ] **Step 5: Commit**

```bash
git add src/features/public/queries.ts src/features/public/pages/VehicleDetails.tsx
git commit -m "feat(public): captura do ?ref= e log de visita do afiliado"
```

---

## Task 5: Front — seletor "Responsável" (vendedor OU afiliado) no registro de venda

**Files:**
- Modify: `src/features/seller/queries.ts`
- Modify: `src/features/seller/pages/Sales.tsx`

**Interfaces:**
- Consumes: `register_sale` (já aceita `p_affiliate_id`, migration 0036); `useAffiliates(lojaId)` (já existe).
- Produces: `useLojaAffiliates(lojaId?)` (afiliados ativos da loja); `RegisterSaleInput` ganha `affiliate_id?: string | null`; `useRegisterSale` passa `p_affiliate_id`.

- [ ] **Step 1: Estender o input/mutation de venda**

Em `src/features/seller/queries.ts`:

1. Em `RegisterSaleInput`, tornar `vendedor_id` aceitar exclusividade e adicionar `affiliate_id`:
```ts
export type RegisterSaleInput = {
  vehicle_id: number;
  vendedor_id: string | null;
  affiliate_id?: string | null;
  buyer_name: string;
  buyer_phone: string | null;
  sale_price: number;
  payment_method: PaymentMethod;
  sale_date: string;
  sale_reason: string;
};
```
2. Em `useRegisterSale`, passar `p_affiliate_id` e mandar `null` no lado não usado:
```ts
      const { data, error } = await supabase.rpc("register_sale", {
        p_vehicle_id: input.vehicle_id,
        p_vendedor_id: input.vendedor_id ?? undefined,
        p_affiliate_id: input.affiliate_id ?? undefined,
        p_buyer_name: input.buyer_name,
        p_sale_price: input.sale_price,
        p_payment_method: input.payment_method,
        p_buyer_phone: input.buyer_phone ?? undefined,
        p_sale_date: input.sale_date,
        p_sale_reason: input.sale_reason,
      } as never);
```
3. Adicionar o hook de afiliados ativos (reaproveita `useAffiliates`, mas só ativos — adicionar logo após `useAffiliates`):
```ts
/** Afiliados ATIVOS da loja, para o seletor de responsável na venda. */
export function useLojaAffiliates(lojaId?: string): UseQueryResult<Seller[]> {
  return useQuery({
    queryKey: ["loja-affiliates-active", lojaId],
    enabled: !!lojaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rv_sellers")
        .select("*")
        .eq("parent_id", lojaId!)
        .eq("role", "afiliado" as never)
        .eq("status", "active")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Seller[];
    },
  });
}
```

- [ ] **Step 2: Trocar o seletor no formulário de venda**

Em `src/features/seller/pages/Sales.tsx`:

1. Import: adicionar `useLojaAffiliates` à linha de imports de `../queries`.
2. No schema zod (perto de `vendedor_id: z.string()...`), trocar por um campo único `responsavel` que codifica tipo+id, e validar:
```ts
  // "responsavel" = `${tipo}:${id}` onde tipo ∈ {vendedor, afiliado}
  responsavel: z.string().min(1, "Selecione o responsável"),
```
   Remover a linha antiga `vendedor_id: z.string().min(1, ...)`.
3. Em `RegisterSaleForm`, adicionar o hook e ajustar default:
```ts
  const affiliates = useLojaAffiliates(lojaId ?? undefined);
```
   E no `defaultValues`, trocar `vendedor_id: isVendedor ? personId ?? "" : ""` por:
```ts
      responsavel: isVendedor && personId ? `vendedor:${personId}` : "",
```
4. Em `onSubmit`, decodificar `responsavel` em vendedor_id/affiliate_id (exclusivo):
```ts
      const [tipo, rid] = values.responsavel.split(":");
      await register_.mutateAsync({
        vehicle_id: values.vehicle_id,
        vendedor_id: tipo === "vendedor" ? rid : null,
        affiliate_id: tipo === "afiliado" ? rid : null,
        buyer_name: values.buyer_name,
        buyer_phone: values.buyer_phone || null,
        sale_price: values.sale_price,
        payment_method: values.payment_method,
        sale_date: values.sale_date,
        sale_reason: values.sale_reason,
      });
```
5. Trocar o bloco do `<Field label="Vendedor">` (e o `input hidden` do vendedor) por um seletor "Responsável" com optgroups:
```tsx
      {isVendedor ? (
        <input type="hidden" value={`vendedor:${personId ?? ""}`} {...register("responsavel")} />
      ) : (
        <Field label="Responsável pela venda" error={errors.responsavel?.message}>
          <Select {...register("responsavel")} defaultValue="">
            <option value="" disabled>
              Selecione o responsável…
            </option>
            <optgroup label="Equipe">
              {seller && (
                <option value={`vendedor:${seller.id}`}>
                  {seller.name} ({seller.commission_rate}%) — você (garagista)
                </option>
              )}
              {(team.data ?? [])
                .filter((v) => v.status === "active")
                .map((v) => (
                  <option key={`v-${v.id}`} value={`vendedor:${v.id}`}>
                    {v.name} ({v.commission_rate}%)
                  </option>
                ))}
            </optgroup>
            {(affiliates.data ?? []).length > 0 && (
              <optgroup label="Afiliados">
                {(affiliates.data ?? []).map((a) => (
                  <option key={`a-${a.id}`} value={`afiliado:${a.id}`}>
                    {a.name} ({a.commission_rate}%) — afiliado
                  </option>
                ))}
              </optgroup>
            )}
          </Select>
        </Field>
      )}
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build verde.

- [ ] **Step 4: Verificação manual leve**

Como garagista, abrir o registro de venda; confirmar que o seletor mostra Equipe + Afiliados; registrar uma venda atribuída a um afiliado e conferir em Financeiro/Comissões que a comissão saiu com a taxa do afiliado (e `vendedor` nulo).

- [ ] **Step 5: Commit**

```bash
git add src/features/seller/queries.ts src/features/seller/pages/Sales.tsx
git commit -m "feat(seller): seletor de responsavel (vendedor OU afiliado) na venda"
```

---

## Task 6: Front — sugestão automática do afiliado na venda

**Files:**
- Modify: `src/features/seller/queries.ts`
- Modify: `src/features/seller/pages/Sales.tsx`

**Interfaces:**
- Consumes: RPC `suggest_affiliate_for_sale` (Task 3); `responsavel`/`affiliates` (Task 5).
- Produces: `useSuggestAffiliate(): (vehicleId: number, phone: string) => Promise<{ id: string; name: string } | null>`.

- [ ] **Step 1: Hook de sugestão**

Em `src/features/seller/queries.ts`, adicionar:
```ts
/** Sugere o afiliado a partir do telefone do comprador (RPC server-side). */
export function useSuggestAffiliate() {
  return async (vehicleId: number, phone: string) => {
    const { data, error } = await supabase.rpc("suggest_affiliate_for_sale", {
      p_vehicle_id: vehicleId,
      p_buyer_phone: phone,
    } as never);
    if (error) return null;
    const row = (data as { affiliate_id: string; affiliate_name: string }[] | null)?.[0];
    return row ? { id: row.affiliate_id, name: row.affiliate_name } : null;
  };
}
```

- [ ] **Step 2: Disparar a sugestão no formulário**

Em `src/features/seller/pages/Sales.tsx`, dentro de `RegisterSaleForm`:

1. Adicionar estado e hook:
```ts
  const suggest = useSuggestAffiliate();
  const [suggestion, setSuggestion] = useState<{ id: string; name: string } | null>(null);
```
   (e importar `useSuggestAffiliate` de `../queries`).
2. Adicionar uma função que, dado o telefone atual e o veículo selecionado, busca a sugestão. Usar `watch` do react-hook-form para ler `vehicle_id` e o telefone. Adicionar ao `useForm` a desestruturação de `watch` e `setValue` (setValue já existe):
```ts
  const watchedPhone = watch("buyer_phone");
  const watchedVehicle = watch("vehicle_id");
```
3. Adicionar um efeito debounced que chama a sugestão quando há telefone (≥10 dígitos) e veículo:
```ts
  useEffect(() => {
    const digits = (watchedPhone ?? "").replace(/\D/g, "");
    if (digits.length < 10 || !watchedVehicle) {
      setSuggestion(null);
      return;
    }
    const t = setTimeout(async () => {
      const s = await suggest(Number(watchedVehicle), watchedPhone ?? "");
      setSuggestion(s);
      if (s) setValue("responsavel", `afiliado:${s.id}`, { shouldValidate: true });
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedPhone, watchedVehicle]);
```
4. Renderizar o aviso de sugestão acima do seletor de Responsável (dentro do ramo do garagista):
```tsx
      {suggestion && !isVendedor && (
        <Alert variant="info">
          Este comprador veio pelo link do afiliado <strong>{suggestion.name}</strong>. Pré-selecionamos
          ele como responsável — você pode confirmar ou trocar.
        </Alert>
      )}
```
   (Confirmar que `Alert` já está importado em Sales.tsx — está; usar variant `info` se existir, senão `success`.)

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build verde.

- [ ] **Step 4: Verificação manual leve**

Pré-condição: ter uma visita `affiliate_link_visit` com `buyer_id` cujo `rv_buyers.phone` bate. No registro de venda, digitar esse telefone e o veículo correspondente → o afiliado é pré-selecionado e o aviso aparece. Telefone sem rastro → sem sugestão (seletor manual).

- [ ] **Step 5: Commit**

```bash
git add src/features/seller/queries.ts src/features/seller/pages/Sales.tsx
git commit -m "feat(seller): sugestao automatica de afiliado por telefone na venda"
```

---

## Task 7: Front — "Sinalizar venda" (afiliado) + lista in-app (garagista)

**Files:**
- Modify: `src/features/affiliate/queries.ts`
- Modify: `src/features/affiliate/pages/Desempenho.tsx`
- Modify: `src/features/seller/queries.ts`
- Modify: `src/features/seller/pages/Afiliados.tsx`

**Interfaces:**
- Consumes: RPC `signal_affiliate_sale` (Task 1); tabela `rv_affiliate_sale_signals` (Task 1).
- Produces: `useSignalSale()` (afiliado); `useAffiliateSaleSignals(lojaId?)` (garagista).

- [ ] **Step 1: Hook do afiliado para sinalizar**

Em `src/features/affiliate/queries.ts`, adicionar:
```ts
/** Afiliado sinaliza ao garagista que ajudou numa venda (não cria venda). */
export function useSignalSale() {
  return useMutation({
    mutationFn: async (input: { note?: string | null; vehicleId?: number | null }) => {
      const { error } = await supabase.rpc("signal_affiliate_sale", {
        p_vehicle_id: input.vehicleId ?? undefined,
        p_note: input.note ?? undefined,
      } as never);
      if (error) throw error;
    },
  });
}
```

- [ ] **Step 2: Botão "Avisei uma venda" no painel do afiliado**

Em `src/features/affiliate/pages/Desempenho.tsx`, adicionar um cartão de ação no fim do componente (abaixo do grid de métricas), com um campo de observação opcional e o botão:
```tsx
      <Card className="mt-6 flex flex-col gap-3 p-5">
        <p className="text-sm font-semibold text-slate-900">Ajudou numa venda?</p>
        <p className="text-xs text-slate-500">
          Avise o garagista. Ele registra a venda e atribui a você.
        </p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Observação (opcional): qual carro, qual comprador…"
          className="rounded-lg border border-slate-200 p-2 text-sm"
        />
        {signalMsg && <Alert variant="success">{signalMsg}</Alert>}
        <div>
          <Button
            onClick={async () => {
              try {
                await signal.mutateAsync({ note: note || null });
                setNote("");
                setSignalMsg("Aviso enviado ao garagista.");
              } catch {
                setSignalMsg("Não foi possível enviar agora.");
              }
            }}
            disabled={signal.isPending}
          >
            Avisei uma venda
          </Button>
        </div>
      </Card>
```
Adicionar os imports/estado necessários no topo do componente:
```ts
import { useState } from "react";
import { Alert, Button, Card, PageHeader, Spinner } from "@/components/ui-light";
import { useAffiliatePerformance, useSignalSale } from "../queries";
// dentro do componente:
  const signal = useSignalSale();
  const [note, setNote] = useState("");
  const [signalMsg, setSignalMsg] = useState<string | null>(null);
```

- [ ] **Step 3: Hook do garagista para listar sinais**

Em `src/features/seller/queries.ts`, adicionar:
```ts
export type AffiliateSaleSignal = {
  id: string;
  affiliate_name: string | null;
  vehicle_label: string | null;
  note: string | null;
  status: string;
  created_at: string;
};

/** Sinais de venda enviados pelos afiliados da loja (in-app). */
export function useAffiliateSaleSignals(lojaId?: string): UseQueryResult<AffiliateSaleSignal[]> {
  return useQuery({
    queryKey: ["affiliate-sale-signals", lojaId],
    enabled: !!lojaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rv_affiliate_sale_signals")
        .select("id, note, status, created_at, affiliate:rv_sellers!rv_affiliate_sale_signals_affiliate_id_fkey(name), vehicle:rv_vehicles(make, model)")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      type Raw = {
        id: string; note: string | null; status: string; created_at: string;
        affiliate: { name: string } | null;
        vehicle: { make: string; model: string } | null;
      };
      return ((data ?? []) as unknown as Raw[]).map((r) => ({
        id: r.id,
        affiliate_name: r.affiliate?.name ?? null,
        vehicle_label: r.vehicle ? `${r.vehicle.make} ${r.vehicle.model}` : null,
        note: r.note,
        status: r.status,
        created_at: r.created_at,
      }));
    },
  });
}
```

- [ ] **Step 4: Seção "Vendas sinalizadas" no painel Afiliados do garagista**

Em `src/features/seller/pages/Afiliados.tsx`, importar e usar `useAffiliateSaleSignals(lojaId)` e renderizar uma seção (acima ou abaixo da lista de afiliados) com a lista (afiliado, carro, observação, data). Se vazio, não renderizar a seção (ou mostrar um texto curto). Exemplo de bloco:
```tsx
      {(signals.data ?? []).length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Vendas sinalizadas</h2>
          <div className="flex flex-col gap-2">
            {(signals.data ?? []).map((s) => (
              <Card key={s.id} className="flex flex-col gap-1 p-4 text-sm">
                <span className="font-semibold text-slate-900">
                  {s.affiliate_name ?? "Afiliado"}
                  {s.vehicle_label ? ` · ${s.vehicle_label}` : ""}
                </span>
                {s.note && <span className="text-slate-600">{s.note}</span>}
                <span className="text-xs text-slate-400">
                  {new Date(s.created_at).toLocaleDateString("pt-BR")}
                </span>
              </Card>
            ))}
          </div>
        </section>
      )}
```
Adicionar `const signals = useAffiliateSaleSignals(lojaId ?? undefined);` (e `lojaId` de `useAuth()`), e o import de `useAffiliateSaleSignals`.

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: build verde.

- [ ] **Step 6: Verificação manual leve**

Como afiliado, clicar "Avisei uma venda" com uma observação → mensagem de sucesso. Como garagista da mesma loja, ver o item em "Vendas sinalizadas".

- [ ] **Step 7: Commit**

```bash
git add src/features/affiliate/queries.ts src/features/affiliate/pages/Desempenho.tsx src/features/seller/queries.ts src/features/seller/pages/Afiliados.tsx
git commit -m "feat(affiliate): sinalizar venda (afiliado) + lista in-app (garagista)"
```

---

## Task 8: Front — Admin liga/desliga `affiliates_enabled` por plano (gap AC#1)

**Files:**
- Modify: `src/features/admin/queries.ts`
- Modify: `src/features/admin/pages/Plans.tsx`

**Interfaces:**
- Consumes: `rv_pricing_plans` (coluna `affiliates_enabled` já existe, migration 0035; RLS `pricing_admin_write` já existe).
- Produces: `affiliates_enabled` no upsert de plano e no formulário admin.

- [ ] **Step 1: Incluir `affiliates_enabled` no upsert**

Em `src/features/admin/queries.ts`, no upsert de `rv_pricing_plans` (perto das linhas 436/466), incluir o campo `affiliates_enabled` no objeto `fields` (booleano). Garantir que o tipo do form de plano (PlanInput) tenha `affiliates_enabled: boolean`.

- [ ] **Step 2: Adicionar o checkbox no modal de plano**

Em `src/features/admin/pages/Plans.tsx` (no `PlanFormModal`, perto dos outros checkboxes das linhas 249/258), adicionar:
```tsx
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 accent-brand"
              checked={state.affiliates_enabled}
              onChange={(e) => set("affiliates_enabled", e.target.checked)}
            />
            Habilita afiliados neste plano
          </label>
```
E incluir `affiliates_enabled` no `state` inicial do form (default a partir de `p.affiliates_enabled ?? false` na edição, `false` no novo).

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build verde.

- [ ] **Step 4: Verificação manual leve**

Como admin, editar um plano (ex.: Essencial), marcar "Habilita afiliados", salvar; reabrir e confirmar que ficou marcado. Confirmar que um garagista nesse plano passa a ver o CRUD de Afiliados.

- [ ] **Step 5: Commit**

```bash
git add src/features/admin/queries.ts src/features/admin/pages/Plans.tsx
git commit -m "feat(admin): toggle affiliates_enabled por plano (gap AC#1)"
```

---

## Task 9: Regen de tipos + deploy (migrations remoto + edge + front)

**Files:**
- Modify: `src/lib/database.generated.ts` (regen)
- Modify: arquivos com `as never` que deixarem de precisar (queries afetadas)

- [ ] **Step 1: Regen de tipos (local) e remoção dos casts**

Run: `npm run types:gen`
Depois, remover os `as never` que ficaram desnecessários (RPCs `signal_affiliate_sale`, `suggest_affiliate_for_sale`, `register_sale` com `p_affiliate_id`, e o `.eq("role","afiliado")`/select de `rv_affiliate_sale_signals`). Rodar `npm run build` e ajustar só o que o compilador exigir.

Run: `npm run build`
Expected: build verde.

- [ ] **Step 2: Commit do regen**

```bash
git add src/lib/database.generated.ts src/features
git commit -m "chore(affiliate): regen tipos fase 3 + remove casts as never"
```

- [ ] **Step 3: Migrations no remoto**

```bash
DBURL=$(grep '^SUPABASE_DB_URL=' .env.local | cut -d= -f2- | tr -d '"')
supabase db push --db-url "$DBURL" --dry-run   # confirmar SÓ 0039 e 0040
supabase db push --db-url "$DBURL"
```
Verificar via REST que `rpc/suggest_affiliate_for_sale` responde (401/200, não 404) e que `rv_affiliate_sale_signals` existe (GET com apikey → 200/empty).

- [ ] **Step 4: Edge function (SÓ O USUÁRIO)**

O template novo (`affiliate_sale_signal`) está no `send-email`. O usuário redeploya:
```bash
SUPABASE_ACCESS_TOKEN=<PAT da conta dona> supabase functions deploy send-email --project-ref ahtisetxygjyfvhguckl
```
(Confirmar antes: `supabase projects list` mostra `ahtisetxygjyfvhguckl`.)

- [ ] **Step 5: Deploy do front na VPS**

```bash
npm run build
ssh -o BatchMode=yes root@72.60.243.106 "cp -a /var/www/revvio /var/www/revvio.bak-$(date +%Y%m%d-%H%M)"
rsync -az --delete --chown=ubuntu:ubuntu -e "ssh -o BatchMode=yes" dist/ root@72.60.243.106:/var/www/revvio/
ssh -o BatchMode=yes root@72.60.243.106 'pm2 reload revvio'
```
Verificar HTTP 200 e bundle servido == local.

- [ ] **Step 6: Push**

```bash
git push origin main
```

---

## Self-Review (cobertura do spec)

- **AC#1 (admin gating por plano):** Task 8. ✓
- **AC#4 (visita via ?ref= registra affiliate_link_visit):** Task 4 (RPC já existia na Fase 1). ✓
- **AC#5 (atribuição na venda exclusiva + comissão do afiliado + sugestão):** Tasks 5 (seletor exclusivo, register_sale v4) + 6 (sugestão). ✓
- **AC#6 (afiliado sinaliza venda ao garagista):** Tasks 1+2+7 (RPC + e-mail + in-app). ✓
- **Fora de escopo desta fase:** relatórios consolidados garagista/admin (spec Fase 4 / ACs #7 e #8) — ficam para depois.
- **Notificação do sinal = in-app + e-mail:** in-app (Task 7) + e-mail (Tasks 1 trigger + 2 template). ✓
- **Limitação conhecida da sugestão:** só dispara quando o comprador tinha conta (`rv_buyers`) no momento da visita (buyer_id capturado) e o telefone digitado bate. Sem rastro → atribuição manual (consistente com o spec: "sem comprador rastreável → sem sugestão").

## Pendências de ambiente / notas

- `send-email` precisa de redeploy do usuário para o template novo funcionar (Task 9 Step 4). Até lá, o sinal aparece **in-app** normalmente; só o e-mail fica pendente.
- `private.email_config` precisa estar preenchida no remoto para o e-mail sair (já era requisito dos e-mails existentes).
