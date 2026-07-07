# Fase E — Gestor: troca de contexto + ajustes de rótulo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar ao gestor (admin) um seletor "Plataforma ↔ Minha loja" presente nos dois painéis, que alterna entre `/dashboard` e `/painel` sem segunda conta nem relogin, e corrigir os rótulos públicos que ainda dizem "vendedor" onde o papel é **garagista**.

**Architecture:** Os dois layouts (`AdminLayout` e `PainelLayout`) já renderizam a mesma casca `PanelShell`. Adicionamos um componente `ContextSwitcher` único dentro do `PanelShell`, que se auto-esconde para não-admin (`return null`) e usa `useLocation()` para destacar o contexto ativo — assim o seletor aparece igual nos dois painéis sem duplicar código e sem tocar a UI do admin para quem não é gestor. O `RoleRoute` já libera o admin em `/painel` (`if (isAdmin) return children`), então **não há mudança de guard nem de rota**.

**Tech Stack:** React 18 · TypeScript · React Router · TanStack Query · Supabase JS.

## Global Constraints

- Build verde obrigatório por task: `npx tsc -b` (exit 0) e `npm run build` (exit 0).
- **Preservar a UI do `/dashboard` (admin) e do `/painel`** — a adição do seletor é **não-intrusiva**; para não-admin o `ContextSwitcher` não renderiza nada (sem espaço vazio, sem mudança visual).
- Sem mudança de banco/RLS nesta fase (sem migração; sem rodar teste de RLS).
- `useAuth()` expõe `isAdmin`, `isGaragista`, `isVendedor`, `seller`, `lojaId`, `personId`.
- Não renomear arquivos/rotas/componentes (`/cadastro-vendedor`, `CadastroVendedor`) — só **copy visível ao usuário**. Renomear rota/arquivo é risco fora de escopo (seção 8 do design).
- Ícones disponíveis (subconjunto em `src/features/public/components/icons.tsx`): incluir apenas nomes existentes — usaremos `shield`, `store`, `grid`, `car`, `users`, `dollar`, `wallet`, `layers`.

---

### Task E1: ContextSwitcher do gestor (Plataforma ↔ Minha loja)

**Files:**
- Create: `src/features/auth/ContextSwitcher.tsx`
- Modify: `src/components/PanelShell.tsx`

**Interfaces:**
- Consumes: `useAuth().isAdmin`; `useNavigate`, `useLocation` (react-router-dom); `Icon` de `@/features/public/components/icons`.
- Produces: componente `ContextSwitcher` (export nomeado, sem props). Renderizado no topo da sidebar do `PanelShell`, entre a linha do logo e o badge. Retorna `null` para quem não é admin.

- [ ] **Step 1: Criar o componente `ContextSwitcher`**

Criar `src/features/auth/ContextSwitcher.tsx`:

```tsx
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthProvider";
import { Icon } from "@/features/public/components/icons";

/**
 * Seletor "Plataforma ↔ Minha loja" do gestor (admin). Aparece igual nos dois
 * painéis (Admin e Garagista) e alterna entre /dashboard e /painel sem relogin.
 * Para quem não é admin não renderiza nada (não muda a UI do painel).
 */
export function ContextSwitcher() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  if (!isAdmin) return null;

  const onLoja = pathname.startsWith("/painel");
  const items = [
    { label: "Plataforma", icon: "shield", to: "/dashboard", active: !onLoja },
    { label: "Minha loja", icon: "store", to: "/painel", active: onLoja },
  ];

  return (
    <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-white/[0.06] p-1">
      {items.map((it) => (
        <button
          key={it.to}
          type="button"
          onClick={() => navigate(it.to)}
          aria-pressed={it.active}
          className={[
            "flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[11px] font-bold transition-all",
            it.active
              ? "bg-brand text-white shadow-[0_4px_12px_rgba(16,185,129,.3)]"
              : "text-slate-400 hover:bg-white/5 hover:text-slate-200",
          ].join(" ")}
        >
          <Icon name={it.icon} size={15} /> {it.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Renderizar o seletor no `PanelShell`**

Em `src/components/PanelShell.tsx`:

(a) adicionar o import (junto aos outros imports do topo):

```tsx
import { ContextSwitcher } from "@/features/auth/ContextSwitcher";
```

(b) inserir `<ContextSwitcher />` logo após a `<div>` do logo/bell e **antes** do `<span>` do badge. O bloco passa a ficar assim:

```tsx
        <div className="flex items-center justify-between px-1.5 pb-1.5">
          <BrandLogo height={24} theme="light" />
          <NotificationsBell />
        </div>

        <ContextSwitcher />

        <span className="my-[18px] mt-1 self-start rounded-md bg-brand/[0.12] px-2 py-[3px] text-[10px] font-extrabold uppercase tracking-[1.5px] text-brand">
          {badge}
        </span>
```

(Para não-admin, `ContextSwitcher` retorna `null` → nenhum nó é inserido e o espaçamento atual fica idêntico.)

- [ ] **Step 3: Verificar build verde**

Run: `npx tsc -b && npm run build`
Expected: ambos exit 0.

- [ ] **Step 4: Smoke manual (descrever no commit, sem bloquear)**

Verificação esperada ao rodar `npm run dev`:
- Login como **admin** → `/dashboard`: aparece o seletor com "Plataforma" ativo; clicar "Minha loja" navega para `/painel` (badge "Garagista", nav com Equipe/Perfil) sem recarregar/relogar; clicar "Plataforma" volta para `/dashboard`.
- Login como **garagista** ou **vendedor** → `/painel`: o seletor **não** aparece (UI idêntica à atual).

- [ ] **Step 5: Commit**

```bash
git add src/features/auth/ContextSwitcher.tsx src/components/PanelShell.tsx
git commit -m "feat(gestor): seletor Plataforma <-> Minha loja nos dois paineis (sem relogin)"
```

---

### Task E2: Ajuste de rótulos públicos (garagista, não "vendedor")

**Files:**
- Modify: `src/features/auth/pages/CadastroVendedor.tsx:107`
- Modify: `src/features/auth/pages/Login.tsx:211`

**Interfaces:**
- Consumes: nada novo (só troca de copy estática).
- Produces: a tela de cadastro e o link do login passam a falar "Garagista" (a identidade pública é a loja; "vendedor" no público confundia com o papel interno). Rota `/cadastro-vendedor` e nomes de componente/arquivo permanecem.

- [ ] **Step 1: Título da tela de cadastro → "Garagista"**

Em `src/features/auth/pages/CadastroVendedor.tsx`, no `<AuthLayout>` (linha ~107), trocar o `title`:

```tsx
      title="Cadastro de Garagista"
```

(Manter o `subtitle` atual — já fala em "mini-loja" e aprovação do administrador, que é correto para o garagista.)

- [ ] **Step 2: Link do login → "garagista"**

Em `src/features/auth/pages/Login.tsx` (linha ~211), trocar o texto do `<Link to="/cadastro-vendedor">`:

```tsx
            <Link to="/cadastro-vendedor" className="font-semibold text-brand hover:underline">
              Cadastre-se como garagista
            </Link>
```

- [ ] **Step 3: Verificar build verde**

Run: `npx tsc -b && npm run build`
Expected: ambos exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/features/auth/pages/CadastroVendedor.tsx src/features/auth/pages/Login.tsx
git commit -m "feat(publico): rotulos de cadastro usam 'garagista' (identidade publica e a loja)"
```

---

## Self-Review (preenchido)

**Spec coverage (Seção 4 "Troca de contexto do gestor" + Seção 6 "Fase E — Gestor"):**
- Seletor "Plataforma ↔ Minha loja" nos dois layouts, leva entre `/dashboard` e `/painel`, sem segunda conta/relogin → E1 (componente único no `PanelShell` compartilhado; navegação client-side) ✓
- Admin acessa `/painel` (modo loja) → já garantido pelo `RoleRoute` (`if (isAdmin) return children`); confirmado no smoke do E1, sem mudança de guard ✓
- "Ajustes de rótulo (garagista vs vendedor)" (Seção 6) + "CadastroVendedor → rótulos 'Cadastro de Garagista'" (Seção 5 público) → E2 ✓
- Restrição do cliente (Seção 5): UI do `/dashboard` mantida; adição não-intrusiva → `ContextSwitcher` retorna `null` para não-admin; para o admin é um bloco novo, sem redesenho do painel ✓

**Placeholder scan:** sem TBD/TODO. Todo passo traz o código/edição exata e o comando de verificação.

**Type consistency:** `ContextSwitcher` é export nomeado sem props, importado por nome em `PanelShell`. `Icon` recebe `name: string` (assinatura existente) e os nomes usados (`shield`, `store`) existem no `PATHS`. `useAuth().isAdmin` é `boolean` já exposto pelo `AuthProvider`. `pathname.startsWith("/painel")` cobre `/painel` e subrotas.

**Nota de ambiente:** verificação por `tsc -b` + `npm run build` (sem runner unitário, igual às Fases C/D) + smoke manual descrito. Sem mudança de banco → sem teste de RLS nesta fase.

**Fora de escopo (confirma seção 8):** renomear rota/arquivo `/cadastro-vendedor`; mini-loja por vendedor; persistir o contexto escolhido (a navegação por rota já é a fonte da verdade).
