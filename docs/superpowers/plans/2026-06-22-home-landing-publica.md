# Nova Home (landing pública) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar a home `/` numa landing/portal de seções (faixa de contato → header claro → banner + busca rápida → planos → marcas → quem somos → footer), mover a grade de veículos para `/comprar` (lendo filtros da URL) e mostrar o badge da loja em cada card (#7).

**Architecture:** Nova casca pública compartilhada (`PublicShell` = header claro + footer) aplicada à landing e ao `/comprar`. A landing (`Home.tsx`) compõe seções isoladas em `src/features/public/components/home/`. O `Marketplace.tsx` atual vira `/comprar` e passa a inicializar os filtros a partir de `useSearchParams`. A Busca Rápida e os logos de marca navegam para `/comprar?q=...`.

**Tech Stack:** React 18 · TypeScript · React Router v6 (`useSearchParams`) · TanStack Query · Tailwind · Supabase JS.

## Global Constraints

- Build verde por task: `npx tsc -b` (exit 0) e `npm run build` (exit 0). Sem runner unitário (padrão das fases anteriores).
- **Validação de dados é contra o Supabase REMOTO** do projeto (`.env.local` aponta para ele; já migrado para o schema novo). Há 9 veículos `available` públicos.
- **Identidade do Revvio:** cor de destaque **emerald/brand** (`#10b981`); usar `@/components/ui-light` e os componentes existentes. Layout espelha a referência, mas em verde (não laranja).
- **Header claro** seguindo a referência: faixa de contato escura no topo + header branco com logo + nav. **Preservar Comprar/Vender** e os botões de auth (mesma lógica do `PublicTopBar` atual).
- **Contato = placeholder** (e-mail `contato@revvio.com.br`, WhatsApp `(00) 00000-0000`, redes `#`), fácil de trocar num só lugar.
- **Banner e imagem "Quem Somos" = placeholders versionados** (SVG em `public/home/`).
- **Anunciar = planos do `rv_pricing_plans`** via `usePricingPlans()` (já existe).
- **#7:** badge da loja ("Vendido por: <nome>") nos cards de `/comprar`. Como o card é um `<Link>`, o badge é **texto** (sem link aninhado); o link para a mini-loja já existe na página do veículo.
- **Fora de escopo:** páginas Notícias/Contato/Revendas, carrossel de banner, seção "Nossas Lojas".

---

### Task 1: Rota `/comprar` + Marketplace lê filtros da URL

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/features/public/pages/Marketplace.tsx`

**Interfaces:**
- Consumes: `usePublicVehicles()` (já existe; retorna `PublicVehicle[]` com `seller`).
- Produces: rota `/comprar` renderiza o `Marketplace`; o componente inicializa `q` e `brand` a partir de `?q=` e `?marca=` da URL. `/` continua no `Marketplace` por enquanto (trocado para `Home` na Task 4).

- [ ] **Step 1: Adicionar a rota `/comprar` no App.tsx**

Em `src/App.tsx`, logo após a rota pública `<Route path="/" element={<Marketplace />} />` (por volta da linha 105), adicionar:

```tsx
        <Route path="/comprar" element={<Marketplace />} />
```

- [ ] **Step 2: Marketplace inicializa filtros a partir da URL**

Em `src/features/public/pages/Marketplace.tsx`:

(a) no topo do arquivo, adicionar ao import do react-router-dom (criar a linha se não existir):

```tsx
import { useSearchParams } from "react-router-dom";
```

(b) dentro de `export function Marketplace()`, trocar as duas linhas de estado iniciais de `q` e `brand` (hoje `useState("")` e `useState("all")`) por inicialização a partir da URL:

```tsx
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [brand, setBrand] = useState(params.get("marca") ?? "all");
```

(Os demais estados de filtro permanecem como estão. `brand` só casa se `marca` for exatamente um `make` existente; por isso a Busca Rápida e os logos de marca usam `?q=` — ver Task 4/6 — que é a busca textual tolerante.)

- [ ] **Step 3: Verificar build verde**

Run: `npx tsc -b && npm run build`
Expected: ambos exit 0.

- [ ] **Step 4: Smoke (descrever no commit)**

Com `npm run dev`: acessar `/comprar` mostra a mesma grade de hoje (9 veículos do remoto); `/comprar?q=nissan` já abre filtrado pelo termo.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/features/public/pages/Marketplace.tsx
git commit -m "feat(home): rota /comprar + marketplace le filtros (?q,?marca) da URL"
```

---

### Task 2: Badge da loja nos cards + remover VehicleCard órfão (#7)

**Files:**
- Modify: `src/features/public/components/MarketplaceCard.tsx`
- Delete: `src/features/public/components/VehicleCard.tsx`

**Interfaces:**
- Consumes: `PublicVehicle` (de `../queries`) — `Vehicle & { seller: PublicSeller | null }`.
- Produces: `MarketplaceCard` passa a receber `vehicle: PublicVehicle` e exibe "Vendido por: <seller.name>" quando houver seller.

- [ ] **Step 1: Confirmar que o VehicleCard está órfão**

Run: `grep -rn "VehicleCard" src/ | grep -v "components/VehicleCard.tsx"`
Expected: nenhuma linha (não é importado por ninguém). Se houver, NÃO apagar — reportar.

- [ ] **Step 2: Adicionar o badge da loja no MarketplaceCard**

Em `src/features/public/components/MarketplaceCard.tsx`:

(a) trocar o import de tipo e a assinatura. Trocar:

```tsx
import type { Vehicle } from "@/lib/database.types";
```
por:
```tsx
import type { PublicVehicle } from "../queries";
```
e trocar `export function MarketplaceCard({ vehicle }: { vehicle: Vehicle }) {` por:
```tsx
export function MarketplaceCard({ vehicle }: { vehicle: PublicVehicle }) {
```

(b) imediatamente antes do fechamento do bloco de conteúdo (logo após o `<p>` do preço, antes de `</div>` que fecha `px-4 pb-4 pt-3.5`), inserir o badge:

```tsx
        {vehicle.seller && (
          <div className="mt-3 flex items-center gap-2 border-t border-hair pt-2.5">
            {vehicle.seller.avatar_url ? (
              <img
                src={vehicle.seller.avatar_url}
                alt=""
                className="h-5 w-5 rounded-full object-cover"
              />
            ) : (
              <span className="grid h-5 w-5 place-items-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-400">
                {vehicle.seller.name.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="truncate text-[12px] text-slate-500">
              Vendido por <span className="font-semibold text-slate-700">{vehicle.seller.name}</span>
            </span>
          </div>
        )}
```

- [ ] **Step 3: Remover o VehicleCard órfão**

Run: `git rm src/features/public/components/VehicleCard.tsx`

- [ ] **Step 4: Verificar build verde**

Run: `npx tsc -b && npm run build`
Expected: ambos exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/features/public/components/MarketplaceCard.tsx
git commit -m "feat(comprar): badge da loja no card + remove VehicleCard orfao (#7)"
```

---

### Task 3: Casca pública clara — PublicShell + PublicHeader + PublicFooter

**Files:**
- Create: `src/features/public/components/PublicHeader.tsx`
- Create: `src/features/public/components/PublicFooter.tsx`
- Create: `src/features/public/PublicShell.tsx`
- Modify: `src/features/public/pages/Marketplace.tsx`

**Interfaces:**
- Consumes: `useAuth()` (`user`, `isAdmin`, `seller`, `signOut`), `BrandLogo`, `Icon`.
- Produces: `PublicShell({ current?: "home" | "comprar" | "vender", children })` que renderiza header claro + `children` + footer. `PublicHeader({ current })`, `PublicFooter()`.

- [ ] **Step 1: Criar o PublicHeader (faixa de contato + header branco)**

Criar `src/features/public/components/PublicHeader.tsx`:

```tsx
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthProvider";
import { BrandLogo } from "./BrandLogo";
import { Icon } from "./icons";

const NAV = [
  { to: "/comprar", label: "Comprar", key: "comprar" as const },
  { to: "/vender", label: "Vender", key: "vender" as const },
];

export function PublicHeader({
  current = "home",
}: {
  current?: "home" | "comprar" | "vender";
}) {
  const { user, isAdmin, seller, signOut } = useAuth();
  const navigate = useNavigate();
  const painelHref = isAdmin ? "/dashboard" : seller ? "/painel" : "/app";

  async function handleSignOut() {
    await signOut();
    navigate("/login", { replace: true });
  }

  return (
    <header className="sticky top-0 z-40">
      {/* faixa de contato (placeholders) */}
      <div className="bg-ink text-slate-300">
        <div className="mx-auto flex h-9 max-w-[1280px] items-center gap-6 px-5 text-[12.5px] sm:px-7">
          <span className="inline-flex items-center gap-1.5">
            <Icon name="mail" size={14} /> contato@revvio.com.br
          </span>
          <span className="hidden items-center gap-1.5 sm:inline-flex">
            <Icon name="whatsapp" size={14} /> (00) 00000-0000
          </span>
        </div>
        <div className="h-[2px] w-full bg-brand" />
      </div>

      {/* header branco */}
      <div className="border-b border-hair bg-white">
        <div className="mx-auto flex h-[68px] max-w-[1280px] items-center justify-between px-5 sm:px-7">
          <Link to="/" className="flex items-center">
            <BrandLogo height={26} theme="dark" />
          </Link>
          <nav className="hidden items-center gap-7 sm:flex">
            {NAV.map((n) => (
              <Link
                key={n.key}
                to={n.to}
                className={
                  current === n.key
                    ? "text-sm font-bold text-slate-900"
                    : "text-sm font-semibold text-slate-500 hover:text-slate-900"
                }
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <Link
                  to={painelHref}
                  className="inline-flex items-center gap-2 rounded-lg border border-hair px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Icon name="grid" size={15} /> Painel
                </Link>
                <button
                  onClick={handleSignOut}
                  className="rounded-lg bg-red-500 px-4 py-2 text-sm font-bold text-white hover:bg-red-600"
                >
                  Sair
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/cadastro-vendedor"
                  className="hidden rounded-lg border border-brand px-4 py-2 text-sm font-bold text-brand hover:bg-brand/5 sm:block"
                >
                  Área do anunciante
                </Link>
                <Link
                  to="/login"
                  className="rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white hover:bg-brand-dark"
                >
                  Entrar
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Criar o PublicFooter**

Criar `src/features/public/components/PublicFooter.tsx`:

```tsx
import { Link } from "react-router-dom";
import { BrandLogo } from "./BrandLogo";
import { Icon } from "./icons";

const COLS: { title: string; links: { label: string; to: string; ext?: boolean }[] }[] = [
  {
    title: "Menu",
    links: [
      { label: "Comprar", to: "/comprar" },
      { label: "Vender", to: "/vender" },
      { label: "Entrar", to: "/login" },
    ],
  },
  {
    title: "Anunciante",
    links: [
      { label: "Cadastrar minha loja", to: "/cadastro-vendedor" },
      { label: "Planos", to: "/vender" },
      { label: "Área do anunciante", to: "/login" },
    ],
  },
  {
    title: "Links úteis",
    links: [
      { label: "Tabela FIPE", to: "https://veiculos.fipe.org.br", ext: true },
      { label: "DETRAN", to: "https://www.gov.br/pt-br/servicos-estaduais", ext: true },
      { label: "CNH Digital", to: "https://www.gov.br/pt-br/temas/carteira-de-motorista", ext: true },
    ],
  },
];

export function PublicFooter() {
  return (
    <footer className="border-t border-hair bg-cloud">
      <div className="mx-auto grid max-w-[1280px] gap-10 px-5 py-12 sm:px-7 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <BrandLogo height={26} theme="dark" />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-500">
            Portal de compra e venda de veículos com procedência e contato direto com a loja.
          </p>
          <p className="mt-4 inline-flex items-center gap-2 text-sm text-slate-500">
            <Icon name="mail" size={15} /> contato@revvio.com.br
          </p>
          <p className="mt-1.5 inline-flex items-center gap-2 text-sm text-slate-500">
            <Icon name="whatsapp" size={15} /> (00) 00000-0000
          </p>
          <div className="mt-4 flex gap-2.5">
            <a href="#" aria-label="Instagram" className="grid h-9 w-9 place-items-center rounded-full bg-white text-slate-500 hover:text-brand">
              <Icon name="instagram" size={17} />
            </a>
          </div>
        </div>
        {COLS.map((col) => (
          <div key={col.title}>
            <h4 className="text-[11.5px] font-bold uppercase tracking-wider text-slate-400">
              {col.title}
            </h4>
            <ul className="mt-4 flex flex-col gap-2.5">
              {col.links.map((l) => (
                <li key={l.label}>
                  {l.ext ? (
                    <a href={l.to} target="_blank" rel="noreferrer" className="text-sm text-slate-600 hover:text-brand">
                      {l.label}
                    </a>
                  ) : (
                    <Link to={l.to} className="text-sm text-slate-600 hover:text-brand">
                      {l.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-hair">
        <div className="mx-auto max-w-[1280px] px-5 py-5 text-center text-xs text-slate-400 sm:px-7">
          © 2026 REVVIO — Todos os direitos reservados.
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 3: Criar o PublicShell**

Criar `src/features/public/PublicShell.tsx`:

```tsx
import type { ReactNode } from "react";
import { PublicHeader } from "./components/PublicHeader";
import { PublicFooter } from "./components/PublicFooter";

export function PublicShell({
  current = "home",
  children,
}: {
  current?: "home" | "comprar" | "vender";
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-white font-sans">
      <PublicHeader current={current} />
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  );
}
```

- [ ] **Step 4: Aplicar a casca ao Marketplace (/comprar)**

Em `src/features/public/pages/Marketplace.tsx`:

(a) adicionar o import:
```tsx
import { PublicShell } from "../PublicShell";
```

(b) remover o `import { PublicTopBar } ...` (não será mais usado aqui) e, no JSX, trocar o wrapper externo. Hoje o retorno começa com:
```tsx
  return (
    <div className="min-h-screen bg-white font-sans">
      <PublicTopBar current="comprar" />
```
Trocar por:
```tsx
  return (
    <PublicShell current="comprar">
```
e o `</div>` que fechava aquele wrapper externo (o último antes de `);` no fim do componente) passa a ser `</PublicShell>`. O `<footer>` próprio do Marketplace (se houver no fim) deve ser removido, pois o footer agora vem do `PublicShell`.

(Se o Marketplace tiver um `<footer>...REVVIO · Marketplace...</footer>` no fim, removê-lo.)

- [ ] **Step 5: Verificar build verde**

Run: `npx tsc -b && npm run build`
Expected: ambos exit 0. Conferir que `grep -rn "PublicTopBar" src/features/public/pages/Marketplace.tsx` não retorna nada.

- [ ] **Step 6: Commit**

```bash
git add src/features/public/components/PublicHeader.tsx src/features/public/components/PublicFooter.tsx src/features/public/PublicShell.tsx src/features/public/pages/Marketplace.tsx
git commit -m "feat(home): casca publica clara (header faixa-contato + footer) no /comprar"
```

---

### Task 4: Home + HomeHero (banner + Busca Rápida) e rota `/` → Home

**Files:**
- Create: `public/home/banner-placeholder.svg`
- Create: `src/features/public/components/home/HomeHero.tsx`
- Create: `src/features/public/pages/Home.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `PublicShell`, `useNavigate`.
- Produces: `Home` (default export nomeado `Home`) renderizado em `/`; `HomeHero` com Busca Rápida que navega para `/comprar?q=<termo>`.

- [ ] **Step 1: Criar o placeholder do banner (SVG versionado)**

Criar `public/home/banner-placeholder.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="420" viewBox="0 0 1280 420">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0c1322"/>
      <stop offset="1" stop-color="#08090c"/>
    </linearGradient>
  </defs>
  <rect width="1280" height="420" fill="url(#g)"/>
  <circle cx="980" cy="80" r="320" fill="#10b981" opacity="0.16"/>
  <text x="64" y="210" fill="#ffffff" font-family="sans-serif" font-size="48" font-weight="800">REVVIO</text>
  <text x="64" y="262" fill="#9aa3af" font-family="sans-serif" font-size="22">Banner — substitua por sua imagem em public/home/</text>
</svg>
```

- [ ] **Step 2: Criar o HomeHero (banner + Busca Rápida)**

Criar `src/features/public/components/home/HomeHero.tsx`:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../icons";

const POPULAR = ["Volkswagen", "Chevrolet", "Fiat", "Toyota", "Honda", "Motos"];

export function HomeHero() {
  const navigate = useNavigate();
  const [cat, setCat] = useState("Carros");
  const [term, setTerm] = useState("");

  function buscar() {
    const t = term.trim();
    navigate(t ? `/comprar?q=${encodeURIComponent(t)}` : "/comprar");
  }

  return (
    <section>
      {/* banner placeholder */}
      <div className="relative">
        <img
          src="/home/banner-placeholder.svg"
          alt="Banner REVVIO"
          className="h-[300px] w-full object-cover sm:h-[380px]"
        />
      </div>

      {/* Busca Rápida */}
      <div className="mx-auto -mt-10 max-w-[1100px] px-5 sm:px-7">
        <div className="rounded-2xl border border-hair bg-white p-6 shadow-[0_20px_50px_rgba(16,24,40,.10)]">
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-900">
            <Icon name="search" size={20} className="text-brand" /> Busca Rápida
          </h2>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <select
              value={cat}
              onChange={(e) => setCat(e.target.value)}
              className="rounded-xl border border-hair bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 sm:w-44"
            >
              <option>Carros</option>
              <option>Motos</option>
              <option>Caminhões</option>
            </select>
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-hair bg-slate-50 px-4">
              <Icon name="search" size={18} className="text-slate-400" />
              <input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && buscar()}
                placeholder="Digite a marca ou modelo…"
                className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-slate-400"
              />
            </div>
            <button
              onClick={buscar}
              className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white hover:bg-brand-dark"
            >
              Buscar
            </button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-[12px] font-bold uppercase tracking-wider text-slate-400">
              Popular:
            </span>
            {POPULAR.map((p) => (
              <button
                key={p}
                onClick={() => navigate(`/comprar?q=${encodeURIComponent(p)}`)}
                className="rounded-full border border-hair px-3 py-1.5 text-[13px] font-semibold text-slate-600 hover:border-brand hover:text-brand"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
```

> Nota: o seletor de categoria (Carros/Motos/Caminhões) é visual — o esquema atual não tem campo de categoria de veículo, então a busca usa o termo (`?q=`). Fica como gancho para um filtro futuro.

- [ ] **Step 3: Criar a página Home**

Criar `src/features/public/pages/Home.tsx`:

```tsx
import { PublicShell } from "../PublicShell";
import { HomeHero } from "../components/home/HomeHero";

export function Home() {
  return (
    <PublicShell current="home">
      <HomeHero />
      <div className="h-16" />
    </PublicShell>
  );
}
```

- [ ] **Step 4: Rotear `/` → Home**

Em `src/App.tsx`:

(a) adicionar o lazy import junto aos outros (perto do import do Marketplace):
```tsx
const Home = lazy(() =>
  import("@/features/public/pages/Home").then((m) => ({ default: m.Home }))
);
```

(b) trocar a rota raiz `<Route path="/" element={<Marketplace />} />` por:
```tsx
        <Route path="/" element={<Home />} />
```

- [ ] **Step 5: Verificar build verde**

Run: `npx tsc -b && npm run build`
Expected: ambos exit 0.

- [ ] **Step 6: Smoke**

`npm run dev`: `/` mostra header claro + banner + Busca Rápida + footer; digitar "nissan" e Buscar leva a `/comprar?q=nissan` com a grade filtrada; `/comprar` segue mostrando os 9 veículos.

- [ ] **Step 7: Commit**

```bash
git add public/home/banner-placeholder.svg src/features/public/components/home/HomeHero.tsx src/features/public/pages/Home.tsx src/App.tsx
git commit -m "feat(home): landing em / com banner placeholder + Busca Rapida -> /comprar"
```

---

### Task 5: Seção Anunciar (planos do rv_pricing_plans)

**Files:**
- Create: `src/features/public/components/home/HomePlanCard.tsx`
- Create: `src/features/public/components/home/HomeAnunciar.tsx`
- Modify: `src/features/public/pages/Home.tsx`

**Interfaces:**
- Consumes: `usePricingPlans()` → `PricingPlan[]` (`{ key, name, tagline, price_monthly, color, popular, cta_label, highlights }`).
- Produces: `HomeAnunciar` (seção completa) e `HomePlanCard` (card de plano com CTA → `/cadastro-vendedor`).

- [ ] **Step 1: Criar o HomePlanCard**

Criar `src/features/public/components/home/HomePlanCard.tsx`:

```tsx
import { Link } from "react-router-dom";
import type { PricingPlan } from "../../queries";
import { Icon } from "../icons";

export function HomePlanCard({ p }: { p: PricingPlan }) {
  return (
    <div
      className="relative flex flex-col rounded-[18px] bg-white px-7 py-7"
      style={{
        border: p.popular ? "2px solid #10b981" : "1px solid #e7e9ee",
        boxShadow: p.popular
          ? "0 20px 50px rgba(16,185,129,.16)"
          : "0 2px 8px rgba(16,24,40,.05)",
      }}
    >
      {p.popular && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand px-3.5 py-[5px] text-[11.5px] font-extrabold tracking-wide text-white">
          MAIS ESCOLHIDO
        </span>
      )}
      <div className="text-[17px] font-extrabold" style={{ color: p.color }}>
        {p.name}
      </div>
      <div className="mt-1 min-h-[38px] text-[13.5px] text-slate-400">{p.tagline}</div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-base font-bold text-slate-950">R$</span>
        <span className="text-[40px] font-extrabold leading-none tracking-[-2px] text-slate-950">
          {p.price_monthly}
        </span>
        <span className="text-sm text-slate-400">/mês</span>
      </div>
      <ul className="mt-5 flex flex-1 flex-col gap-2.5">
        {p.highlights.map((h) => (
          <li key={h} className="flex items-start gap-2 text-[13.5px] text-slate-600">
            <Icon name="check" size={16} className="mt-0.5 shrink-0 text-brand" /> {h}
          </li>
        ))}
      </ul>
      <Link
        to="/cadastro-vendedor"
        className="mt-6 flex items-center justify-center gap-2 rounded-[11px] py-[13px] text-[14.5px] font-bold text-white"
        style={{ background: p.popular ? "#10b981" : p.color }}
      >
        {p.cta_label}
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Criar o HomeAnunciar**

Criar `src/features/public/components/home/HomeAnunciar.tsx`:

```tsx
import { usePricingPlans } from "../../queries";
import { HomePlanCard } from "./HomePlanCard";
import { Spinner } from "@/components/ui-light";

export function HomeAnunciar() {
  const { data: plans = [], isLoading } = usePricingPlans();

  return (
    <section className="bg-cloud py-16">
      <div className="mx-auto max-w-[1100px] px-5 text-center sm:px-7">
        <span className="inline-block rounded-full bg-brand/10 px-3.5 py-1.5 text-[11.5px] font-bold uppercase tracking-wider text-brand">
          Por que anunciar no Revvio?
        </span>
        <h2 className="mt-4 font-display text-[clamp(26px,3.5vw,38px)] font-extrabold tracking-tight text-slate-900">
          A plataforma certa para sua loja <span className="text-brand">vender mais</span>
        </h2>
        <p className="mt-2 text-slate-500">
          Escolha um plano e ganhe vitrine digital, equipe de vendedores e painel de gestão.
        </p>

        {isLoading ? (
          <div className="flex justify-center py-12 text-slate-400">
            <Spinner />
          </div>
        ) : plans.length === 0 ? (
          <p className="py-12 text-slate-400">Nenhum plano disponível no momento.</p>
        ) : (
          <div className="mt-10 grid gap-6 text-left md:grid-cols-2 lg:grid-cols-3">
            {plans.map((p) => (
              <HomePlanCard key={p.key} p={p} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Adicionar a seção à Home**

Em `src/features/public/pages/Home.tsx`, importar e inserir após o `HomeHero` (removendo o `<div className="h-16" />` placeholder):

```tsx
import { HomeAnunciar } from "../components/home/HomeAnunciar";
```
e no JSX:
```tsx
      <HomeHero />
      <HomeAnunciar />
```

- [ ] **Step 4: Verificar build verde**

Run: `npx tsc -b && npm run build`
Expected: ambos exit 0.

- [ ] **Step 5: Smoke**

`/` mostra a seção Anunciar com os planos reais do remoto (3 planos cadastrados em `rv_pricing_plans`); botão do card → `/cadastro-vendedor`.

- [ ] **Step 6: Commit**

```bash
git add src/features/public/components/home/HomePlanCard.tsx src/features/public/components/home/HomeAnunciar.tsx src/features/public/pages/Home.tsx
git commit -m "feat(home): secao Anunciar com planos do rv_pricing_plans"
```

---

### Task 6: Seção Marcas Mais Buscadas (logos carros/motos)

**Files:**
- Create: `src/features/public/components/home/HomeMarcas.tsx`
- Modify: `src/features/public/pages/Home.tsx`

**Interfaces:**
- Consumes: assets em `public/marcas/carros/*.png` e `public/marcas/motos/*.png` (já existem); `useNavigate`.
- Produces: `HomeMarcas` — dois grupos (Carros, Motos) com logos linkando para `/comprar?q=<marca>`.

- [ ] **Step 1: Criar o HomeMarcas**

Criar `src/features/public/components/home/HomeMarcas.tsx` (os nomes de arquivo são os reais em `public/marcas/`):

```tsx
import { Link } from "react-router-dom";
import { Icon } from "../icons";

type Marca = { nome: string; arquivo: string };

const CARROS: Marca[] = [
  { nome: "Chevrolet", arquivo: "chevrolet.png" },
  { nome: "Fiat", arquivo: "fiat.png" },
  { nome: "Volkswagen", arquivo: "volkswagem.png" },
  { nome: "Toyota", arquivo: "toyota.png" },
  { nome: "Honda", arquivo: "honda.png" },
  { nome: "Hyundai", arquivo: "hyundai.png" },
];

const MOTOS: Marca[] = [
  { nome: "Honda", arquivo: "honda.png" },
  { nome: "Yamaha", arquivo: "yamaha.png" },
  { nome: "Dafra", arquivo: "dafra.png" },
  { nome: "Suzuki", arquivo: "suzuki.png" },
  { nome: "Kawasaki", arquivo: "kawasaki.png" },
  { nome: "BMW Motorrad", arquivo: "bmwmotor.png" },
];

function Grupo({
  titulo,
  icone,
  pasta,
  marcas,
}: {
  titulo: string;
  icone: string;
  pasta: "carros" | "motos";
  marcas: Marca[];
}) {
  return (
    <div className="rounded-2xl border border-hair bg-white p-6">
      <h3 className="mb-5 flex items-center gap-2.5 text-sm font-bold text-slate-900">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-white">
          <Icon name={icone} size={18} />
        </span>
        {titulo}
      </h3>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {marcas.map((m) => (
          <Link
            key={m.nome}
            to={`/comprar?q=${encodeURIComponent(m.nome)}`}
            className="flex h-20 items-center justify-center rounded-xl border border-hair p-3 transition-shadow hover:shadow-[0_8px_20px_rgba(16,24,40,.08)]"
            title={m.nome}
          >
            <img
              src={`/marcas/${pasta}/${m.arquivo}`}
              alt={m.nome}
              className="max-h-12 max-w-full object-contain"
            />
          </Link>
        ))}
      </div>
    </div>
  );
}

export function HomeMarcas() {
  return (
    <section className="py-16">
      <div className="mx-auto max-w-[1100px] px-5 text-center sm:px-7">
        <span className="inline-block rounded-full bg-brand/10 px-3.5 py-1.5 text-[11.5px] font-bold uppercase tracking-wider text-brand">
          Explore por marca
        </span>
        <h2 className="mt-4 font-display text-[clamp(26px,3.5vw,38px)] font-extrabold tracking-tight text-slate-900">
          Marcas Mais Buscadas
        </h2>
        <p className="mt-2 text-slate-500">Clique em uma marca para ver os anúncios disponíveis</p>
        <div className="mt-10 flex flex-col gap-6 text-left">
          <Grupo titulo="Carros" icone="car" pasta="carros" marcas={CARROS} />
          <Grupo titulo="Motos" icone="car" pasta="motos" marcas={MOTOS} />
        </div>
      </div>
    </section>
  );
}
```

> Nota: não há ícone de "moto" no conjunto atual (`icons.tsx`); usa-se `car` nos dois grupos. Trocar depois se um ícone de moto for adicionado.

- [ ] **Step 2: Adicionar a seção à Home**

Em `src/features/public/pages/Home.tsx`, importar e inserir após `HomeAnunciar`:

```tsx
import { HomeMarcas } from "../components/home/HomeMarcas";
```
```tsx
      <HomeAnunciar />
      <HomeMarcas />
```

- [ ] **Step 3: Verificar build verde**

Run: `npx tsc -b && npm run build`
Expected: ambos exit 0.

- [ ] **Step 4: Smoke**

`/` mostra os grupos Carros e Motos com os logos de `public/marcas/`; clicar num logo abre `/comprar?q=<marca>`.

- [ ] **Step 5: Commit**

```bash
git add src/features/public/components/home/HomeMarcas.tsx src/features/public/pages/Home.tsx
git commit -m "feat(home): secao Marcas Mais Buscadas (logos carros/motos)"
```

---

### Task 7: Seção Quem Somos + montagem final

**Files:**
- Create: `public/home/quem-somos-placeholder.svg`
- Create: `src/features/public/components/home/HomeQuemSomos.tsx`
- Modify: `src/features/public/pages/Home.tsx`

**Interfaces:**
- Consumes: nada (seção estática) + asset placeholder.
- Produces: `HomeQuemSomos`. Home final = Hero + Anunciar + Marcas + QuemSomos (footer vem do PublicShell).

- [ ] **Step 1: Criar o placeholder de imagem do Quem Somos**

Criar `public/home/quem-somos-placeholder.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="560" height="360" viewBox="0 0 560 360">
  <rect width="560" height="360" rx="18" fill="#eef1f4"/>
  <rect x="120" y="150" width="320" height="90" rx="16" fill="#cbd3da"/>
  <circle cx="190" cy="250" r="26" fill="#9aa3af"/>
  <circle cx="370" cy="250" r="26" fill="#9aa3af"/>
  <text x="280" y="320" fill="#9aa3af" font-family="sans-serif" font-size="16" text-anchor="middle">Imagem — substitua em public/home/</text>
</svg>
```

- [ ] **Step 2: Criar o HomeQuemSomos**

Criar `src/features/public/components/home/HomeQuemSomos.tsx`:

```tsx
import { Icon } from "../icons";

const FEATURES = [
  { icon: "car", title: "Carros, motos e caminhões", desc: "Todas as categorias em um só lugar — fácil de filtrar e encontrar." },
  { icon: "whatsapp", title: "Contato direto pelo WhatsApp", desc: "Comprador fala direto com a loja, sem intermediários." },
  { icon: "trendUp", title: "Estatísticas de visualização", desc: "A loja acompanha o desempenho dos anúncios." },
];

export function HomeQuemSomos() {
  return (
    <section className="bg-cloud py-16">
      <div className="mx-auto grid max-w-[1100px] items-center gap-10 px-5 sm:px-7 lg:grid-cols-2">
        <div>
          <span className="inline-block rounded-full bg-brand/10 px-3.5 py-1.5 text-[11.5px] font-bold uppercase tracking-wider text-brand">
            Quem somos
          </span>
          <h2 className="mt-4 font-display text-[clamp(26px,3.5vw,38px)] font-extrabold leading-tight tracking-tight text-slate-900">
            A vitrine digital para <span className="text-brand">comprar e vender</span> veículos
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-slate-500">
            O REVVIO conecta compradores e lojas com procedência, contato direto e um catálogo
            fácil de usar em qualquer dispositivo.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex items-start gap-3 rounded-xl border border-hair bg-white p-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
                  <Icon name={f.icon} size={20} />
                </span>
                <div>
                  <p className="font-bold text-slate-900">{f.title}</p>
                  <p className="text-[13.5px] text-slate-500">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative">
          <img
            src="/home/quem-somos-placeholder.svg"
            alt=""
            className="w-full rounded-2xl"
          />
          <span className="absolute bottom-4 left-4 inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-sm font-bold text-white">
            <Icon name="star" size={15} /> Plataforma confiável
          </span>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Montar a Home final**

Em `src/features/public/pages/Home.tsx`, importar e inserir após `HomeMarcas`. O arquivo final fica:

```tsx
import { PublicShell } from "../PublicShell";
import { HomeHero } from "../components/home/HomeHero";
import { HomeAnunciar } from "../components/home/HomeAnunciar";
import { HomeMarcas } from "../components/home/HomeMarcas";
import { HomeQuemSomos } from "../components/home/HomeQuemSomos";

export function Home() {
  return (
    <PublicShell current="home">
      <HomeHero />
      <HomeAnunciar />
      <HomeMarcas />
      <HomeQuemSomos />
    </PublicShell>
  );
}
```

- [ ] **Step 4: Varredura de links órfãos para `/` que significavam "marketplace"**

Run: `grep -rn 'to="/"' src/features/public src/features/seller src/features/admin | grep -iv "BrandLogo"`
Inspecionar os resultados: links cujo texto/intuito é "ver veículos/comprar" devem apontar para `/comprar` (não `/`, que agora é a landing). Links de "voltar à home"/logo permanecem `/`. Ajustar apenas os que significam a grade. (Ex.: botões "Ver todos os veículos" / "Voltar ao catálogo".)

- [ ] **Step 5: Verificar build verde**

Run: `npx tsc -b && npm run build`
Expected: ambos exit 0.

- [ ] **Step 6: Smoke completo**

`/` mostra as 4 seções + header/footer; Busca Rápida e logos levam a `/comprar` filtrado; `/comprar` mostra os 9 veículos com badge da loja; `/vender` intacta.

- [ ] **Step 7: Commit**

```bash
git add public/home/quem-somos-placeholder.svg src/features/public/components/home/HomeQuemSomos.tsx src/features/public/pages/Home.tsx
git commit -m "feat(home): secao Quem Somos + montagem final da landing"
```

---

## Self-Review (preenchido)

**Spec coverage (design 2026-06-22-home-landing-publica):**
- Landing em `/`, grade em `/comprar` lendo `?q`/`?marca` → Task 1 + Task 4 ✓
- Header claro (faixa de contato + nav Comprar/Vender + auth) → Task 3 ✓
- Footer Revvio (Menu/Anunciante/Links Úteis + contato placeholder) → Task 3 ✓
- Banner placeholder + Busca Rápida → `/comprar?q=` → Task 4 ✓
- Anunciar = planos do `rv_pricing_plans` (`usePricingPlans`) → Task 5 ✓
- Marcas com logos `public/marcas/{carros,motos}` → `/comprar?q=` → Task 6 ✓
- Quem Somos (texto + features + imagem placeholder) → Task 7 ✓
- #7: badge da loja no card de `/comprar`; remove `VehicleCard` órfão → Task 2 ✓
- Identidade emerald, `@/components/ui-light` → todas as tasks ✓
- Fora de escopo (Notícias/Contato/Revendas, carrossel, Nossas Lojas) → respeitado ✓

**Placeholder scan:** sem TBD/TODO. As notas de "placeholder" são intencionais (assets/contato a trocar) e estão explícitas; o seletor de categoria e o ícone de moto têm notas honestas de limitação, não pendências de código.

**Type consistency:** `PublicShell` recebe `current?: "home"|"comprar"|"vender"`; `PublicHeader`/Marketplace usam os mesmos valores. `MarketplaceCard` passa a `PublicVehicle` (de `../queries`), que é o que `usePublicVehicles` já retorna. `HomePlanCard` usa `PricingPlan` (de `../../queries`) com os campos reais (`price_monthly`, `highlights`, `color`, `popular`, `cta_label`). Rotas: `/` → `Home`, `/comprar` → `Marketplace`.

**Nota de ambiente:** verificação por `tsc -b` + `npm run build` por task; smoke manual descrito; dados vêm do Supabase REMOTO (já migrado; 9 veículos, 3 planos). Sem mudança de banco nesta fase.
