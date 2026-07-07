# Fase B — Auth e papéis (multi-role + convite de vendedor) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expor os 3 papéis (admin/garagista/vendedor) no front com redirect e guards corretos, e criar a Edge Function `invite-vendedor` para o garagista cadastrar a equipe.

**Architecture:** O `AuthProvider` deriva `role`/`lojaId`/`personId` da linha `rv_sellers` do usuário. O `RoleRoute` passa a aceitar uma lista de papéis. A criação de vendedor (que exige criar usuário em `auth.users`) roda numa Edge Function com service-role, validando que o chamador é garagista/admin e fixando `parent_id` = a loja do chamador no servidor.

**Tech Stack:** React 18 · TypeScript · Vite · React Router · Supabase JS · Deno (Edge Functions) · Postgres (verificação via psql).

## Global Constraints

- Banco local roda via `supabase start`; Postgres no container `supabase_db_revvio` (descobrir: `docker ps -qf name=supabase_db`).
- Rodar SQL: `docker exec -i $(docker ps -qf name=supabase_db) psql -U postgres -d postgres -v ON_ERROR_STOP=1 < <file.sql>`.
- Build verde obrigatório a cada task que toca o front: `npx tsc -b` (exit 0) e `npm run build` (exit 0, sem chunk > 500 kB novo).
- Enum de papéis: `admin | garagista | vendedor` (já em `app_role`). Tipo TS: `Database["public"]["Enums"]["app_role"]` (alias possível em `database.types.ts`).
- **Preservar a UI atual do `/dashboard` (admin)** — Fase B não altera telas do admin.
- Edge Functions seguem o padrão de `supabase/functions/asaas-billing/index.ts`: `corsHeaders`/`json` de `../_shared/cors.ts`, `asUser` (client com o `Authorization` do chamador) para identidade, `db` (service-role) para gravações.
- `parent_id` do vendedor vem SEMPRE do servidor (a loja do chamador), nunca do corpo da requisição.
- Vendedor nasce `status='active'`, `role='vendedor'`, `slug=null`.

---

### Task B1: AuthProvider expõe papel, loja e pessoa

**Files:**
- Modify: `src/features/auth/AuthProvider.tsx`
- Modify: `src/lib/database.types.ts` (adicionar alias `AppRole`)

**Interfaces:**
- Produces: `useAuth()` passa a expor `role: AppRole | null`, `lojaId: string | null`, `personId: string | null`, `isGaragista: boolean`, `isVendedor: boolean` (além dos atuais `isAdmin`, `isActiveSeller`).
- `AppRole = "admin" | "garagista" | "vendedor"`.

- [ ] **Step 1: Exportar o alias `AppRole`**

Em `src/lib/database.types.ts`, na seção de Enums, adicionar:

```ts
export type AppRole = Enums["app_role"];
```

- [ ] **Step 2: Verificar o tipo compila**

Run: `npx tsc -b`
Expected: exit 0 (o alias resolve para `"admin" | "garagista" | "vendedor"`).

- [ ] **Step 3: Estender o `AuthState` e o valor do contexto**

Em `src/features/auth/AuthProvider.tsx`:

(a) importar o tipo no topo (junto do import de `Seller`):

```ts
import type { AppRole, Seller } from "@/lib/database.types";
```

(b) na interface `AuthState`, adicionar os campos:

```ts
  role: AppRole | null;
  lojaId: string | null;
  personId: string | null;
  isGaragista: boolean;
  isVendedor: boolean;
```

(c) no `useMemo` que monta o `value`, adicionar as derivações (logo após `isAdmin`):

```ts
      isAdmin: seller?.role === "admin",
      isGaragista: seller?.role === "garagista",
      isVendedor: seller?.role === "vendedor",
      role: seller?.role ?? null,
      personId: seller?.id ?? null,
      lojaId: seller ? seller.parent_id ?? seller.id : null,
      isActiveSeller: seller?.role === "garagista" && seller?.status === "active",
```

- [ ] **Step 4: Verificar build verde**

Run: `npx tsc -b && npm run build`
Expected: ambos exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/lib/database.types.ts src/features/auth/AuthProvider.tsx
git commit -m "feat(auth): AuthProvider expõe role/lojaId/personId/isGaragista/isVendedor"
```

---

### Task B2: Guards e redirect multi-papel

**Files:**
- Modify: `src/features/auth/routeGuards.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `useAuth()` com `role`/`isAdmin` (de B1).
- Produces: `RoleRoute` aceita `roles: AppRole[]` (substitui o prop `role: "admin" | "garagista"`). `RoleRedirect` trata vendedor.

- [ ] **Step 1: Reescrever o `RoleRoute` para lista de papéis**

Em `src/features/auth/routeGuards.tsx`, substituir a função `RoleRoute` inteira por:

```tsx
import type { AppRole } from "@/lib/database.types";

/** Exige um dos papéis. A segurança real é o RLS; isto é só UX/navegação. */
export function RoleRoute({
  roles,
  children,
}: {
  roles: AppRole[];
  children: ReactNode;
}) {
  const { user, seller, loading, role, isAdmin } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;

  // admin acessa qualquer área autorizada
  if (isAdmin) return <>{children}</>;

  if (!seller) return <Navigate to="/cadastro-vendedor" replace />;
  if (seller.status === "pending")
    return <Navigate to="/aguardando-aprovacao" replace />;
  if (seller.status === "suspended")
    return <Navigate to="/conta-suspensa" replace />;

  if (!role || !roles.includes(role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
```

(manter o import existente de `AppRole` único — se já houver import de tipos, juntar.)

- [ ] **Step 2: Atualizar o `RoleRedirect` e as rotas no `App.tsx`**

Em `src/App.tsx`, na função `RoleRedirect`, tratar o vendedor (que também vai para `/painel`):

```tsx
function RoleRedirect() {
  const { loading, user, seller, isAdmin } = useAuth();
  if (loading) return <div className="p-8 text-slate-400">Carregando…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (isAdmin) return <Navigate to="/dashboard" replace />;
  if (!seller) return <Navigate to="/cadastro-vendedor" replace />;
  if (seller.status === "pending")
    return <Navigate to="/aguardando-aprovacao" replace />;
  if (seller.status === "suspended")
    return <Navigate to="/conta-suspensa" replace />;
  return <Navigate to="/painel" replace />; // garagista ou vendedor
}
```

E trocar os dois usos de `RoleRoute`:

```tsx
          <RoleRoute roles={["garagista", "vendedor"]}>
            <PainelLayout />
          </RoleRoute>
```

```tsx
          <RoleRoute roles={["admin"]}>
            <AdminLayout />
          </RoleRoute>
```

- [ ] **Step 3: Verificar build verde**

Run: `npx tsc -b && npm run build`
Expected: ambos exit 0 (nenhum uso remanescente do prop antigo `role=`).

- [ ] **Step 4: Commit**

```bash
git add src/features/auth/routeGuards.tsx src/App.tsx
git commit -m "feat(auth): RoleRoute multi-papel + redirect inclui vendedor"
```

---

### Task B3: Edge Function `invite-vendedor`

**Files:**
- Create: `supabase/functions/invite-vendedor/index.ts`
- Test: `docs/superpowers/tests/b3_invite_vendedor_test.sh`

**Interfaces:**
- Consumes: `corsHeaders`, `json` de `../_shared/cors.ts`; envs `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (injetadas pelo runtime).
- Produces: `POST /functions/v1/invite-vendedor` body `{ name, email, commission_rate }` → cria `auth.users` + linha `rv_sellers` (`role=vendedor`, `status=active`, `parent_id`= loja do chamador). Retorna `{ ok: true, vendedorId }`.

- [ ] **Step 1: Escrever o teste de integração (falha primeiro)**

Create `docs/superpowers/tests/b3_invite_vendedor_test.sh`:

```bash
#!/usr/bin/env bash
# Integração: garagista chama invite-vendedor e cria um vendedor na própria loja.
# Pré-requisito: `supabase start` no ar. Sobe `functions serve` sozinho.
set -uo pipefail
API="http://127.0.0.1:54321"
PSQL() { docker exec -i "$(docker ps -qf name=supabase_db)" psql -U postgres -d postgres -tAc "$1"; }
SRV_KEY=$(supabase status -o env 2>/dev/null | grep SERVICE_ROLE_KEY | cut -d= -f2 | tr -d '"')
ANON_KEY=$(supabase status -o env 2>/dev/null | grep ANON_KEY | cut -d= -f2 | tr -d '"')

EMAIL_G="garagista-b3@test.dev"; PW="senha123456"
EMAIL_V="vendedor-b3@test.dev"

cleanup() {
  PSQL "delete from public.rv_sellers where email in ('$EMAIL_G','$EMAIL_V');" >/dev/null
  PSQL "delete from auth.users where email in ('$EMAIL_G','$EMAIL_V');" >/dev/null
  [ -n "${SERVE_PID:-}" ] && kill "$SERVE_PID" 2>/dev/null
}
trap cleanup EXIT

# 1. cria o garagista (usuário confirmado) + linha rv_sellers
GID=$(curl -s "$API/auth/v1/admin/users" -H "apikey: $SRV_KEY" -H "Authorization: Bearer $SRV_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL_G\",\"password\":\"$PW\",\"email_confirm\":true}" | grep -oP '"id":"\K[^"]+' | head -1)
[ -n "$GID" ] || { echo "FALHA: não criou o garagista"; exit 1; }
PSQL "insert into public.rv_sellers (user_id,name,slug,email,status,role,commission_rate)
      values ('$GID','Garagem B3','garagem-b3','$EMAIL_G','active','garagista',0);" >/dev/null

# 2. login do garagista → access_token
TOKEN=$(curl -s "$API/auth/v1/token?grant_type=password" -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" -d "{\"email\":\"$EMAIL_G\",\"password\":\"$PW\"}" \
  | grep -oP '"access_token":"\K[^"]+' | head -1)
[ -n "$TOKEN" ] || { echo "FALHA: login do garagista"; exit 1; }

# 3. sobe a function localmente
supabase functions serve invite-vendedor >/tmp/b3-serve.log 2>&1 &
SERVE_PID=$!
for i in $(seq 1 30); do curl -s "$API/functions/v1/invite-vendedor" -o /dev/null && break; sleep 1; done

# 4. garagista convida o vendedor (taxa 7%)
RESP=$(curl -s "$API/functions/v1/invite-vendedor" -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"name\":\"Vendedor B3\",\"email\":\"$EMAIL_V\",\"commission_rate\":7}")
echo "resposta: $RESP"

# 5. asserts no banco: vendedor criado, vinculado à loja do garagista, ativo, taxa 7
ROW=$(PSQL "select role||'|'||status||'|'||coalesce(commission_rate::text,'null')||'|'||(parent_id = '$(PSQL "select id from public.rv_sellers where user_id='$GID'")')
            from public.rv_sellers where email='$EMAIL_V';")
echo "linha vendedor: $ROW"
[ "$ROW" = "vendedor|active|7.00|t" ] || { echo "FALHA: vendedor não criado corretamente ($ROW)"; exit 1; }

echo "✅ B3 invite-vendedor OK"
```

- [ ] **Step 2: Rodar o teste (deve FALHAR)**

Run: `bash docs/superpowers/tests/b3_invite_vendedor_test.sh`
Expected: FALHA — a function `invite-vendedor` ainda não existe (curl no passo 4 retorna erro/404).

- [ ] **Step 3: Escrever a Edge Function**

Create `supabase/functions/invite-vendedor/index.ts`:

```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // 1. identidade do chamador
    const authHeader = req.headers.get("Authorization") ?? "";
    const asUser = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: auth, error: uErr } = await asUser.auth.getUser();
    if (uErr || !auth?.user) return json({ error: "Não autenticado." }, 401);

    // 2. service-role para ler/gravar ignorando RLS
    const db = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: caller, error: cErr } = await db
      .from("rv_sellers")
      .select("id, role, parent_id")
      .eq("user_id", auth.user.id)
      .single();
    if (cErr || !caller) return json({ error: "Perfil não encontrado." }, 403);
    if (caller.role !== "garagista" && caller.role !== "admin")
      return json({ error: "Apenas o garagista pode cadastrar vendedores." }, 403);

    const loja = caller.parent_id ?? caller.id; // a loja do chamador (servidor decide)

    // 3. payload
    const { name, email, commission_rate } = await req.json();
    if (!name || !email) return json({ error: "Nome e e-mail são obrigatórios." }, 400);
    const rate = Number(commission_rate ?? 0);
    if (Number.isNaN(rate) || rate < 0 || rate > 100)
      return json({ error: "Taxa de comissão inválida (0–100)." }, 400);

    // 4. cria o usuário (convite por e-mail → vendedor define a senha)
    const { data: invited, error: iErr } = await db.auth.admin.inviteUserByEmail(email, {
      data: { name },
    });
    if (iErr || !invited?.user) {
      const msg = iErr?.message ?? "Erro ao convidar o usuário.";
      const code = /already/i.test(msg) ? 409 : 400;
      return json({ error: msg }, code);
    }

    // 5. cria a linha do vendedor vinculada à loja do chamador
    const { data: vendedor, error: vErr } = await db
      .from("rv_sellers")
      .insert({
        user_id: invited.user.id,
        name,
        email,
        role: "vendedor",
        status: "active",
        parent_id: loja,
        commission_rate: rate,
      })
      .select("id")
      .single();
    if (vErr) {
      // desfaz o usuário órfão se a linha falhar
      await db.auth.admin.deleteUser(invited.user.id);
      return json({ error: vErr.message }, 400);
    }

    return json({ ok: true, vendedorId: vendedor.id });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erro interno." }, 500);
  }
});
```

- [ ] **Step 4: Registrar a function no `config.toml`**

Em `supabase/config.toml`, adicionar (junto às demais `[functions.*]`):

```toml
[functions.invite-vendedor]
verify_jwt = true
```

- [ ] **Step 5: Rodar o teste (deve PASSAR)**

Run: `bash docs/superpowers/tests/b3_invite_vendedor_test.sh`
Expected: imprime `✅ B3 invite-vendedor OK` e sai 0 (linha do vendedor = `vendedor|active|7.00|t`).

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/invite-vendedor/index.ts supabase/config.toml docs/superpowers/tests/b3_invite_vendedor_test.sh
git commit -m "feat(auth): Edge Function invite-vendedor (garagista cadastra a equipe)"
```

---

## Self-Review (preenchido)

**Spec coverage (Seção 4 do spec):**
- AuthProvider expõe role/lojaId/personId → B1 ✓
- Redirect por papel (admin/garagista/vendedor) → B2 ✓
- RoleRoute aceita lista de papéis; `/painel` aceita garagista+vendedor → B2 ✓
- Edge Function `invite-vendedor` (service role, parent_id do servidor, vendedor ativo) → B3 ✓
- Troca de contexto do gestor (seletor Plataforma↔Minha loja) → Fase E (fora desta fase)
- Telas do painel do vendedor (modo limitado) → Fase D (fora desta fase)

**Placeholder scan:** sem TBD/TODO. Testes com asserts reais (B3 valida a linha criada no banco).

**Type consistency:** `AppRole` definido em B1 e consumido por `RoleRoute` (B2). `roles: AppRole[]` em `RoleRoute` casa com os usos em `App.tsx`. Campos novos do `AuthState` (role/lojaId/personId) usados por `RoleRoute`/`RoleRedirect`.

**Nota de ambiente:** B1/B2 não têm runner de testes unitários no projeto; a verificação é `tsc -b` + `npm run build` (gate concreto do sistema de tipos). B3 tem teste de integração automatizado (functions serve + curl + asserts no banco).
