# Contas de comprador + rastreamento de cliques — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduzir contas de comprador (e-mail+senha) com gate de login no "Quero ver o carro", e sobre essa identidade registrar cliques off-site e exibir, para admin e garagista, quem clicou em cada carro.

**Architecture:** Fase 1 adiciona `rv_buyers` + `rv_leads.buyer_id`, estende o `AuthProvider` para reconhecer compradores (sem alterar o fluxo de vendedor), um `BuyerAuthModal` reutilizável, páginas `/cadastro` e `/minha-conta`, e o gate no formulário do veículo. Fase 2 adiciona `rv_click_events` + `log_click_event`, captura nos botões off-site e drill-down nos painéis admin e garagista.

**Tech Stack:** React 18 + TS, react-hook-form + zod, @tanstack/react-query, supabase-js (Auth + Postgres), Tailwind, Supabase migrations.

## Global Constraints

- Gate do projeto = `npm run build` (`tsc -b && vite build`) verde. Sem framework de testes; verificação = build verde + checagem manual descrita.
- Commits terminam com: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- Não editar `src/lib/database.generated.ts` à mão — ele é **regenerado do remoto** (`supabase gen types typescript --db-url "$SUPABASE_DB_URL"`) após cada migration aplicada. Aliases convenientes ficam em `src/lib/database.types.ts`.
- Migrations aplicadas no remoto via `supabase db push --db-url "$SUPABASE_DB_URL"` (credenciais em `.env.local`); verificar via REST.
- Autenticação: e-mail+senha, **sem** confirmação de e-mail. Cadastro do comprador: nome, e-mail, telefone, cidade, senha.
- Gate de login (Fase 1): "Quero ver o carro" **+ WhatsApp e Instagram da mini-loja**. Telefone (texto) fica aberto.
- Eventos (Fase 2) `kind ∈ {'vehicle_interest','store_whatsapp','store_instagram'}`; todos com `buyer_id` (botões gated). Registros anônimos antigos exibidos como "Visitante não identificado".
- Painel (Fase 2): aba "Anúncios" (admin, com filtro por garagista) e `/painel/leads` (garagista), com **dois rastreamentos** — por veículo (quem clicou) e por canal externo WhatsApp/Instagram (quem acessou).
- Vendedor/garagista/admin não mudam de comportamento.

---

# FASE 1 — Contas de comprador + gate

### Task 1: Migration `rv_buyers` + `rv_leads.buyer_id` (aplicar no remoto + regen tipos)

**Files:**
- Create: `supabase/migrations/0032_buyers.sql`
- Modify: `src/lib/database.generated.ts` (regenerado, não manual)

**Interfaces:**
- Produces: tabela `rv_buyers(id uuid pk, name, phone, city, email, created_at, updated_at)`; coluna `rv_leads.buyer_id uuid`; tipos gerados incluindo ambos.

- [ ] **Step 1: Criar a migration**

`supabase/migrations/0032_buyers.sql`:
```sql
-- ============================================================
-- 0032_buyers.sql — Contas de comprador (end-customer)
-- ============================================================
create table public.rv_buyers (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text not null,
  phone      text,
  city       text,
  email      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_rv_buyers_updated_at
  before update on public.rv_buyers
  for each row execute function public.set_updated_at();

alter table public.rv_buyers enable row level security;

-- comprador gerencia o próprio registro
create policy "rv_buyers_self_select" on public.rv_buyers
  for select using (id = auth.uid());
create policy "rv_buyers_self_insert" on public.rv_buyers
  for insert with check (id = auth.uid());
create policy "rv_buyers_self_update" on public.rv_buyers
  for update using (id = auth.uid()) with check (id = auth.uid());

-- admin e garagista podem ler (para os painéis da Fase 2)
create policy "rv_buyers_staff_read" on public.rv_buyers
  for select using (public.is_admin() or public.is_loja_manager());

-- lead atrelado à conta do comprador
alter table public.rv_leads
  add column if not exists buyer_id uuid references public.rv_buyers(id) on delete set null;
create index if not exists idx_rv_leads_buyer_id on public.rv_leads(buyer_id);
```

- [ ] **Step 2: Aplicar no remoto**

Run: `cd <repo> && set -a; . ./.env.local; set +a; supabase db push --db-url "$SUPABASE_DB_URL"`
Expected: aplica `0032_buyers.sql` sem erro.

- [ ] **Step 3: Regenerar tipos do remoto**

Run: `set -a; . ./.env.local; set +a; supabase gen types typescript --db-url "$SUPABASE_DB_URL" > src/lib/database.generated.ts`
Expected: arquivo regenerado contém `rv_buyers` e `rv_leads.buyer_id`.

- [ ] **Step 4: Verificar via REST**

Run: `set -a; . ./.env.local; set +a; curl -s -o /dev/null -w "%{http_code}\n" "${VITE_SUPABASE_URL}/rest/v1/rv_buyers?select=id&limit=1" -H "apikey: ${VITE_SUPABASE_ANON_KEY}"`
Expected: `200`.

- [ ] **Step 5: Build (tipos compilam)**

Run: `npm run build 2>&1 | tail -3`
Expected: `✓ built` (se a regeneração introduzir erro não relacionado, reconciliar antes de seguir).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0032_buyers.sql src/lib/database.generated.ts
git commit -m "$(printf 'feat(db): rv_buyers + rv_leads.buyer_id\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 2: Aliases de tipo (Buyer)

**Files:**
- Modify: `src/lib/database.types.ts`

**Interfaces:**
- Produces: `export type Buyer = Tables["rv_buyers"]["Row"]` (e `Lead` já inclui `buyer_id` via generated).

- [ ] **Step 1: Adicionar alias**

Em `src/lib/database.types.ts`, na seção "Linhas de tabela", após `export type Charge = ...`:
```ts
export type Buyer = Tables["rv_buyers"]["Row"];
```

- [ ] **Step 2: Build**

Run: `npm run build 2>&1 | tail -3`
Expected: `✓ built`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/database.types.ts
git commit -m "$(printf 'feat(types): alias Buyer\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 3: Lógica de auth do comprador (signup/profile)

**Files:**
- Create: `src/features/auth/buyer.ts`

**Interfaces:**
- Consumes: `supabase`, `Buyer` (Task 2).
- Produces:
  - `signUpBuyer(input: { name: string; email: string; phone: string; city: string; password: string }): Promise<void>`
  - `updateBuyerProfile(id: string, fields: { name: string; phone: string; city: string }): Promise<void>`
  - `fetchBuyer(userId: string): Promise<Buyer | null>`

- [ ] **Step 1: Criar o módulo**

`src/features/auth/buyer.ts`:
```ts
import { supabase } from "@/lib/supabase";
import type { Buyer } from "@/lib/database.types";

export async function fetchBuyer(userId: string): Promise<Buyer | null> {
  const { data, error } = await supabase
    .from("rv_buyers")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    console.error("Erro ao carregar comprador:", error.message);
    return null;
  }
  return (data as Buyer) ?? null;
}

export async function signUpBuyer(input: {
  name: string;
  email: string;
  phone: string;
  city: string;
  password: string;
}): Promise<void> {
  // NÃO enviar `name` em user_metadata: ensureSeller() criaria um vendedor.
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
  });
  if (error) throw error;
  const userId = data.user?.id;
  if (!userId) throw new Error("Não foi possível criar a conta.");
  const { error: insErr } = await supabase.from("rv_buyers").insert({
    id: userId,
    name: input.name.trim(),
    phone: input.phone || null,
    city: input.city.trim() || null,
    email: input.email.trim(),
  });
  if (insErr) throw insErr;
}

export async function updateBuyerProfile(
  id: string,
  fields: { name: string; phone: string; city: string }
): Promise<void> {
  const { error } = await supabase
    .from("rv_buyers")
    .update({
      name: fields.name.trim(),
      phone: fields.phone || null,
      city: fields.city.trim() || null,
    })
    .eq("id", id);
  if (error) throw error;
}
```

- [ ] **Step 2: Build**

Run: `npm run build 2>&1 | tail -3`
Expected: `✓ built` (módulo compila; ainda não usado).

- [ ] **Step 3: Commit**

```bash
git add src/features/auth/buyer.ts
git commit -m "$(printf 'feat(auth): modulo de cadastro/perfil do comprador\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 4: AuthProvider reconhece comprador

**Files:**
- Modify: `src/features/auth/AuthProvider.tsx`

**Interfaces:**
- Consumes: `fetchBuyer` (Task 3), `Buyer` (Task 2).
- Produces: contexto com `buyer: Buyer | null` e `isBuyer: boolean`.

- [ ] **Step 1: Importar tipos/funções**

No topo, ajustar imports:
```ts
import type { AppRole, Buyer, Seller } from "@/lib/database.types";
import { fetchBuyer } from "./buyer";
```

- [ ] **Step 2: Adicionar campos à interface**

Em `interface AuthState`, após `seller: Seller | null;`:
```ts
  buyer: Buyer | null;
  isBuyer: boolean;
```

- [ ] **Step 3: Estado e carregamento do buyer**

Após `const [seller, setSeller] = useState<Seller | null>(null);`:
```ts
  const [buyer, setBuyer] = useState<Buyer | null>(null);
```
Substituir a função `loadSeller` por:
```ts
  async function loadSeller(user: User | undefined | null) {
    if (!user) {
      setSeller(null);
      setBuyer(null);
      return;
    }
    const s = await ensureSeller(user);
    setSeller(s);
    setBuyer(s ? null : await fetchBuyer(user.id));
  }
```

- [ ] **Step 4: Expor no value**

No objeto do `useMemo`, após `seller,`:
```ts
      buyer,
      isBuyer: !!buyer,
```
E adicionar `buyer` à lista de dependências do `useMemo`:
```ts
    [session, seller, buyer, loading]
```
No `signOut`, após `setSeller(null);` adicionar `setBuyer(null);`.

- [ ] **Step 5: Build**

Run: `npm run build 2>&1 | tail -3`
Expected: `✓ built`.

- [ ] **Step 6: Commit**

```bash
git add src/features/auth/AuthProvider.tsx
git commit -m "$(printf 'feat(auth): AuthProvider reconhece comprador (buyer/isBuyer)\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 5: BuyerAuthModal (login/cadastro reutilizável)

**Files:**
- Create: `src/features/auth/components/BuyerAuthModal.tsx`

**Interfaces:**
- Consumes: `signUpBuyer` (Task 3), `useAuth().refreshSeller`, `Modal`/`Field`/`Input`/`Button`/`Alert` de `@/components/ui-light`, `maskPhone`.
- Produces: `BuyerAuthModal({ open, onClose, onAuthed }: { open: boolean; onClose: () => void; onAuthed: () => void })`.

- [ ] **Step 1: Criar o componente**

`src/features/auth/components/BuyerAuthModal.tsx`:
```tsx
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/features/auth/AuthProvider";
import { signUpBuyer } from "@/features/auth/buyer";
import { maskPhone } from "@/lib/masks";
import { Alert, Button, Field, Input, Modal } from "@/components/ui-light";

type Tab = "entrar" | "criar";

export function BuyerAuthModal({
  open,
  onClose,
  onAuthed,
}: {
  open: boolean;
  onClose: () => void;
  onAuthed: () => void;
}) {
  const { refreshSeller } = useAuth();
  const [tab, setTab] = useState<Tab>("entrar");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // campos
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [password, setPassword] = useState("");

  async function finish() {
    await refreshSeller(); // recarrega buyer no contexto
    onAuthed();
  }

  async function handleEntrar() {
    setError(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await finish();
    } catch (e) {
      setError(
        /invalid login credentials/i.test((e as Error).message)
          ? "E-mail ou senha incorretos."
          : (e as Error).message
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleCriar() {
    setError(null);
    if (!name.trim() || !email.trim() || phone.replace(/\D/g, "").length < 10 || !city.trim() || password.length < 6) {
      setError("Preencha todos os campos (senha com no mínimo 6 caracteres).");
      return;
    }
    setLoading(true);
    try {
      await signUpBuyer({ name, email, phone, city, password });
      await finish();
    } catch (e) {
      setError(
        /already registered/i.test((e as Error).message)
          ? "Este e-mail já tem conta. Use a aba Entrar."
          : (e as Error).message
      );
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <Modal open onClose={onClose} title="Entre para continuar">
      <p className="mb-4 text-sm text-slate-600">
        Crie sua conta ou entre para enviar seu interesse no veículo.
      </p>

      <div className="mb-4 flex rounded-lg border border-hair p-1">
        <button
          onClick={() => setTab("entrar")}
          className={`flex-1 rounded-md py-1.5 text-sm font-semibold ${tab === "entrar" ? "bg-brand text-white" : "text-slate-600"}`}
        >
          Entrar
        </button>
        <button
          onClick={() => setTab("criar")}
          className={`flex-1 rounded-md py-1.5 text-sm font-semibold ${tab === "criar" ? "bg-brand text-white" : "text-slate-600"}`}
        >
          Criar conta
        </button>
      </div>

      {error && (
        <div className="mb-3">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {tab === "criar" && (
          <>
            <Field label="Nome">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" />
            </Field>
            <Field label="Telefone">
              <Input
                value={phone}
                inputMode="tel"
                onChange={(e) => setPhone(maskPhone(e.target.value))}
                placeholder="(11) 99999-9999"
              />
            </Field>
            <Field label="Cidade">
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Sua cidade" />
            </Field>
          </>
        )}
        <Field label="E-mail">
          <Input value={email} type="email" onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" />
        </Field>
        <Field label="Senha">
          <Input value={password} type="password" onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </Field>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
        {tab === "entrar" ? (
          <Button loading={loading} onClick={handleEntrar}>
            Entrar
          </Button>
        ) : (
          <Button loading={loading} onClick={handleCriar}>
            Criar conta
          </Button>
        )}
      </div>
    </Modal>
  );
}
```

- [ ] **Step 2: Build**

Run: `npm run build 2>&1 | tail -3`
Expected: `✓ built`.

- [ ] **Step 3: Commit**

```bash
git add src/features/auth/components/BuyerAuthModal.tsx
git commit -m "$(printf 'feat(auth): BuyerAuthModal (entrar/criar conta) reutilizavel\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 6: Gate no "Quero ver o carro" + lead com buyer_id

**Files:**
- Modify: `src/features/public/pages/VehicleDetails.tsx` (`LeadForm` ~123-262)
- Modify: `src/features/leads/queries.ts` (`CreateLeadInput`/`useCreateLead` — adicionar `buyer_id`)

**Interfaces:**
- Consumes: `useAuth().user`/`buyer`, `BuyerAuthModal` (Task 5).
- Produces: lead gravado com `buyer_id`; envio bloqueado até login.

- [ ] **Step 1: `buyer_id` no input do lead**

Em `src/features/leads/queries.ts`, localizar o tipo de input do `useCreateLead` (objeto com `seller_id`, `vehicle_id`, `name`, ...). Adicionar o campo `buyer_id?: string | null;` ao tipo e incluí-lo no `.insert({...})` da mutation (`buyer_id: vars.buyer_id ?? null`). (Buscar `rv_leads").insert` no arquivo para localizar o ponto exato.)

- [ ] **Step 2: Importações e estado no LeadForm**

Em `VehicleDetails.tsx`, no topo do arquivo adicionar:
```ts
import { useAuth } from "@/features/auth/AuthProvider";
import { BuyerAuthModal } from "@/features/auth/components/BuyerAuthModal";
import { useEffect } from "react";
```
(`useState` já é importado; garantir que `useEffect` esteja na lista.)
Dentro de `function LeadForm`, após os `useState` existentes:
```ts
  const { user, buyer } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);

  // pré-preenche a partir do perfil do comprador
  useEffect(() => {
    if (buyer) {
      setNome((v) => v || buyer.name || "");
      setCelular((v) => v || buyer.phone || "");
      setEmail((v) => v || buyer.email || "");
      setCidade((v) => v || buyer.city || "");
    }
  }, [buyer]);
```

- [ ] **Step 3: Gate no `enviar()`**

Substituir o início de `enviar()`:
```ts
  function enviar() {
    if (!validate()) return;
```
por:
```ts
  function enviar() {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    if (!validate()) return;
```
E no `createLead.mutate({...})`, adicionar `buyer_id: buyer?.id ?? null,` ao objeto.

- [ ] **Step 4: Renderizar o modal e continuar após login**

No `return` do `LeadForm`, logo antes do fechamento do container raiz (após o bloco do botão "Quero ver o carro"), adicionar:
```tsx
      <BuyerAuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onAuthed={() => {
          setAuthOpen(false);
          // após logar, o useEffect preenche os campos; tenta enviar de novo
          setTimeout(enviar, 0);
        }}
      />
```

- [ ] **Step 5: Build**

Run: `npm run build 2>&1 | tail -3`
Expected: `✓ built`.

- [ ] **Step 6: Commit**

```bash
git add src/features/public/pages/VehicleDetails.tsx src/features/leads/queries.ts
git commit -m "$(printf 'feat(public): gate de login no Quero ver o carro + lead com buyer_id\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 7: Roteamento — /cadastro, redirect de comprador, header

**Files:**
- Create: `src/features/auth/pages/CadastroComprador.tsx`
- Modify: `src/App.tsx` (rota `/cadastro`; `RoleRedirect`)
- Modify: `src/features/public/components/PublicHeader.tsx` (estado de comprador)
- Modify: `src/features/auth/pages/Login.tsx` (rodapé: link p/ criar conta de comprador)

**Interfaces:**
- Consumes: `signUpBuyer` (Task 3), `useAuth().isBuyer`.

- [ ] **Step 1: Página de cadastro do comprador**

`src/features/auth/pages/CadastroComprador.tsx`:
```tsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signUpBuyer } from "@/features/auth/buyer";
import { useAuth } from "@/features/auth/AuthProvider";
import { maskPhone } from "@/lib/masks";
import { AuthSplitLayout, authFieldWrap, authFieldInput } from "../AuthSplitLayout";
import { Icon } from "@/features/public/components/icons";

export function CadastroComprador() {
  const navigate = useNavigate();
  const { refreshSeller } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !email.trim() || phone.replace(/\D/g, "").length < 10 || !city.trim() || password.length < 6) {
      setError("Preencha todos os campos (senha com no mínimo 6 caracteres).");
      return;
    }
    setLoading(true);
    try {
      await signUpBuyer({ name, email, phone, city, password });
      await refreshSeller();
      navigate("/", { replace: true });
    } catch (err) {
      setError(
        /already registered/i.test((err as Error).message)
          ? "Este e-mail já tem conta. Faça login."
          : (err as Error).message
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthSplitLayout
      title="Criar conta"
      subtitle="Cadastre-se para demonstrar interesse nos veículos."
      footer={
        <>
          Já tem conta?{" "}
          <Link to="/login" className="font-semibold text-brand hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        <div className={authFieldWrap}>
          <Icon name="user" size={18} className="text-slate-400" />
          <input className={authFieldInput} placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className={authFieldWrap}>
          <Icon name="phone" size={18} className="text-slate-400" />
          <input className={authFieldInput} inputMode="tel" placeholder="Telefone" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} />
        </div>
        <div className={authFieldWrap}>
          <Icon name="store" size={18} className="text-slate-400" />
          <input className={authFieldInput} placeholder="Cidade" value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
        <div className={authFieldWrap}>
          <Icon name="mail" size={18} className="text-slate-400" />
          <input className={authFieldInput} type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className={authFieldWrap}>
          <Icon name="lock" size={18} className="text-slate-400" />
          <input className={authFieldInput} type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="mt-1 inline-flex items-center justify-center rounded-xl bg-brand py-3 text-sm font-bold text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {loading ? "Criando…" : "Criar conta"}
        </button>
      </form>
    </AuthSplitLayout>
  );
}
```
> Nota: confirmar que os ícones `user`, `phone`, `store`, `mail`, `lock` existem em `icons.tsx`; se algum faltar, usar `mail`/`store` já presentes (ver Task — checagem rápida com grep antes de codar).

- [ ] **Step 2: Rota + RoleRedirect**

Em `src/App.tsx`, adicionar o import lazy junto aos demais de auth:
```ts
const CadastroComprador = lazy(() =>
  import("@/features/auth/pages/CadastroComprador").then((m) => ({ default: m.CadastroComprador }))
);
```
Adicionar a rota pública (junto a `/login`):
```tsx
        <Route path="/cadastro" element={<CadastroComprador />} />
```
Em `RoleRedirect`, trocar a linha:
```tsx
  if (!seller) return <Navigate to="/cadastro-vendedor" replace />;
```
por:
```tsx
  if (!seller) return <Navigate to={isBuyer ? "/" : "/cadastro-vendedor"} replace />;
```
E adicionar `isBuyer` à desestruturação no topo de `RoleRedirect`:
```tsx
  const { loading, user, seller, isAdmin, isBuyer } = useAuth();
```

- [ ] **Step 3: Header reconhece comprador**

Em `PublicHeader.tsx`, trocar:
```tsx
  const { user, isAdmin, seller, signOut } = useAuth();
  const navigate = useNavigate();
  const painelHref = isAdmin ? "/dashboard" : seller ? "/painel" : "/app";
```
por:
```tsx
  const { user, isAdmin, seller, isBuyer, signOut } = useAuth();
  const navigate = useNavigate();
  const painelHref = isAdmin ? "/dashboard" : seller ? "/painel" : "/minha-conta";
  const painelLabel = isBuyer ? "Minha conta" : "Painel";
```
E no JSX do bloco logado, trocar o texto do link "Painel":
```tsx
                  <Icon name="grid" size={15} /> {painelLabel}
```

- [ ] **Step 4: Login aponta cadastro de comprador**

Em `Login.tsx`, no `footer` do `AuthSplitLayout`, adicionar abaixo do link de garagista:
```tsx
          <div className="mt-1">
            É comprador?{" "}
            <Link to="/cadastro" className="font-semibold text-brand hover:underline">
              Criar conta
            </Link>
          </div>
```

- [ ] **Step 5: Build**

Run: `npm run build 2>&1 | tail -3`
Expected: `✓ built`.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/features/auth/pages/CadastroComprador.tsx src/features/public/components/PublicHeader.tsx src/features/auth/pages/Login.tsx
git commit -m "$(printf 'feat(auth): cadastro de comprador, redirect por papel e header\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 8: Página "Minha conta"

**Files:**
- Create: `src/features/auth/pages/MinhaConta.tsx`
- Modify: `src/App.tsx` (rota protegida `/minha-conta`)

**Interfaces:**
- Consumes: `useAuth().buyer/isBuyer/loading/signOut/refreshSeller`, `updateBuyerProfile` (Task 3).

- [ ] **Step 1: Página**

`src/features/auth/pages/MinhaConta.tsx`:
```tsx
import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/features/auth/AuthProvider";
import { updateBuyerProfile } from "@/features/auth/buyer";
import { maskPhone } from "@/lib/masks";
import { PublicLayout } from "@/features/public/PublicLayout";
import { Alert, Button, Card, Field, Input } from "@/components/ui-light";

export function MinhaConta() {
  const { buyer, isBuyer, loading, user, signOut, refreshSeller } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (buyer) {
      setName(buyer.name ?? "");
      setPhone(buyer.phone ?? "");
      setCity(buyer.city ?? "");
    }
  }, [buyer]);

  if (loading) return <PublicLayout><div className="p-8 text-slate-400">Carregando…</div></PublicLayout>;
  if (!user) return <Navigate to="/login" replace />;
  if (!isBuyer) return <Navigate to="/app" replace />;

  async function salvar() {
    if (!buyer) return;
    setErr(null);
    setMsg(null);
    setSaving(true);
    try {
      await updateBuyerProfile(buyer.id, { name, phone, city });
      if (password) {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setPassword("");
      }
      await refreshSeller();
      setMsg("Dados atualizados.");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function sair() {
    await signOut();
    navigate("/", { replace: true });
  }

  return (
    <PublicLayout>
      <div className="mx-auto max-w-[640px] px-5 py-10">
        <h1 className="mb-6 text-2xl font-extrabold text-slate-900">Minha conta</h1>
        <Card className="flex flex-col gap-4 p-6">
          {msg && <Alert variant="success">{msg}</Alert>}
          {err && <Alert variant="error">{err}</Alert>}
          <Field label="Nome">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="E-mail">
            <Input value={buyer?.email ?? ""} disabled />
          </Field>
          <Field label="Telefone">
            <Input value={phone} inputMode="tel" onChange={(e) => setPhone(maskPhone(e.target.value))} />
          </Field>
          <Field label="Cidade">
            <Input value={city} onChange={(e) => setCity(e.target.value)} />
          </Field>
          <Field label="Nova senha (opcional)">
            <Input value={password} type="password" placeholder="Deixe em branco para manter" onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <div className="mt-2 flex justify-between">
            <Button variant="ghost" onClick={sair}>Sair</Button>
            <Button loading={saving} onClick={salvar}>Salvar</Button>
          </div>
        </Card>
      </div>
    </PublicLayout>
  );
}
```
> Nota: confirmar que `PublicLayout` aceita `children` (ver `PublicLayout.tsx`). Se a assinatura diferir, envolver com o wrapper público equivalente usado por outras páginas públicas.

- [ ] **Step 2: Rota**

Em `src/App.tsx`, import lazy:
```ts
const MinhaConta = lazy(() =>
  import("@/features/auth/pages/MinhaConta").then((m) => ({ default: m.MinhaConta }))
);
```
Rota pública (a própria página já protege via `isBuyer`):
```tsx
        <Route path="/minha-conta" element={<MinhaConta />} />
```

- [ ] **Step 3: Build**

Run: `npm run build 2>&1 | tail -3`
Expected: `✓ built`.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/features/auth/pages/MinhaConta.tsx
git commit -m "$(printf 'feat(auth): pagina Minha conta do comprador\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

# FASE 2 — Log de eventos + painéis

### Task 9: Migration `rv_click_events` + `log_click_event` (aplicar + regen)

**Files:**
- Create: `supabase/migrations/0033_click_events.sql`
- Modify: `src/lib/database.generated.ts` (regenerado)

**Interfaces:**
- Produces: tabela `rv_click_events`; função `log_click_event(text, uuid, bigint)`.

- [ ] **Step 1: Migration**

`supabase/migrations/0033_click_events.sql`:
```sql
-- ============================================================
-- 0033_click_events.sql — log de cliques off-site
-- ============================================================
create table public.rv_click_events (
  id         bigint generated always as identity primary key,
  seller_id  uuid not null references public.rv_sellers(id) on delete cascade,
  vehicle_id bigint references public.rv_vehicles(id) on delete set null,
  buyer_id   uuid references public.rv_buyers(id) on delete set null,
  kind       text not null check (kind in ('vehicle_interest','store_whatsapp','store_instagram')),
  created_at timestamptz not null default now()
);
create index idx_rv_click_events_seller  on public.rv_click_events(seller_id);
create index idx_rv_click_events_vehicle on public.rv_click_events(vehicle_id);
create index idx_rv_click_events_buyer   on public.rv_click_events(buyer_id);
create index idx_rv_click_events_created on public.rv_click_events(created_at desc);

alter table public.rv_click_events enable row level security;

-- inserção pública (anônimo ou comprador); leitura: admin ou dono da loja
create policy "rv_click_events_insert_public" on public.rv_click_events
  for insert with check (true);
create policy "rv_click_events_read_scope" on public.rv_click_events
  for select using (public.is_admin() or seller_id = public.current_loja());

-- registra um evento; usa o comprador logado quando existir
create or replace function public.log_click_event(
  p_kind       text,
  p_seller_id  uuid,
  p_vehicle_id bigint default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_buyer uuid;
begin
  if p_kind not in ('vehicle_interest','store_whatsapp','store_instagram') then
    raise exception 'kind inválido: %', p_kind;
  end if;
  select id into v_buyer from public.rv_buyers where id = auth.uid();
  insert into public.rv_click_events (seller_id, vehicle_id, buyer_id, kind)
  values (p_seller_id, p_vehicle_id, v_buyer, p_kind);
end;
$$;
revoke all on function public.log_click_event(text, uuid, bigint) from public;
grant execute on function public.log_click_event(text, uuid, bigint) to anon, authenticated;
```

- [ ] **Step 2: Aplicar no remoto**

Run: `set -a; . ./.env.local; set +a; supabase db push --db-url "$SUPABASE_DB_URL"`
Expected: aplica `0033_click_events.sql`.

- [ ] **Step 3: Regenerar tipos**

Run: `set -a; . ./.env.local; set +a; supabase gen types typescript --db-url "$SUPABASE_DB_URL" > src/lib/database.generated.ts`
Expected: contém `rv_click_events`.

- [ ] **Step 4: Verificar via REST**

Run: `set -a; . ./.env.local; set +a; curl -s -o /dev/null -w "%{http_code}\n" "${VITE_SUPABASE_URL}/rest/v1/rv_click_events?select=id&limit=1" -H "apikey: ${VITE_SUPABASE_ANON_KEY}"`
Expected: `200`.

- [ ] **Step 5: Build + Commit**

Run: `npm run build 2>&1 | tail -3` → `✓ built`
```bash
git add supabase/migrations/0033_click_events.sql src/lib/database.generated.ts
git commit -m "$(printf 'feat(db): rv_click_events + log_click_event\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 10: Captura de eventos + queries de agregação

**Files:**
- Create: `src/features/tracking/queries.ts`
- Modify: `src/features/public/pages/VehicleDetails.tsx` (disparar `vehicle_interest`)
- Modify: `src/features/public/pages/Storefront.tsx` (**gate** + disparar `store_whatsapp`/`store_instagram`)

**Interfaces:**
- Produces:
  - `useLogClickEvent(): (kind: ClickKind, sellerId: string, vehicleId?: number) => void` (`ClickKind = 'vehicle_interest' | 'store_whatsapp' | 'store_instagram'`)
  - `useClicksByVehicle(sellerId?: string): UseQueryResult<VehicleClicks[]>` onde `VehicleClicks = { vehicle_id: number; make: string; model: string; year: number | null; clicks: number }`
  - `useClickBuyers(vehicleId?: number): UseQueryResult<ClickBuyer[]>` onde `ClickBuyer = { buyer_id: string | null; name: string; phone: string | null; email: string | null; city: string | null; count: number; last_at: string }`
  - `useChannelClicks(sellerId?: string): UseQueryResult<ChannelClicks[]>` onde `ChannelClicks = { kind: 'store_whatsapp' | 'store_instagram'; total: number; buyers: ClickBuyer[] }`

- [ ] **Step 1: Criar o módulo de tracking**

`src/features/tracking/queries.ts`:
```ts
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export type ClickKind = "vehicle_interest" | "store_whatsapp" | "store_instagram";

export type VehicleClicks = {
  vehicle_id: number;
  make: string;
  model: string;
  year: number | null;
  clicks: number;
};

export type ClickBuyer = {
  buyer_id: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  count: number;
  last_at: string;
};

/** Dispara um evento de clique (best-effort; o builder do supabase-js é lazy). */
export function useLogClickEvent() {
  return (kind: ClickKind, sellerId: string, vehicleId?: number) => {
    supabase
      .rpc("log_click_event", {
        p_kind: kind,
        p_seller_id: sellerId,
        p_vehicle_id: vehicleId ?? undefined,
      })
      .then(
        () => {},
        () => {}
      );
  };
}

/** Cliques 'vehicle_interest' agregados por carro (admin filtra garagista; garagista usa o próprio). */
export function useClicksByVehicle(sellerId?: string): UseQueryResult<VehicleClicks[]> {
  return useQuery({
    queryKey: ["clicks-by-vehicle", sellerId ?? "all"],
    enabled: !!sellerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rv_click_events")
        .select("vehicle_id, vehicle:rv_vehicles(make, model, year)")
        .eq("kind", "vehicle_interest")
        .eq("seller_id", sellerId!)
        .not("vehicle_id", "is", null);
      if (error) throw error;
      const rows = (data ?? []) as unknown as {
        vehicle_id: number;
        vehicle: { make: string; model: string; year: number | null } | null;
      }[];
      const map = new Map<number, VehicleClicks>();
      for (const r of rows) {
        if (r.vehicle_id == null) continue;
        const cur = map.get(r.vehicle_id);
        if (cur) cur.clicks += 1;
        else
          map.set(r.vehicle_id, {
            vehicle_id: r.vehicle_id,
            make: r.vehicle?.make ?? "—",
            model: r.vehicle?.model ?? "",
            year: r.vehicle?.year ?? null,
            clicks: 1,
          });
      }
      return [...map.values()].sort((a, b) => b.clicks - a.clicks);
    },
  });
}

/** Compradores que clicaram num carro (agrupados; anônimos viram um grupo). */
export function useClickBuyers(vehicleId?: number): UseQueryResult<ClickBuyer[]> {
  return useQuery({
    queryKey: ["click-buyers", vehicleId ?? 0],
    enabled: !!vehicleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rv_click_events")
        .select("buyer_id, created_at, buyer:rv_buyers(name, phone, email, city)")
        .eq("kind", "vehicle_interest")
        .eq("vehicle_id", vehicleId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as unknown as {
        buyer_id: string | null;
        created_at: string;
        buyer: { name: string; phone: string | null; email: string | null; city: string | null } | null;
      }[];
      const map = new Map<string, ClickBuyer>();
      for (const r of rows) {
        const key = r.buyer_id ?? "anon";
        const cur = map.get(key);
        if (cur) {
          cur.count += 1;
          if (r.created_at > cur.last_at) cur.last_at = r.created_at;
        } else {
          map.set(key, {
            buyer_id: r.buyer_id,
            name: r.buyer?.name ?? "Visitante não identificado",
            phone: r.buyer?.phone ?? null,
            email: r.buyer?.email ?? null,
            city: r.buyer?.city ?? null,
            count: 1,
            last_at: r.created_at,
          });
        }
      }
      return [...map.values()].sort((a, b) => (a.last_at < b.last_at ? 1 : -1));
    },
  });
}

export type ChannelClicks = {
  kind: "store_whatsapp" | "store_instagram";
  total: number;
  buyers: ClickBuyer[];
};

/** Acessos a canais externos (WhatsApp/Instagram) da loja, com quem acessou. */
export function useChannelClicks(sellerId?: string): UseQueryResult<ChannelClicks[]> {
  return useQuery({
    queryKey: ["channel-clicks", sellerId ?? "all"],
    enabled: !!sellerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rv_click_events")
        .select("kind, buyer_id, created_at, buyer:rv_buyers(name, phone, email, city)")
        .in("kind", ["store_whatsapp", "store_instagram"])
        .eq("seller_id", sellerId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as unknown as {
        kind: "store_whatsapp" | "store_instagram";
        buyer_id: string | null;
        created_at: string;
        buyer: { name: string; phone: string | null; email: string | null; city: string | null } | null;
      }[];
      const channels: Record<"store_whatsapp" | "store_instagram", ChannelClicks> = {
        store_whatsapp: { kind: "store_whatsapp", total: 0, buyers: [] },
        store_instagram: { kind: "store_instagram", total: 0, buyers: [] },
      };
      const byKey: Record<string, Map<string, ClickBuyer>> = {
        store_whatsapp: new Map(),
        store_instagram: new Map(),
      };
      for (const r of rows) {
        const ch = channels[r.kind];
        ch.total += 1;
        const key = r.buyer_id ?? "anon";
        const m = byKey[r.kind];
        const cur = m.get(key);
        if (cur) {
          cur.count += 1;
          if (r.created_at > cur.last_at) cur.last_at = r.created_at;
        } else {
          m.set(key, {
            buyer_id: r.buyer_id,
            name: r.buyer?.name ?? "Visitante não identificado",
            phone: r.buyer?.phone ?? null,
            email: r.buyer?.email ?? null,
            city: r.buyer?.city ?? null,
            count: 1,
            last_at: r.created_at,
          });
        }
      }
      channels.store_whatsapp.buyers = [...byKey.store_whatsapp.values()];
      channels.store_instagram.buyers = [...byKey.store_instagram.values()];
      return [channels.store_whatsapp, channels.store_instagram];
    },
  });
}
```

- [ ] **Step 2: Disparar `vehicle_interest`**

Em `VehicleDetails.tsx` `LeadForm`, adicionar import:
```ts
import { useLogClickEvent } from "@/features/tracking/queries";
```
Dentro de `LeadForm`, junto aos hooks:
```ts
  const logClick = useLogClickEvent();
```
Em `enviar()`, após `createLead.mutate({...})` (e com `seller?.id` disponível), adicionar:
```ts
    if (seller?.id) logClick("vehicle_interest", seller.id, v.id);
```

- [ ] **Step 3: Gate + evento nos canais da mini-loja**

Em `Storefront.tsx`, os botões WhatsApp/Instagram passam a **exigir login**: se `!user`, o clique abre o `BuyerAuthModal`; após autenticar, registra o evento (com `buyer_id`) e abre o link.

Imports no topo:
```ts
import { useState } from "react";
import { useAuth } from "@/features/auth/AuthProvider";
import { BuyerAuthModal } from "@/features/auth/components/BuyerAuthModal";
import { useLogClickEvent, type ClickKind } from "@/features/tracking/queries";
```
Dentro do componente da página (onde `seller`, `wa`, `instaUrl` estão no escopo), adicionar:
```tsx
  const { user } = useAuth();
  const logClick = useLogClickEvent();
  const [pending, setPending] = useState<{ kind: ClickKind; url: string } | null>(null);

  function openChannel(kind: ClickKind, url: string) {
    logClick(kind, seller.id);
    window.open(url, "_blank", "noopener");
  }
  function handleChannel(e: React.MouseEvent, kind: ClickKind, url: string) {
    e.preventDefault();
    if (!user) {
      setPending({ kind, url });
      return;
    }
    openChannel(kind, url);
  }
```
Nos links, trocar a abertura direta por handlers (mantendo `href` para acessibilidade):
```tsx
// <a> do WhatsApp:
onClick={(e) => handleChannel(e, "store_whatsapp", wa)}
// <a> do Instagram:
onClick={(e) => handleChannel(e, "store_instagram", instaUrl)}
```
E renderizar o modal no fim do componente:
```tsx
      <BuyerAuthModal
        open={!!pending}
        onClose={() => setPending(null)}
        onAuthed={() => {
          const p = pending;
          setPending(null);
          if (p) openChannel(p.kind, p.url);
        }}
      />
```
> Nota: `wa`/`instaUrl` podem ser vazios quando o garagista não tem o canal — manter a renderização condicional já existente desses `<a>` (só gateia o que aparece).

- [ ] **Step 4: Build + Commit**

Run: `npm run build 2>&1 | tail -3` → `✓ built`
```bash
git add src/features/tracking/queries.ts src/features/public/pages/VehicleDetails.tsx src/features/public/pages/Storefront.tsx
git commit -m "$(printf 'feat(tracking): captura de eventos off-site + queries de agregacao\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 11: Drill-down no painel admin (aba Anúncios)

**Files:**
- Modify: `src/features/admin/pages/Leads.tsx`
- Possível Create: `src/features/admin/queries.ts` (hook `useGaragistas` se não existir)

**Interfaces:**
- Consumes: `useClicksByVehicle`, `useClickBuyers`, `useChannelClicks` (Task 10).

- [ ] **Step 1: Lista de garagistas para o filtro**

Verificar em `src/features/admin/queries.ts` se já existe um hook que liste garagistas (ex.: `useStores`/`useAdminSellers`). Se existir, reutilizar. Se não, adicionar:
```ts
export function useGaragistas(): UseQueryResult<{ id: string; name: string }[]> {
  return useQuery({
    queryKey: ["garagistas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rv_sellers")
        .select("id, name")
        .eq("role", "garagista")
        .order("name");
      if (error) throw error;
      return (data ?? []) as { id: string; name: string }[];
    },
  });
}
```

- [ ] **Step 2: Seção de rastreamento na página**

Em `admin/pages/Leads.tsx`, adicionar imports:
```ts
import { useState } from "react";
import { useGaragistas } from "../queries";
import { useClicksByVehicle, useClickBuyers, useChannelClicks } from "@/features/tracking/queries";
import { Card, Select, Spinner } from "@/components/ui-light";
```
Adicionar um componente de seção (no mesmo arquivo) e renderizá-lo na página. Inclui um helper de tabela de compradores (reusado pelos dois rastreamentos):
```tsx
function BuyersTable({ buyers }: { buyers: { buyer_id: string | null; name: string; phone: string | null; email: string | null; city: string | null; count: number }[] }) {
  if (buyers.length === 0) return <p className="text-sm text-slate-500">Sem registros.</p>;
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-xs uppercase text-slate-500">
        <tr><th className="py-1">Nome</th><th>Telefone</th><th>E-mail</th><th>Cidade</th><th className="text-right">Acessos</th></tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {buyers.map((b, i) => (
          <tr key={(b.buyer_id ?? "anon") + i}>
            <td className="py-1.5">{b.name}</td>
            <td>{b.phone ?? "—"}</td>
            <td>{b.email ?? "—"}</td>
            <td>{b.city ?? "—"}</td>
            <td className="text-right font-semibold">{b.count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const CHANNEL_LABEL: Record<string, string> = {
  store_whatsapp: "WhatsApp da mini-loja",
  store_instagram: "Instagram da mini-loja",
};

function CanaisExternos({ sellerId }: { sellerId: string }) {
  const channels = useChannelClicks(sellerId || undefined);
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Card className="mt-6 p-5">
      <h3 className="mb-3 text-base font-bold text-slate-900">Acessos a canais externos</h3>
      {channels.isLoading ? (
        <div className="py-6 text-center"><Spinner /></div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {(channels.data ?? []).map((c) => (
            <li key={c.kind} className="py-2">
              <button
                onClick={() => setOpen(open === c.kind ? null : c.kind)}
                className="flex w-full items-center justify-between text-left"
              >
                <span className="font-medium text-slate-800">{CHANNEL_LABEL[c.kind]}</span>
                <span className="text-sm font-semibold text-brand">{c.total} acesso(s)</span>
              </button>
              {open === c.kind && (
                <div className="mt-2 rounded-lg bg-slate-50 p-3">
                  <BuyersTable buyers={c.buyers} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function RastreamentoCliques() {
  const garagistas = useGaragistas();
  const [sellerId, setSellerId] = useState("");
  const [openVehicle, setOpenVehicle] = useState<number | null>(null);
  const cars = useClicksByVehicle(sellerId || undefined);
  const buyers = useClickBuyers(openVehicle ?? undefined);

  return (
    <>
    <Card className="mt-6 p-5">
      <h3 className="mb-3 text-base font-bold text-slate-900">Cliques por carro</h3>
      <Select value={sellerId} onChange={(e) => { setSellerId(e.target.value); setOpenVehicle(null); }}>
        <option value="">Selecione um garagista…</option>
        {(garagistas.data ?? []).map((g) => (
          <option key={g.id} value={g.id}>{g.name}</option>
        ))}
      </Select>

      {sellerId && (
        cars.isLoading ? (
          <div className="py-6 text-center"><Spinner /></div>
        ) : (cars.data ?? []).length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">Nenhum clique registrado.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {(cars.data ?? []).map((c) => (
              <li key={c.vehicle_id} className="py-2">
                <button
                  onClick={() => setOpenVehicle(openVehicle === c.vehicle_id ? null : c.vehicle_id)}
                  className="flex w-full items-center justify-between text-left"
                >
                  <span className="font-medium text-slate-800">
                    {c.make} {c.model} {c.year ? `(${c.year})` : ""}
                  </span>
                  <span className="text-sm font-semibold text-brand">{c.clicks} clique(s)</span>
                </button>
                {openVehicle === c.vehicle_id && (
                  <div className="mt-2 rounded-lg bg-slate-50 p-3">
                    {buyers.isLoading ? (
                      <Spinner />
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="text-left text-xs uppercase text-slate-500">
                          <tr><th className="py-1">Nome</th><th>Telefone</th><th>E-mail</th><th>Cidade</th><th className="text-right">Cliques</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(buyers.data ?? []).map((b, i) => (
                            <tr key={(b.buyer_id ?? "anon") + i}>
                              <td className="py-1.5">{b.name}</td>
                              <td>{b.phone ?? "—"}</td>
                              <td>{b.email ?? "—"}</td>
                              <td>{b.city ?? "—"}</td>
                              <td className="text-right font-semibold">{b.count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )
      )}
    </Card>
    {sellerId && <CanaisExternos sellerId={sellerId} />}
    </>
  );
}
```
Renderizar `<RastreamentoCliques />` ao fim do conteúdo principal da página `Leads` (após o ranking existente).

- [ ] **Step 3: Build + Commit**

Run: `npm run build 2>&1 | tail -3` → `✓ built`
```bash
git add src/features/admin/pages/Leads.tsx src/features/admin/queries.ts
git commit -m "$(printf 'feat(admin): drill-down de cliques por carro e compradores\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 12: Drill-down no painel do garagista

**Files:**
- Modify: `src/features/leads/components/LeadsView.tsx` (ou a página `/painel/leads`)

**Interfaces:**
- Consumes: `useClicksByVehicle`, `useClickBuyers`, `useChannelClicks` (Task 10); `useAuth().lojaId`.

- [ ] **Step 1: Seção de rastreamento (própria loja)**

Identificar o componente renderizado em `/painel/leads` (managers) — `LeadsView`. Adicionar uma seção análoga à do admin, porém **sem** o select de garagista, usando `lojaId` do contexto:
```tsx
import { useState } from "react";
import { useAuth } from "@/features/auth/AuthProvider";
import { useClicksByVehicle, useClickBuyers, useChannelClicks } from "@/features/tracking/queries";
import { Card, Spinner } from "@/components/ui-light";

const CHANNEL_LABEL: Record<string, string> = {
  store_whatsapp: "WhatsApp da mini-loja",
  store_instagram: "Instagram da mini-loja",
};

function MeusCanais({ sellerId }: { sellerId: string }) {
  const channels = useChannelClicks(sellerId || undefined);
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Card className="mt-6 p-5">
      <h3 className="mb-3 text-base font-bold text-slate-900">Acessos a canais externos</h3>
      {channels.isLoading ? (
        <div className="py-6 text-center"><Spinner /></div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {(channels.data ?? []).map((c) => (
            <li key={c.kind} className="py-2">
              <button onClick={() => setOpen(open === c.kind ? null : c.kind)} className="flex w-full items-center justify-between text-left">
                <span className="font-medium text-slate-800">{CHANNEL_LABEL[c.kind]}</span>
                <span className="text-sm font-semibold text-brand">{c.total} acesso(s)</span>
              </button>
              {open === c.kind && (
                <div className="mt-2 rounded-lg bg-slate-50 p-3">
                  {c.buyers.length === 0 ? (
                    <p className="text-sm text-slate-500">Sem registros.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="text-left text-xs uppercase text-slate-500">
                        <tr><th className="py-1">Nome</th><th>Telefone</th><th>E-mail</th><th>Cidade</th><th className="text-right">Acessos</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {c.buyers.map((b, i) => (
                          <tr key={(b.buyer_id ?? "anon") + i}>
                            <td className="py-1.5">{b.name}</td><td>{b.phone ?? "—"}</td><td>{b.email ?? "—"}</td><td>{b.city ?? "—"}</td><td className="text-right font-semibold">{b.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function MeusCliques() {
  const { lojaId } = useAuth();
  const [openVehicle, setOpenVehicle] = useState<number | null>(null);
  const cars = useClicksByVehicle(lojaId ?? undefined);
  const buyers = useClickBuyers(openVehicle ?? undefined);
  // mesmo render da lista/expansão da Task 11 (sem o <Select> de garagista)
  return (
    <>
    <Card className="mt-6 p-5">
      <h3 className="mb-3 text-base font-bold text-slate-900">Cliques por carro</h3>
      {cars.isLoading ? (
        <div className="py-6 text-center"><Spinner /></div>
      ) : (cars.data ?? []).length === 0 ? (
        <p className="text-sm text-slate-500">Nenhum clique registrado.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {(cars.data ?? []).map((c) => (
            <li key={c.vehicle_id} className="py-2">
              <button
                onClick={() => setOpenVehicle(openVehicle === c.vehicle_id ? null : c.vehicle_id)}
                className="flex w-full items-center justify-between text-left"
              >
                <span className="font-medium text-slate-800">{c.make} {c.model} {c.year ? `(${c.year})` : ""}</span>
                <span className="text-sm font-semibold text-brand">{c.clicks} clique(s)</span>
              </button>
              {openVehicle === c.vehicle_id && (
                <div className="mt-2 rounded-lg bg-slate-50 p-3">
                  {buyers.isLoading ? <Spinner /> : (
                    <table className="w-full text-sm">
                      <thead className="text-left text-xs uppercase text-slate-500">
                        <tr><th className="py-1">Nome</th><th>Telefone</th><th>E-mail</th><th>Cidade</th><th className="text-right">Cliques</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(buyers.data ?? []).map((b, i) => (
                          <tr key={(b.buyer_id ?? "anon") + i}>
                            <td className="py-1.5">{b.name}</td><td>{b.phone ?? "—"}</td><td>{b.email ?? "—"}</td><td>{b.city ?? "—"}</td><td className="text-right font-semibold">{b.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
    {lojaId && <MeusCanais sellerId={lojaId} />}
    </>
  );
}
```
Renderizar `<MeusCliques />` dentro de `LeadsView` (após o conteúdo de leads). Se `useAuth` já estiver importado, não duplicar o import.

- [ ] **Step 2: Build + Commit**

Run: `npm run build 2>&1 | tail -3` → `✓ built`
```bash
git add src/features/leads/components/LeadsView.tsx
git commit -m "$(printf 'feat(garagista): cliques por carro e compradores no painel\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 13: LGPD — nota na Política de Privacidade

**Files:**
- Modify: a página de política (`src/features/public/pages/PoliticaPrivacidade.tsx` ou o conteúdo em `components/legal/`)

**Interfaces:** nenhuma.

- [ ] **Step 1: Adicionar parágrafo**

Localizar o conteúdo da Política de Privacidade e adicionar uma seção curta:
> "Contas de comprador e rastreamento de interesse: ao criar uma conta e demonstrar interesse em um veículo, registramos seus dados de cadastro (nome, e-mail, telefone, cidade) e o histórico de cliques de contato, com a finalidade de intermediar o contato com a loja anunciante. Esses dados ficam disponíveis para a loja responsável pelo veículo e para o administrador da plataforma."

(Inserir respeitando a estrutura de seções existente do arquivo.)

- [ ] **Step 2: Build + Commit**

Run: `npm run build 2>&1 | tail -3` → `✓ built`
```bash
git add src/features/public/pages/PoliticaPrivacidade.tsx
git commit -m "$(printf 'docs(legal): nota LGPD sobre contas de comprador e rastreamento\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 14: Deploy

**Files:** nenhum (operacional). Migrations já aplicadas nas Tasks 1 e 9.

- [ ] **Step 1: Push**

Run: `git push origin main`

- [ ] **Step 2: Build final + deploy VPS**

```bash
npm run build
rsync -az --delete dist/ root@72.60.243.106:/var/www/revvio/
ssh root@72.60.243.106 "pm2 reload revvio"
```
Expected: `✓ built`; `[PM2] [revvio] ✓`.

- [ ] **Step 3: Smoke test em produção**

- Deslogado: navegar carros OK; clicar "Quero ver o carro" abre o modal; criar conta (e-mail+senha) → envio prossegue e abre o WhatsApp.
- Deslogado: clicar WhatsApp/Instagram na mini-loja abre o modal; após login, abre o canal e registra o acesso.
- Logado como comprador: form pré-preenchido; "Minha conta" edita perfil/senha e sai.
- Vendedor/garagista/admin logam e usam painéis normalmente.
- Admin (Anúncios): filtra garagista → (1) carros + cliques → expande → compradores; (2) acessos a WhatsApp/Instagram → expande → compradores. Garagista vê os dois rastreamentos da própria loja.

---

## Self-Review

**1. Cobertura do spec:**
- Conta de comprador (e-mail+senha, cadastro completo, sem confirmação) → Tasks 1–4, 7. ✅
- Gate no "Quero ver o carro" + WhatsApp/Instagram da mini-loja, modal inline, form pré-preenchido, lead com buyer_id → Tasks 6, 10. ✅
- "Minha conta" → Task 8. ✅
- Vendedor/admin inalterados (redirect por papel) → Tasks 4, 7. ✅
- `rv_click_events` + `log_click_event`; vehicle_interest e canais com buyer (botões gated) → Tasks 9, 10. ✅
- Painel admin — rastreamento 1 (carros→compradores) + rastreamento 2 (canais→compradores), filtro garagista → Task 11. ✅
- Painel garagista (os dois rastreamentos da própria loja) → Task 12. ✅
- LGPD → Task 13. ✅
- Build verde + migrations no remoto + deploy → todas + Tasks 1/9/14. ✅
- Fora de escopo (login social, "Meus interesses", CSV, comissão futura) → sem tasks, correto.

**2. Placeholders:** as "Notas" (ícones em icons.tsx; assinatura de PublicLayout; canais vazios na Storefront) são checagens pré-código, não placeholders; o código a escrever está completo. Sem "TBD/TODO".

**3. Consistência de tipos/nomes:**
- `signUpBuyer`/`updateBuyerProfile`/`fetchBuyer` (Task 3) consumidos em 4/5/7/8 com as mesmas assinaturas. ✅
- `buyer`/`isBuyer` (Task 4) usados em 6/7/8/10(Storefront). ✅
- `BuyerAuthModal({open,onClose,onAuthed})` (Task 5) usado nas Tasks 6 e 10 (Storefront). ✅
- `ClickKind`/`useLogClickEvent`/`useClicksByVehicle`/`useClickBuyers`/`useChannelClicks`/`ChannelClicks` (Task 10) usados em 10/11/12 com os mesmos tipos. ✅
- `useCreateLead` ganha `buyer_id` (Task 6) consumido no mesmo lugar. ✅
