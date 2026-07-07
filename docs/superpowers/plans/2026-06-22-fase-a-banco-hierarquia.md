# Fase A — Banco (hierarquia Garagista→Vendedor) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Estender o schema, RLS e a RPC para o modelo de 3 níveis (Plataforma → Garagista → Vendedor) de forma não-destrutiva, mantendo o app atual funcionando.

**Architecture:** Hierarquia auto-referente em `rv_sellers` (`parent_id` + role `admin|garagista|vendedor`). Escopo de dados por `current_loja()`. Vendas/comissões ganham `vendedor_id` (quem vende/ganha) mantendo `seller_id` = a loja. Comissão calculada pela taxa do vendedor atribuído via `register_sale`.

**Tech Stack:** Supabase (Postgres 15) · migrations SQL · RLS · RPC `SECURITY DEFINER` · Vite/React/TS (ajustes mínimos para o build).

## Global Constraints

- Banco local sobe com `supabase start`; migrations aplicadas com `supabase db reset`.
- Container do Postgres: descobrir com `docker ps -qf name=supabase_db` (neste ambiente: `supabase_db_revvio`).
- Rodar SQL de teste: `docker exec -i $(docker ps -qf name=supabase_db) psql -U postgres -d postgres -v ON_ERROR_STOP=1 < <arquivo.sql>` (sai com código ≠ 0 se um `assert` falhar).
- Tipos do banco: `database.generated.ts` é GERADO por `npm run types:gen` (não editar à mão); aliases ficam em `src/lib/database.types.ts`.
- Não-destrutivo: nenhuma migration apaga dados; colunas novas entram nullable + backfill antes de `NOT NULL`.
- Enum: usar `ALTER TYPE app_role RENAME VALUE 'seller' TO 'garagista'` (renomeia linhas automaticamente) e `ADD VALUE 'vendedor'` (não usar o valor novo no mesmo arquivo de migration).
- `seller_id` = a LOJA (garagista) em `rv_vehicles`/`rv_sales`/`rv_commissions`. `vendedor_id` = a pessoa.
- **Preservar a UI atual do `/dashboard` (admin):** nesta fase, mudanças em arquivos sob `features/admin` são apenas troca mecânica de literal de role (`"seller"`→`"garagista"`). Nenhuma alteração visual/comportamental no painel admin.

---

### Task A0: Inicializar git e branch de trabalho

**Files:** nenhum (setup de repositório).

- [ ] **Step 1: Inicializar o repositório (o projeto ainda não é git)**

```bash
cd "/home/israel/Documentos/2026 RaiTechLabs/revvio"
git init
git add -A
git commit -m "chore: baseline antes da hierarquia garagista/vendedor"
```

- [ ] **Step 2: Criar a branch da fase**

```bash
git checkout -b fase-a-banco-hierarquia
```

- [ ] **Step 3: Confirmar baseline verde**

Run: `npx tsc -b && npm run build`
Expected: ambos exit 0 (sem erros).

---

### Task A1: Migrations de estrutura (enum + colunas)

**Files:**
- Create: `supabase/migrations/0012_enum_hierarchy.sql`
- Create: `supabase/migrations/0013_structure_hierarchy.sql`
- Test: `docs/superpowers/tests/a1_structure_test.sql`

**Interfaces:**
- Produces: enum `app_role` = `admin|garagista|vendedor`; `rv_sellers.parent_id`; `rv_sellers.slug` nullable; `rv_sales.vendedor_id` (NOT NULL); `rv_commissions.vendedor_id` (NOT NULL).

- [ ] **Step 1: Escrever o teste de estrutura (falha primeiro)**

Create `docs/superpowers/tests/a1_structure_test.sql`:

```sql
do $$
declare n int;
begin
  -- enum tem garagista e vendedor, e NÃO tem mais 'seller'
  select count(*) into n from pg_enum e join pg_type t on t.oid=e.enumtypid
   where t.typname='app_role' and e.enumlabel in ('garagista','vendedor');
  assert n = 2, 'FALHA: enum app_role sem garagista/vendedor';
  select count(*) into n from pg_enum e join pg_type t on t.oid=e.enumtypid
   where t.typname='app_role' and e.enumlabel='seller';
  assert n = 0, 'FALHA: valor seller ainda existe no enum';

  -- colunas novas
  select count(*) into n from information_schema.columns
   where table_name='rv_sellers' and column_name='parent_id';
  assert n = 1, 'FALHA: rv_sellers.parent_id ausente';
  select count(*) into n from information_schema.columns
   where table_name='rv_sales' and column_name='vendedor_id' and is_nullable='NO';
  assert n = 1, 'FALHA: rv_sales.vendedor_id ausente ou nullable';
  select count(*) into n from information_schema.columns
   where table_name='rv_commissions' and column_name='vendedor_id' and is_nullable='NO';
  assert n = 1, 'FALHA: rv_commissions.vendedor_id ausente ou nullable';

  -- slug agora é nullable
  select count(*) into n from information_schema.columns
   where table_name='rv_sellers' and column_name='slug' and is_nullable='YES';
  assert n = 1, 'FALHA: rv_sellers.slug ainda é NOT NULL';

  raise notice '✅ A1 estrutura OK';
end $$;
```

- [ ] **Step 2: Rodar o teste contra o banco atual (deve FALHAR)**

Run: `docker exec -i $(docker ps -qf name=supabase_db) psql -U postgres -d postgres -v ON_ERROR_STOP=1 < docs/superpowers/tests/a1_structure_test.sql`
Expected: FALHA com "enum app_role sem garagista/vendedor" (estrutura ainda não existe).

- [ ] **Step 3: Escrever a migration do enum**

Create `supabase/migrations/0012_enum_hierarchy.sql`:

```sql
-- ============================================================
-- Hierarquia · enum app_role: seller→garagista (+ vendedor)
-- RENAME atualiza todas as linhas existentes automaticamente.
-- 'vendedor' NÃO é usado neste arquivo (restrição do ADD VALUE).
-- ============================================================
alter type app_role rename value 'seller' to 'garagista';
alter type app_role add value if not exists 'vendedor';
```

- [ ] **Step 4: Escrever a migration de estrutura**

Create `supabase/migrations/0013_structure_hierarchy.sql`:

```sql
-- ============================================================
-- Hierarquia · estrutura: parent_id, slug nullable, vendedor_id
-- ============================================================

-- árvore de pessoas
alter table public.rv_sellers
  add column parent_id uuid references public.rv_sellers(id) on delete cascade;
alter table public.rv_sellers alter column slug drop not null;
create index idx_rv_sellers_parent_id on public.rv_sellers(parent_id);

-- venda atribuída ao vendedor (backfill = própria loja, p/ histórico legado)
alter table public.rv_sales
  add column vendedor_id uuid references public.rv_sellers(id);
update public.rv_sales set vendedor_id = seller_id where vendedor_id is null;
alter table public.rv_sales alter column vendedor_id set not null;
create index idx_rv_sales_vendedor_id on public.rv_sales(vendedor_id);

-- comissão direcionada ao vendedor
alter table public.rv_commissions
  add column vendedor_id uuid references public.rv_sellers(id);
update public.rv_commissions set vendedor_id = seller_id where vendedor_id is null;
alter table public.rv_commissions alter column vendedor_id set not null;
create index idx_rv_commissions_vendedor_id on public.rv_commissions(vendedor_id);
```

- [ ] **Step 5: Aplicar migrations e rodar o teste (deve PASSAR)**

Run:
```bash
supabase db reset
docker exec -i $(docker ps -qf name=supabase_db) psql -U postgres -d postgres -v ON_ERROR_STOP=1 < docs/superpowers/tests/a1_structure_test.sql
```
Expected: `db reset` aplica 0012 e 0013 sem erro; teste imprime `✅ A1 estrutura OK` e sai 0.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0012_enum_hierarchy.sql supabase/migrations/0013_structure_hierarchy.sql docs/superpowers/tests/a1_structure_test.sql
git commit -m "feat(db): hierarquia — enum garagista/vendedor + parent_id + vendedor_id"
```

---

### Task A2: Funções auxiliares de escopo

**Files:**
- Create: `supabase/migrations/0014_helpers_hierarchy.sql`
- Test: `docs/superpowers/tests/a2_helpers_test.sql`

**Interfaces:**
- Produces: `current_person() → uuid`, `current_loja() → uuid`, `is_loja_manager() → boolean`. Mantém `is_admin()`.

- [ ] **Step 1: Escrever o teste das funções (falha primeiro)**

Create `docs/superpowers/tests/a2_helpers_test.sql`:

```sql
begin;
-- usuários e linhas de teste (garagista G + vendedor V sob G)
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000','aaaaaaaa-0000-0000-0000-0000000000a1',
        'authenticated','authenticated','g@test.dev', now(), now()),
       ('00000000-0000-0000-0000-000000000000','aaaaaaaa-0000-0000-0000-0000000000a2',
        'authenticated','authenticated','v@test.dev', now(), now());

insert into public.rv_sellers (id, user_id, name, slug, status, role, commission_rate)
values ('bbbbbbbb-0000-0000-0000-0000000000b1','aaaaaaaa-0000-0000-0000-0000000000a1',
        'Loja G','loja-g','active','garagista',0);
insert into public.rv_sellers (id, user_id, name, status, role, parent_id, commission_rate)
values ('bbbbbbbb-0000-0000-0000-0000000000b2','aaaaaaaa-0000-0000-0000-0000000000a2',
        'Vendedor V','active','vendedor','bbbbbbbb-0000-0000-0000-0000000000b1',10);

do $$
begin
  -- contexto = garagista G
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims',
    json_build_object('sub','aaaaaaaa-0000-0000-0000-0000000000a1','role','authenticated')::text, true);
  assert public.current_person() = 'bbbbbbbb-0000-0000-0000-0000000000b1', 'FALHA: current_person(G)';
  assert public.current_loja()   = 'bbbbbbbb-0000-0000-0000-0000000000b1', 'FALHA: current_loja(G)=própria';
  assert public.is_loja_manager() = true, 'FALHA: G deveria ser manager';

  -- contexto = vendedor V (loja = G)
  perform set_config('request.jwt.claims',
    json_build_object('sub','aaaaaaaa-0000-0000-0000-0000000000a2','role','authenticated')::text, true);
  assert public.current_person() = 'bbbbbbbb-0000-0000-0000-0000000000b2', 'FALHA: current_person(V)';
  assert public.current_loja()   = 'bbbbbbbb-0000-0000-0000-0000000000b1', 'FALHA: current_loja(V)=parent';
  assert public.is_loja_manager() = false, 'FALHA: V não é manager';

  raise notice '✅ A2 helpers OK';
end $$;
rollback;
```

- [ ] **Step 2: Rodar o teste (deve FALHAR)**

Run: `docker exec -i $(docker ps -qf name=supabase_db) psql -U postgres -d postgres -v ON_ERROR_STOP=1 < docs/superpowers/tests/a2_helpers_test.sql`
Expected: FALHA — `current_loja`/`is_loja_manager` ainda não existem (erro "function ... does not exist").

- [ ] **Step 3: Escrever a migration das funções**

Create `supabase/migrations/0014_helpers_hierarchy.sql`:

```sql
-- ============================================================
-- Hierarquia · funções de escopo (SECURITY DEFINER)
-- ============================================================

-- a linha da pessoa logada
create or replace function public.current_person()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.rv_sellers where user_id = auth.uid();
$$;

-- a loja da pessoa logada (própria id se garagista/admin; parent se vendedor)
create or replace function public.current_loja()
returns uuid language sql stable security definer set search_path = public as $$
  select coalesce(parent_id, id) from public.rv_sellers where user_id = auth.uid();
$$;

-- pode ver/gerir a loja inteira
create or replace function public.is_loja_manager()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.rv_sellers
    where user_id = auth.uid() and role in ('garagista','admin')
  );
$$;
```

- [ ] **Step 4: Aplicar e rodar o teste (deve PASSAR)**

Run:
```bash
supabase db reset
docker exec -i $(docker ps -qf name=supabase_db) psql -U postgres -d postgres -v ON_ERROR_STOP=1 < docs/superpowers/tests/a2_helpers_test.sql
```
Expected: `✅ A2 helpers OK`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0014_helpers_hierarchy.sql docs/superpowers/tests/a2_helpers_test.sql
git commit -m "feat(db): funções de escopo current_person/current_loja/is_loja_manager"
```

---

### Task A3: RLS de 3 níveis + trigger de proteção

**Files:**
- Create: `supabase/migrations/0015_rls_hierarchy.sql`
- Test: `docs/superpowers/tests/a3_rls_test.sql`

**Interfaces:**
- Consumes: `current_person()`, `current_loja()`, `is_loja_manager()`, `is_admin()`.
- Produces: políticas RLS escopadas por loja em `rv_sellers`/`rv_vehicles`/`rv_sales`/`rv_commissions`; `protect_seller_columns` permite o garagista gerir a equipe.

- [ ] **Step 1: Escrever o teste de isolamento 3 níveis (falha primeiro)**

Create `docs/superpowers/tests/a3_rls_test.sql`:

```sql
begin;
-- Loja G1 (garagista g1) com vendedor v1 ; Loja G2 (garagista g2) com vendedor v2
insert into auth.users (instance_id,id,aud,role,email,created_at,updated_at) values
 ('00000000-0000-0000-0000-000000000000','a0000000-0000-0000-0000-0000000000g1','authenticated','authenticated','g1@t.dev',now(),now()),
 ('00000000-0000-0000-0000-000000000000','a0000000-0000-0000-0000-0000000000v1','authenticated','authenticated','v1@t.dev',now(),now()),
 ('00000000-0000-0000-0000-000000000000','a0000000-0000-0000-0000-0000000000g2','authenticated','authenticated','g2@t.dev',now(),now()),
 ('00000000-0000-0000-0000-000000000000','a0000000-0000-0000-0000-0000000000v2','authenticated','authenticated','v2@t.dev',now(),now());

insert into public.rv_sellers (id,user_id,name,slug,status,role,commission_rate) values
 ('c0000000-0000-0000-0000-0000000000g1','a0000000-0000-0000-0000-0000000000g1','Loja1','loja1','active','garagista',0),
 ('c0000000-0000-0000-0000-0000000000g2','a0000000-0000-0000-0000-0000000000g2','Loja2','loja2','active','garagista',0);
insert into public.rv_sellers (id,user_id,name,status,role,parent_id,commission_rate) values
 ('c0000000-0000-0000-0000-0000000000v1','a0000000-0000-0000-0000-0000000000v1','Vend1','active','vendedor','c0000000-0000-0000-0000-0000000000g1',10),
 ('c0000000-0000-0000-0000-0000000000v2','a0000000-0000-0000-0000-0000000000v2','Vend2','active','vendedor','c0000000-0000-0000-0000-0000000000g2',10);

-- veículos das duas lojas
insert into public.rv_vehicles (id,seller_id,make,model,price,status) values
 (900001,'c0000000-0000-0000-0000-0000000000g1','VW','Gol',50000,'available'),
 (900002,'c0000000-0000-0000-0000-0000000000g2','Fiat','Uno',40000,'available');
-- vendas: v1 vendeu na loja1; v2 vendeu na loja2
insert into public.rv_sales (id,vehicle_id,seller_id,vendedor_id,buyer_name,sale_price,payment_method) values
 ('d0000000-0000-0000-0000-00000000s101',900001,'c0000000-0000-0000-0000-0000000000g1','c0000000-0000-0000-0000-0000000000v1','Comp1',50000,'pix'),
 ('d0000000-0000-0000-0000-00000000s202',900002,'c0000000-0000-0000-0000-0000000000g2','c0000000-0000-0000-0000-0000000000v2','Comp2',40000,'pix');
insert into public.rv_commissions (sale_id,seller_id,vendedor_id,amount,rate,status) values
 ('d0000000-0000-0000-0000-00000000s101','c0000000-0000-0000-0000-0000000000g1','c0000000-0000-0000-0000-0000000000v1',5000,10,'pending'),
 ('d0000000-0000-0000-0000-00000000s202','c0000000-0000-0000-0000-0000000000g2','c0000000-0000-0000-0000-0000000000v2',4000,10,'pending');

do $$
declare n int;
begin
  perform set_config('role','authenticated',true);

  -- VENDEDOR v1: vê só a PRÓPRIA venda; não vê a da loja2
  perform set_config('request.jwt.claims', json_build_object('sub','a0000000-0000-0000-0000-0000000000v1','role','authenticated')::text, true);
  select count(*) into n from public.rv_sales; assert n = 1, 'FALHA: v1 deveria ver só 1 venda (a própria)';
  select count(*) into n from public.rv_commissions; assert n = 1, 'FALHA: v1 deveria ver só a própria comissão';

  -- GARAGISTA g1: vê toda a loja1 (1 venda) e nada da loja2
  perform set_config('request.jwt.claims', json_build_object('sub','a0000000-0000-0000-0000-0000000000g1','role','authenticated')::text, true);
  select count(*) into n from public.rv_sales; assert n = 1, 'FALHA: g1 deveria ver as vendas da loja1';
  select count(*) into n from public.rv_sales where seller_id='c0000000-0000-0000-0000-0000000000g2'; assert n = 0, 'FALHA: g1 vazou venda da loja2';
  -- g1 vê a própria equipe (ele + v1 = 2) e não vê v2
  select count(*) into n from public.rv_sellers where id='c0000000-0000-0000-0000-0000000000v2'; assert n = 0, 'FALHA: g1 vazou vendedor da loja2';

  -- catálogo é público: g1 vê os 2 veículos
  select count(*) into n from public.rv_vehicles where id in (900001,900002); assert n = 2, 'FALHA: catálogo deveria ser público';

  raise notice '✅ A3 RLS 3 níveis OK';
end $$;
rollback;
```

- [ ] **Step 2: Rodar o teste (deve FALHAR)**

Run: `docker exec -i $(docker ps -qf name=supabase_db) psql -U postgres -d postgres -v ON_ERROR_STOP=1 < docs/superpowers/tests/a3_rls_test.sql`
Expected: FALHA (RLS antigo escopa por `current_seller()`; vendedor v1 enxergaria diferente / asserts quebram).

- [ ] **Step 3: Escrever a migration de RLS**

Create `supabase/migrations/0015_rls_hierarchy.sql`:

```sql
-- ============================================================
-- Hierarquia · RLS de 3 níveis (substitui as policies por loja)
-- ============================================================

-- ── rv_sellers ──────────────────────────────────────────────
drop policy if exists "rv_sellers_public_read_active" on public.rv_sellers;
create policy "rv_sellers_public_read_active" on public.rv_sellers
  for select using (status = 'active' and role = 'garagista');

create policy "rv_sellers_team_read" on public.rv_sellers
  for select using (parent_id = public.current_loja());

create policy "rv_sellers_team_update" on public.rv_sellers
  for update using (parent_id = public.current_loja() and public.is_loja_manager())
  with check (parent_id = public.current_loja() and public.is_loja_manager());
-- mantidas: rv_sellers_read_own, rv_sellers_admin_read,
--           rv_sellers_insert_self, rv_sellers_update_own, rv_sellers_admin_update

-- ── rv_vehicles (escopo = loja) ─────────────────────────────
drop policy if exists "rv_vehicles_insert_own" on public.rv_vehicles;
drop policy if exists "rv_vehicles_update_own" on public.rv_vehicles;
drop policy if exists "rv_vehicles_delete_own" on public.rv_vehicles;

create policy "rv_vehicles_insert_loja" on public.rv_vehicles
  for insert with check (seller_id = public.current_loja());
create policy "rv_vehicles_update_loja" on public.rv_vehicles
  for update using (seller_id = public.current_loja() or public.is_admin())
  with check (seller_id = public.current_loja() or public.is_admin());
create policy "rv_vehicles_delete_loja" on public.rv_vehicles
  for delete using (seller_id = public.current_loja() or public.is_admin());

-- ── rv_sales (manager vê a loja; vendedor vê as próprias) ────
drop policy if exists "rv_sales_read_own" on public.rv_sales;
drop policy if exists "rv_sales_insert_own" on public.rv_sales;
drop policy if exists "rv_sales_update_own" on public.rv_sales;

create policy "rv_sales_read_scope" on public.rv_sales
  for select using (
    public.is_admin()
    or (public.is_loja_manager() and seller_id = public.current_loja())
    or vendedor_id = public.current_person()
  );
create policy "rv_sales_update_manager" on public.rv_sales
  for update using (public.is_admin() or (public.is_loja_manager() and seller_id = public.current_loja()))
  with check (public.is_admin() or (public.is_loja_manager() and seller_id = public.current_loja()));
-- INSERT só via register_sale() (SECURITY DEFINER) → sem policy de insert.

-- ── rv_commissions ──────────────────────────────────────────
drop policy if exists "rv_commissions_read_own" on public.rv_commissions;
drop policy if exists "rv_commissions_admin_update" on public.rv_commissions;

create policy "rv_commissions_read_scope" on public.rv_commissions
  for select using (
    public.is_admin()
    or (public.is_loja_manager() and seller_id = public.current_loja())
    or vendedor_id = public.current_person()
  );
create policy "rv_commissions_update_manager" on public.rv_commissions
  for update using (public.is_admin() or (public.is_loja_manager() and seller_id = public.current_loja()))
  with check (public.is_admin() or (public.is_loja_manager() and seller_id = public.current_loja()));

-- ── trigger: garagista gere comissão/status da própria equipe ─
create or replace function public.protect_seller_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then
    return new;
  end if;
  -- garagista pode ajustar comissão/status dos vendedores da própria loja
  if public.is_loja_manager()
     and old.parent_id = public.current_loja()
     and new.role = old.role
     and new.parent_id is not distinct from old.parent_id then
    return new;
  end if;
  if new.commission_rate is distinct from old.commission_rate
     or new.status is distinct from old.status
     or new.role  is distinct from old.role
     or new.parent_id is distinct from old.parent_id then
    raise exception 'Sem permissão para alterar comissão, status, papel ou vínculo.';
  end if;
  return new;
end;
$$;
```

- [ ] **Step 4: Aplicar e rodar o teste (deve PASSAR)**

Run:
```bash
supabase db reset
docker exec -i $(docker ps -qf name=supabase_db) psql -U postgres -d postgres -v ON_ERROR_STOP=1 < docs/superpowers/tests/a3_rls_test.sql
```
Expected: `✅ A3 RLS 3 níveis OK`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0015_rls_hierarchy.sql docs/superpowers/tests/a3_rls_test.sql
git commit -m "feat(db): RLS de 3 níveis por loja + garagista gere a equipe"
```

---

### Task A4: `register_sale` v2 (atribui vendedor + taxa do vendedor)

**Files:**
- Create: `supabase/migrations/0016_register_sale_v2.sql`
- Test: `docs/superpowers/tests/a4_register_sale_test.sql`

**Interfaces:**
- Consumes: `current_loja()`, `current_person()`, `is_loja_manager()`, `is_admin()`.
- Produces: `register_sale(p_vehicle_id bigint, p_vendedor_id uuid, p_buyer_name varchar, p_sale_price numeric, p_payment_method payment_method, p_buyer_phone varchar default null, p_sale_date date default current_date) → uuid`. Remove `current_seller()` e a assinatura antiga de `register_sale`.

- [ ] **Step 1: Escrever o teste da RPC (falha primeiro)**

Create `docs/superpowers/tests/a4_register_sale_test.sql`:

```sql
begin;
insert into auth.users (instance_id,id,aud,role,email,created_at,updated_at) values
 ('00000000-0000-0000-0000-000000000000','e0000000-0000-0000-0000-0000000000g1','authenticated','authenticated','rg1@t.dev',now(),now()),
 ('00000000-0000-0000-0000-000000000000','e0000000-0000-0000-0000-0000000000v1','authenticated','authenticated','rv1@t.dev',now(),now());
insert into public.rv_sellers (id,user_id,name,slug,status,role,commission_rate) values
 ('f0000000-0000-0000-0000-0000000000g1','e0000000-0000-0000-0000-0000000000g1','RLoja','rloja','active','garagista',0);
insert into public.rv_sellers (id,user_id,name,status,role,parent_id,commission_rate) values
 ('f0000000-0000-0000-0000-0000000000v1','e0000000-0000-0000-0000-0000000000v1','RVend','active','vendedor','f0000000-0000-0000-0000-0000000000g1',8);
insert into public.rv_vehicles (id,seller_id,make,model,price,status) values
 (910001,'f0000000-0000-0000-0000-0000000000g1','Honda','Civic',100000,'available');

do $$
declare v_sale uuid; v_amount numeric; v_vend uuid; v_vstatus text;
begin
  perform set_config('role','authenticated',true);
  -- garagista registra a venda atribuindo ao vendedor v1 (taxa 8%)
  perform set_config('request.jwt.claims', json_build_object('sub','e0000000-0000-0000-0000-0000000000g1','role','authenticated')::text, true);
  v_sale := public.register_sale(910001, 'f0000000-0000-0000-0000-0000000000v1', 'CompradorX', 100000, 'pix');

  select vendedor_id into v_vend from public.rv_sales where id = v_sale;
  assert v_vend = 'f0000000-0000-0000-0000-0000000000v1', 'FALHA: venda não atribuída ao vendedor';

  select amount into v_amount from public.rv_commissions where sale_id = v_sale;
  assert v_amount = 8000, 'FALHA: comissão deveria ser 8% de 100000 = 8000 (taxa do vendedor)';

  select status into v_vstatus from public.rv_vehicles where id = 910001;
  assert v_vstatus = 'sold', 'FALHA: veículo não marcado como vendido';

  raise notice '✅ A4 register_sale v2 OK';
end $$;
rollback;
```

- [ ] **Step 2: Rodar o teste (deve FALHAR)**

Run: `docker exec -i $(docker ps -qf name=supabase_db) psql -U postgres -d postgres -v ON_ERROR_STOP=1 < docs/superpowers/tests/a4_register_sale_test.sql`
Expected: FALHA — a assinatura nova de `register_sale` (com `p_vendedor_id`) ainda não existe.

- [ ] **Step 3: Escrever a migration da RPC**

Create `supabase/migrations/0016_register_sale_v2.sql`:

```sql
-- ============================================================
-- Hierarquia · register_sale v2: atribui vendedor + usa a taxa dele
-- ============================================================
drop function if exists public.register_sale(bigint, varchar, numeric, payment_method, varchar, date);

create or replace function public.register_sale(
  p_vehicle_id     bigint,
  p_vendedor_id    uuid,
  p_buyer_name     varchar,
  p_sale_price     numeric,
  p_payment_method payment_method,
  p_buyer_phone    varchar default null,
  p_sale_date      date    default current_date
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

  -- vendedor (não-manager) só registra a própria venda
  if not public.is_loja_manager() and p_vendedor_id <> public.current_person() then
    raise exception 'Vendedor só pode registrar a própria venda.';
  end if;

  -- o vendedor atribuído precisa ser da loja
  select coalesce(parent_id, id) into v_vendedor_loja
  from public.rv_sellers where id = p_vendedor_id;
  if v_vendedor_loja is distinct from v_loja then
    raise exception 'Vendedor não pertence à loja.';
  end if;

  -- o carro precisa ser da loja (admin pode qualquer)
  if not public.is_admin()
     and not exists (select 1 from public.rv_vehicles
                     where id = p_vehicle_id and seller_id = v_loja) then
    raise exception 'Veículo % não pertence à loja.', p_vehicle_id;
  end if;

  select commission_rate into v_rate from public.rv_sellers where id = p_vendedor_id;

  insert into public.rv_sales (
    vehicle_id, seller_id, vendedor_id, buyer_name, buyer_phone,
    sale_price, payment_method, sale_date
  ) values (
    p_vehicle_id, v_loja, p_vendedor_id, p_buyer_name, p_buyer_phone,
    p_sale_price, p_payment_method, p_sale_date
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
  bigint, uuid, varchar, numeric, payment_method, varchar, date
) to authenticated;

-- current_seller() não é mais usada (substituída por current_loja/current_person)
drop function if exists public.current_seller();
```

- [ ] **Step 4: Aplicar e rodar o teste (deve PASSAR)**

Run:
```bash
supabase db reset
docker exec -i $(docker ps -qf name=supabase_db) psql -U postgres -d postgres -v ON_ERROR_STOP=1 < docs/superpowers/tests/a4_register_sale_test.sql
```
Expected: `✅ A4 register_sale v2 OK`, exit 0.

- [ ] **Step 5: Rodar TODOS os testes da fase em sequência (regressão)**

Run:
```bash
for f in docs/superpowers/tests/a1_structure_test.sql docs/superpowers/tests/a2_helpers_test.sql docs/superpowers/tests/a3_rls_test.sql docs/superpowers/tests/a4_register_sale_test.sql; do
  echo "== $f =="; docker exec -i $(docker ps -qf name=supabase_db) psql -U postgres -d postgres -v ON_ERROR_STOP=1 < "$f" || exit 1; done
```
Expected: 4 blocos com `✅ ... OK`, exit 0.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0016_register_sale_v2.sql docs/superpowers/tests/a4_register_sale_test.sql
git commit -m "feat(db): register_sale v2 — atribui vendedor e usa a taxa do vendedor"
```

---

### Task A5: Regenerar tipos e manter o build verde

**Files:**
- Modify: `src/lib/database.generated.ts` (via `npm run types:gen` — não editar à mão)
- Modify: `src/features/auth/AuthProvider.tsx:99`
- Modify: `src/features/auth/routeGuards.tsx` (tipo do prop `role` + comparações)
- Modify: `src/App.tsx:116`
- Modify: `src/features/admin/pages/Plans.tsx:284`
- Modify: `src/features/admin/queries.ts:443`
- Modify: `src/features/seller/queries.ts` (assinatura de `useRegisterSale`)
- Modify: `src/features/seller/pages/Sales.tsx` (passa `vendedor_id` provisório)

**Interfaces:**
- Consumes: enum `app_role` regenerado (`admin|garagista|vendedor`); `register_sale(p_vehicle_id, p_vendedor_id, …)`.
- Produces: `RegisterSaleInput` agora inclui `vendedor_id: string`.

- [ ] **Step 1: Regenerar os tipos do banco**

Run: `npm run types:gen`
Expected: `src/lib/database.generated.ts` atualizado; `app_role` agora `"garagista" | "admin" | "vendedor"`.

- [ ] **Step 2: Verificar que o build QUEBRA (red) por causa do enum renomeado**

Run: `npx tsc -b`
Expected: erros TS2367/2322 em `AuthProvider.tsx`, `routeGuards.tsx`, `App.tsx`, `Plans.tsx`, `queries.ts` (comparações com `"seller"`), e em `seller/queries.ts`/`Sales.tsx` (assinatura de `register_sale`).

- [ ] **Step 3: Trocar o literal de role nos checks de garagista**

Em `src/features/auth/AuthProvider.tsx` linha 99, trocar:

```tsx
      isActiveSeller: seller?.role === "garagista" && seller?.status === "active",
```

Em `src/features/admin/pages/Plans.tsx` linha 284:

```tsx
  const sellers = (sellersQ.data ?? []).filter((s) => s.role === "garagista");
```

Em `src/features/admin/queries.ts` linha 443:

```tsx
  const sellers = allSellers.filter((s) => s.role === "garagista");
```

- [ ] **Step 4: Atualizar o RoleRoute para o papel `garagista`**

Em `src/features/auth/routeGuards.tsx`, trocar o tipo do prop e a comparação:

```tsx
export function RoleRoute({
  role,
  children,
}: {
  role: "admin" | "garagista";
  children: ReactNode;
}) {
  const { user, seller, loading, isAdmin } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;

  if (role === "admin" && !isAdmin) return <Navigate to="/painel" replace />;

  if (role === "garagista") {
    if (!seller) return <Navigate to="/cadastro-vendedor" replace />;
    if (seller.status === "pending")
      return <Navigate to="/aguardando-aprovacao" replace />;
    if (seller.status === "suspended")
      return <Navigate to="/conta-suspensa" replace />;
  }

  return <>{children}</>;
}
```

Em `src/App.tsx` linha 116, trocar `role="seller"` por `role="garagista"`:

```tsx
          <RoleRoute role="garagista">
```

- [ ] **Step 5: Atualizar `useRegisterSale` para enviar `vendedor_id`**

Em `src/features/seller/queries.ts`, no tipo `RegisterSaleInput` adicionar `vendedor_id` e passar na RPC:

```tsx
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

e dentro do `mutationFn`:

```tsx
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

- [ ] **Step 6: No `Sales.tsx`, atribuir provisoriamente à própria pessoa**

Em `src/features/seller/pages/Sales.tsx`, na chamada do `mutate`/`mutateAsync` do registro de venda, incluir `vendedor_id: seller?.id` (atribuição à linha logada — comportamento equivalente ao legado; o seletor de vendedor real entra na Fase C):

```tsx
      vendedor_id: seller?.id ?? "",
```

(Garantir que `seller` vem de `useAuth()` no componente; já é usado para `seller?.id`.)

- [ ] **Step 7: Verificar build verde (green)**

Run: `npx tsc -b && npm run build`
Expected: ambos exit 0, sem erros.

- [ ] **Step 8: Commit**

```bash
git add src/lib/database.generated.ts src/features/auth/AuthProvider.tsx src/features/auth/routeGuards.tsx src/App.tsx src/features/admin/pages/Plans.tsx src/features/admin/queries.ts src/features/seller/queries.ts src/features/seller/pages/Sales.tsx
git commit -m "chore(fe): adapta tipos/roles ao enum garagista + vendedor_id no register_sale"
```

---

## Self-Review (preenchido)

**Spec coverage (Seções 2-3 do spec, parte de banco):**
- Enum `seller→garagista`+`vendedor` → Task A1 ✓
- `parent_id`, `slug` nullable → Task A1 ✓
- `rv_sales.vendedor_id`/`rv_commissions.vendedor_id` NOT NULL + backfill → Task A1 ✓
- Helpers `current_person/current_loja/is_loja_manager` → Task A2 ✓
- RLS 3 níveis + trigger garagista gere equipe → Task A3 ✓
- `register_sale` v2 (taxa do vendedor, vendedor_id obrigatório, validações) → Task A4 ✓
- Migração não-destrutiva (backfill) → Task A1 ✓
- Risco "rename enum quebra o front" → Task A5 ✓
- Risco "substituir current_seller()" → Task A4 (drop) + A2/A3 (novos helpers) ✓

Fora de escopo desta fase (vão para B–F): AuthProvider expor role/loja, guards multi-papel real (vendedor), Edge Function `invite-vendedor`, telas Equipe/vendedor, troca de contexto, rótulos. Documentado no spec, Seção 6.

**Placeholder scan:** sem TBD/TODO de plano; o único "provisório" (Sales.tsx `vendedor_id: seller?.id`) é decisão consciente de Fase A com código real, substituída na Fase C.

**Type consistency:** `register_sale(p_vehicle_id, p_vendedor_id, …)` idêntico entre A4 (SQL) e A5 (`useRegisterSale`). `RegisterSaleInput.vendedor_id: string`. Helpers retornam `uuid`/`boolean` conforme usados em A3.
