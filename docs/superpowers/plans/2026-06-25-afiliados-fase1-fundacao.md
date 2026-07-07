# Sistema de Afiliados — Fase 1 (Fundação) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a camada de banco do sistema de afiliados: enum `afiliado`, colunas novas, gating por plano, `register_sale` v4 (afiliado×vendedor exclusivo), RLS de leitura do afiliado e o RPC `log_affiliate_visit` — deixando a base pronta para as fases de UI.

**Architecture:** Afiliado é `rv_sellers` com `role='afiliado'`, `parent_id`=loja. Fase 1 é 100% SQL (4 migrations) + regeneração dos tipos TS. Nenhuma UI nova; o objetivo é que a base aplique limpa e o app continue compilando.

**Tech Stack:** PostgreSQL/Supabase (migrations em `supabase/migrations/`), Supabase CLI (stack local via Docker), TypeScript (tipos gerados em `src/lib/database.generated.ts`).

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-06-25-sistema-afiliados-design.md`. Esta fase implementa a seção "Modelo de dados", `register_sale` v4, a parte de RLS do afiliado e `log_affiliate_visit`.
- **Numeração de migrations:** continuar a sequência existente — próximas são **0034, 0035, 0036, 0037** (a última aplicada é `0033_click_events.sql`). Uma migration por task, nessa ordem.
- **Enum em arquivo isolado:** `alter type app_role add value 'afiliado'` vai sozinho em `0034` (Postgres exige o valor commitado antes de ser usado em `0036`/`0037`).
- **Gate de migration = aplicar limpo no banco LOCAL.** O projeto não tem framework de teste unitário. Antes de testar, garanta a stack local de pé (`supabase start`). O gate de cada task de migration é `supabase db reset` terminar **sem erro** (recria o banco aplicando todas as migrations + `seed.sql`). Se a stack local não subir neste ambiente, **PARE e reporte BLOCKED** ao controlador (não “verifique no olho”).
- **Gate de TypeScript = build.** Onde houver mudança de tipos/TS, `npm run build` (`tsc -b && vite build`) deve ficar **verde**.
- **Seed de gating:** apenas o plano `profissional` começa com `affiliates_enabled = true`.
- **Exclusividade vendedor×afiliado:** uma venda/comissão tem no máximo um dos dois preenchido.
- **PT-BR** nas mensagens de erro das funções.
- **Valores de domínio confirmados:** `seller_status` = `('pending','active','suspended')`; `payment_method` existe; `rv_buyers` existe (id = `auth.uid()`); `rv_sales`/`rv_commissions` já têm `vendedor_id` (migration 0013); constraint atual de `kind` em `rv_click_events` chama-se `rv_click_events_kind_check`.

---

## File Structure

- **Create** `supabase/migrations/0034_affiliate_role.sql` — só o valor de enum `afiliado`.
- **Create** `supabase/migrations/0035_affiliate_columns.sql` — colunas novas + seed do gating + checks de exclusividade.
- **Create** `supabase/migrations/0036_register_sale_v4.sql` — `register_sale` com `p_affiliate_id`.
- **Create** `supabase/migrations/0037_affiliate_rls_visit.sql` — RLS de leitura do afiliado + `log_affiliate_visit`.
- **Modify** `src/lib/database.generated.ts` — regenerado pelo CLI (não editar à mão).
- **Modify (se o build acusar)** pontos que fazem `switch`/mapa exaustivo sobre `app_role` — adicionar o caso `'afiliado'`.

---

### Task 1: Migration 0034 — valor de enum `afiliado`

**Files:**
- Create: `supabase/migrations/0034_affiliate_role.sql`

**Interfaces:**
- Produces: o valor `'afiliado'` no enum `public.app_role`, usado por 0036/0037 e pelas fases seguintes.

- [ ] **Step 1: Criar `supabase/migrations/0034_affiliate_role.sql`**

```sql
-- ============================================================
-- 0034_affiliate_role.sql — novo papel: afiliado
-- Arquivo isolado: Postgres exige o valor de enum commitado
-- antes de ser referenciado (0036/0037).
-- ============================================================
alter type public.app_role add value if not exists 'afiliado';
```

- [ ] **Step 2: Aplicar no banco local**

Run: `supabase db reset`
Expected: termina sem erro (recria o schema e aplica todas as migrations, incluindo a 0034).

- [ ] **Step 3: Confirmar o valor no enum**

Run: `psql "$(supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '\"')" -c "select 'afiliado' = any(enum_range(null::public.app_role)::text[]) as ok;"`
(Se `psql` não estiver disponível, rode o mesmo SQL via `supabase db reset` já garante a aplicação — este passo é confirmação adicional.)
Expected: `ok` = `t`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0034_affiliate_role.sql
git commit -m "feat(db): role afiliado no enum app_role"
```

---

### Task 2: Migration 0035 — colunas, gating e checks de exclusividade

**Files:**
- Create: `supabase/migrations/0035_affiliate_columns.sql`

**Interfaces:**
- Consumes: enum `afiliado` (0034) não é referenciado aqui, mas a ordem importa.
- Produces:
  - `rv_sellers.ref_code text unique`
  - `rv_pricing_plans.affiliates_enabled boolean not null default false` (seed: `profissional` = true)
  - `rv_sales.affiliate_id uuid` + check `rv_sales_vendedor_xor_affiliate`
  - `rv_commissions.affiliate_id uuid` + check `rv_commissions_vendedor_xor_affiliate`
  - `rv_click_events.affiliate_id uuid` + `kind` ampliado com `'affiliate_share'`, `'affiliate_link_visit'`

- [ ] **Step 1: Criar `supabase/migrations/0035_affiliate_columns.sql`**

```sql
-- ============================================================
-- 0035_affiliate_columns.sql — colunas e gating do sistema de afiliados
-- ============================================================

-- código curto e estável do afiliado (usado no link público ?ref=)
alter table public.rv_sellers
  add column if not exists ref_code text unique;

-- gating por plano
alter table public.rv_pricing_plans
  add column if not exists affiliates_enabled boolean not null default false;
update public.rv_pricing_plans set affiliates_enabled = true where key = 'profissional';

-- atribuição de venda ao afiliado (exclusivo com vendedor)
alter table public.rv_sales
  add column if not exists affiliate_id uuid references public.rv_sellers(id);
alter table public.rv_sales
  drop constraint if exists rv_sales_vendedor_xor_affiliate;
alter table public.rv_sales
  add constraint rv_sales_vendedor_xor_affiliate
  check (num_nonnulls(vendedor_id, affiliate_id) <= 1);
create index if not exists idx_rv_sales_affiliate_id on public.rv_sales(affiliate_id);

-- beneficiário afiliado na comissão (exclusivo com vendedor)
alter table public.rv_commissions
  add column if not exists affiliate_id uuid references public.rv_sellers(id);
alter table public.rv_commissions
  drop constraint if exists rv_commissions_vendedor_xor_affiliate;
alter table public.rv_commissions
  add constraint rv_commissions_vendedor_xor_affiliate
  check (num_nonnulls(vendedor_id, affiliate_id) <= 1);
create index if not exists idx_rv_commissions_affiliate_id on public.rv_commissions(affiliate_id);

-- tracking: afiliado nos eventos de clique + novos tipos
alter table public.rv_click_events
  add column if not exists affiliate_id uuid references public.rv_sellers(id);
create index if not exists idx_rv_click_events_affiliate on public.rv_click_events(affiliate_id);
alter table public.rv_click_events
  drop constraint if exists rv_click_events_kind_check;
alter table public.rv_click_events
  add constraint rv_click_events_kind_check
  check (kind in (
    'vehicle_interest','store_whatsapp','store_instagram',
    'affiliate_share','affiliate_link_visit'
  ));
```

- [ ] **Step 2: Aplicar no banco local**

Run: `supabase db reset`
Expected: termina sem erro. (Se `seed.sql` inserir cliques/vendas, os checks novos passam porque as linhas existentes têm `affiliate_id` nulo.)

- [ ] **Step 3: Confirmar colunas e seed**

Run: `psql "$(supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '\"')" -c "select (select affiliates_enabled from public.rv_pricing_plans where key='profissional') as prof_on, (select count(*) from information_schema.columns where table_name='rv_sales' and column_name='affiliate_id') as sale_col;"`
Expected: `prof_on` = `t`, `sale_col` = `1`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0035_affiliate_columns.sql
git commit -m "feat(db): colunas e gating do sistema de afiliados"
```

---

### Task 3: Migration 0036 — `register_sale` v4 (afiliado×vendedor)

**Files:**
- Create: `supabase/migrations/0036_register_sale_v4.sql`

**Interfaces:**
- Consumes: enum `afiliado` (0034); colunas `affiliate_id` (0035).
- Produces: `public.register_sale(bigint, uuid, varchar, numeric, payment_method, varchar, date, text, uuid)` — assinatura v4 com `p_affiliate_id uuid default null` no fim.

- [ ] **Step 1: Criar `supabase/migrations/0036_register_sale_v4.sql`**

```sql
-- ============================================================
-- 0036_register_sale_v4.sql — register_sale + p_affiliate_id
-- Venda atribuível a vendedor OU afiliado (exclusivo). A comissão
-- usa a commission_rate do beneficiário e grava affiliate_id quando
-- for venda de afiliado.
-- ============================================================
drop function if exists public.register_sale(
  bigint, uuid, varchar, numeric, payment_method, varchar, date, text
);

create or replace function public.register_sale(
  p_vehicle_id     bigint,
  p_vendedor_id    uuid,
  p_buyer_name     varchar,
  p_sale_price     numeric,
  p_payment_method payment_method,
  p_buyer_phone    varchar default null,
  p_sale_date      date    default current_date,
  p_sale_reason    text    default null,
  p_affiliate_id   uuid    default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_loja      uuid;
  v_rate      numeric(5,2);
  v_sale_id   uuid;
  v_aff_loja  uuid;
  v_aff_role  app_role;
  v_vend_loja uuid;
begin
  v_loja := public.current_loja();
  if v_loja is null then
    raise exception 'Usuário atual não pertence a uma loja.';
  end if;

  if p_vendedor_id is not null and p_affiliate_id is not null then
    raise exception 'Venda não pode ter vendedor e afiliado ao mesmo tempo.';
  end if;

  if not public.is_admin()
     and not exists (select 1 from public.rv_vehicles
                     where id = p_vehicle_id and seller_id = v_loja) then
    raise exception 'Veículo % não pertence à loja.', p_vehicle_id;
  end if;

  if p_affiliate_id is not null then
    -- ── venda de afiliado: só o garagista (loja manager) registra ──
    if not public.is_loja_manager() and not public.is_admin() then
      raise exception 'Apenas o garagista registra venda de afiliado.';
    end if;
    select coalesce(parent_id, id), role, commission_rate
      into v_aff_loja, v_aff_role, v_rate
      from public.rv_sellers where id = p_affiliate_id;
    if v_aff_loja is distinct from v_loja or v_aff_role <> 'afiliado' then
      raise exception 'Afiliado não pertence à loja.';
    end if;

    insert into public.rv_sales (
      vehicle_id, seller_id, vendedor_id, affiliate_id, buyer_name, buyer_phone,
      sale_price, payment_method, sale_date, sale_reason
    ) values (
      p_vehicle_id, v_loja, null, p_affiliate_id, p_buyer_name, p_buyer_phone,
      p_sale_price, p_payment_method, p_sale_date, p_sale_reason
    ) returning id into v_sale_id;

    insert into public.rv_commissions (
      sale_id, seller_id, vendedor_id, affiliate_id, amount, rate, status, due_date
    ) values (
      v_sale_id, v_loja, null, p_affiliate_id,
      round(p_sale_price * v_rate / 100, 2), v_rate, 'pending',
      p_sale_date + interval '30 days'
    );
  else
    -- ── venda de vendedor (caminho atual) ──
    if not public.is_loja_manager() and p_vendedor_id <> public.current_person() then
      raise exception 'Vendedor só pode registrar a própria venda.';
    end if;
    select coalesce(parent_id, id) into v_vend_loja
      from public.rv_sellers where id = p_vendedor_id;
    if v_vend_loja is distinct from v_loja then
      raise exception 'Vendedor não pertence à loja.';
    end if;
    select commission_rate into v_rate from public.rv_sellers where id = p_vendedor_id;

    insert into public.rv_sales (
      vehicle_id, seller_id, vendedor_id, affiliate_id, buyer_name, buyer_phone,
      sale_price, payment_method, sale_date, sale_reason
    ) values (
      p_vehicle_id, v_loja, p_vendedor_id, null, p_buyer_name, p_buyer_phone,
      p_sale_price, p_payment_method, p_sale_date, p_sale_reason
    ) returning id into v_sale_id;

    insert into public.rv_commissions (
      sale_id, seller_id, vendedor_id, affiliate_id, amount, rate, status, due_date
    ) values (
      v_sale_id, v_loja, p_vendedor_id, null,
      round(p_sale_price * v_rate / 100, 2), v_rate, 'pending',
      p_sale_date + interval '30 days'
    );
  end if;

  update public.rv_vehicles set status = 'sold', updated_at = now()
  where id = p_vehicle_id;

  return v_sale_id;
end;
$$;

grant execute on function public.register_sale(
  bigint, uuid, varchar, numeric, payment_method, varchar, date, text, uuid
) to authenticated;
```

- [ ] **Step 2: Aplicar no banco local**

Run: `supabase db reset`
Expected: termina sem erro (função recriada com a nova assinatura).

- [ ] **Step 3: Smoke test SQL da assinatura/exclusividade**

Run:
```bash
psql "$(supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '\"')" -c \
"select count(*) as v4_exists from pg_proc p join pg_namespace n on n.oid=p.pronamespace \
 where n.nspname='public' and p.proname='register_sale' and p.pronargs=9;"
```
Expected: `v4_exists` = `1` (existe a sobrecarga com 9 parâmetros).
(Se `psql` não estiver disponível neste ambiente, PARE e reporte — não pule o gate.)

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0036_register_sale_v4.sql
git commit -m "feat(db): register_sale v4 com atribuicao a afiliado"
```

---

### Task 4: Migration 0037 — RLS do afiliado + `log_affiliate_visit`

**Files:**
- Create: `supabase/migrations/0037_affiliate_rls_visit.sql`

**Interfaces:**
- Consumes: colunas `affiliate_id` (0035); enum `afiliado` (0034); helpers `is_admin()`, `is_loja_manager()`, `current_loja()`, `current_person()` (existentes).
- Produces: policies `rv_sales_read_scope` e `rv_commissions_read_scope` recriadas com `affiliate_id = current_person()`; função `public.log_affiliate_visit(text, bigint)`.

- [ ] **Step 1: Criar `supabase/migrations/0037_affiliate_rls_visit.sql`**

```sql
-- ============================================================
-- 0037_affiliate_rls_visit.sql — leitura do afiliado + log de visita por ref
-- ============================================================

-- ── rv_sales: afiliado lê as próprias vendas ──
drop policy if exists "rv_sales_read_scope" on public.rv_sales;
create policy "rv_sales_read_scope" on public.rv_sales
  for select using (
    public.is_admin()
    or (public.is_loja_manager() and seller_id = public.current_loja())
    or vendedor_id = public.current_person()
    or affiliate_id = public.current_person()
  );

-- ── rv_commissions: afiliado lê as próprias comissões ──
drop policy if exists "rv_commissions_read_scope" on public.rv_commissions;
create policy "rv_commissions_read_scope" on public.rv_commissions
  for select using (
    public.is_admin()
    or (public.is_loja_manager() and seller_id = public.current_loja())
    or vendedor_id = public.current_person()
    or affiliate_id = public.current_person()
  );

-- ── log de visita chegada pelo link do afiliado (?ref=) ──
-- security definer: insert público controlado (anon/comprador), no espírito
-- de log_click_event. Ref inválido/afiliado inativo é ignorado em silêncio.
create or replace function public.log_affiliate_visit(
  p_ref_code   text,
  p_vehicle_id bigint default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_aff   uuid;
  v_loja  uuid;
  v_buyer uuid;
begin
  select id, coalesce(parent_id, id) into v_aff, v_loja
    from public.rv_sellers
    where ref_code = p_ref_code and role = 'afiliado' and status = 'active';
  if v_aff is null then
    return;
  end if;
  select id into v_buyer from public.rv_buyers where id = auth.uid();
  insert into public.rv_click_events (seller_id, vehicle_id, buyer_id, kind, affiliate_id)
  values (v_loja, p_vehicle_id, v_buyer, 'affiliate_link_visit', v_aff);
end;
$$;
revoke all on function public.log_affiliate_visit(text, bigint) from public;
grant execute on function public.log_affiliate_visit(text, bigint) to anon, authenticated;
```

- [ ] **Step 2: Aplicar no banco local**

Run: `supabase db reset`
Expected: termina sem erro (policies recriadas, função criada).

- [ ] **Step 3: Confirmar policies e função**

Run:
```bash
psql "$(supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '\"')" -c \
"select (select count(*) from pg_policies where tablename='rv_sales' and policyname='rv_sales_read_scope') as sales_pol, \
        (select count(*) from pg_proc where proname='log_affiliate_visit') as fn;"
```
Expected: `sales_pol` = `1`, `fn` = `1`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0037_affiliate_rls_visit.sql
git commit -m "feat(db): RLS de leitura do afiliado + log_affiliate_visit"
```

---

### Task 5: Regenerar tipos TS e manter o build verde

**Files:**
- Modify: `src/lib/database.generated.ts` (gerado pelo CLI)
- Modify (se o build acusar): pontos com `switch`/mapa exaustivo sobre `app_role`

**Interfaces:**
- Consumes: o schema local atualizado (Tasks 1–4 aplicadas via `supabase db reset`).
- Produces: tipos gerados incluindo `app_role` com `'afiliado'`, `affiliates_enabled`, `affiliate_id`, `ref_code` e a assinatura v4 de `register_sale`.

- [ ] **Step 1: Regenerar os tipos a partir do banco local**

Run: `npm run types:gen`
(equivale a `supabase gen types typescript --local > src/lib/database.generated.ts`)
Expected: arquivo atualizado; `git diff --stat src/lib/database.generated.ts` mostra mudança.

- [ ] **Step 2: Rodar o build**

Run: `npm run build`
Expected: idealmente verde. Se o `tsc` acusar erro de exaustividade por causa do novo valor `'afiliado'` em `app_role` (ex.: um `switch (role)` sem `default`, ou um `Record<AppRole, ...>` que passou a faltar a chave), vá ao Step 3.

- [ ] **Step 3 (somente se o build falhar): adicionar o caso `'afiliado'`**

Para cada erro apontado pelo `tsc`, adicione o tratamento de `'afiliado'` seguindo o padrão do arquivo (ex.: rótulo `"Afiliado"` num mapa de papéis, ou um `case "afiliado":` análogo ao de `"vendedor"`). Não introduza comportamento novo de produto aqui — só o mínimo para o tipo ficar exaustivo e o build voltar a verde. Repita `npm run build` até verde.

- [ ] **Step 4: Rodar o build final**

Run: `npm run build`
Expected: verde (`✓ built in ...`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/database.generated.ts src/
git commit -m "chore(types): regenera tipos com afiliado/affiliate_id e mantem build verde"
```

---

## Verificação final (após Task 5)

- [ ] `supabase db reset` aplica 0034–0037 sem erro.
- [ ] `npm run build` verde.
- [ ] Deploy das migrations no remoto conforme a rotina do projeto (`supabase db push --db-url ...`; verificar via REST). **Nota:** o histórico do remoto pode precisar de `migration repair` se estiver dessincronizado (ver memória "Migrations no remoto (repair)"). Como Fase 1 não tem UI, o build estático não muda — o deploy aqui é só de banco.

## Self-Review (preenchido na escrita do plano)

- **Cobertura do spec (seção Modelo de dados + RLS afiliado + log_affiliate_visit):** enum (T1) ✓; ref_code/affiliates_enabled+seed/rv_sales.affiliate_id+check/rv_commissions.affiliate_id+check/rv_click_events.affiliate_id+kind (T2) ✓; register_sale v4 exclusivo + comissão por afiliado (T3) ✓; RLS rv_sales/rv_commissions + log_affiliate_visit (T4) ✓; tipos/build (T5) ✓. Onboarding, links/UI, atribuição na UI e relatórios são **Fases 2–4** (fora desta fase, por decisão de faseamento).
- **Placeholders:** nenhum — todo SQL/commando presente.
- **Consistência de tipos/assinaturas:** `register_sale` v4 = 9 args (drop do v3 de 8 args + `p_affiliate_id`); colunas `affiliate_id` referenciadas igualmente em T2/T3/T4; checks nomeados `rv_sales_vendedor_xor_affiliate`/`rv_commissions_vendedor_xor_affiliate`; `log_affiliate_visit(text, bigint)` idêntico em T4.
- **Pontos a confirmar na execução:** disponibilidade da stack local (`supabase start`) e do `psql` para os smoke tests — ambos com instrução de PARAR/reportar se ausentes (não pular gate).
