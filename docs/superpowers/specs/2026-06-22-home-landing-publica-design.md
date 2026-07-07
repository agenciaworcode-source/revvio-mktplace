# Design — Nova Home (landing pública) do Revvio

**Data:** 2026-06-22
**Status:** aprovado (brainstorming) — pronto para plano de implementação

## 1. Contexto e objetivo

Hoje a home `/` **é** o marketplace (filtros + grade de veículos, `Marketplace.tsx`) e a
navegação pública tem só **Comprar** (`/`) e **Vender** (`/vender`). O cliente quer que, ao
abrir o Revvio, o usuário caia numa **landing/portal de várias seções** seguindo o padrão de
layout de uma referência (estilo "GaragensCar"): faixa de contato → header → banner + busca
rápida → bloco de anunciar → marcas → quem somos → footer.

Isso também absorve o gap **#7** da auditoria (identidade do vendedor no marketplace).

### Decisões de produto (do brainstorming, 2026-06-22)
- **Landing em `/`**; a grade de veículos atual move para **`/comprar`** (com filtros). `/vender`
  permanece. A "Busca Rápida" e o menu "Comprar" levam a `/comprar`.
- **Header claro** seguindo a referência (faixa de contato escura no topo + header branco com
  logo + nav), porém com a **identidade do Revvio** (verde/emerald como cor de destaque, não o
  laranja da referência). **Preserva os menus Comprar/Vender** e os botões de auth atuais.
- **Bloco "Anunciar"** exibe os **planos cadastrados em Planos pelo superadmin**
  (`rv_pricing_plans` via `usePricingPlans()`), reaproveitando o card de plano do `/vender`.
- **"Marcas Mais Buscadas"** usa os logos já adicionados em `public/marcas/carros` e
  `public/marcas/motos`, divididos Carros/Motos; cada logo leva a `/comprar?marca=X`.
- **#7 enxuto:** badge da loja ("Vendido por: …" → `/loja/slug`) em cada card de `/comprar`.
  **Sem** seção "Nossas Lojas" na landing.
- **Contato** (faixa de topo + footer): valores **placeholder**, fáceis de trocar depois.
- **Banner:** **imagem placeholder única** (slot que o cliente troca depois); sem carrossel.

### Fora de escopo (YAGNI)
- Páginas novas de Notícias / Contato / Revendas (não existem hoje; não serão criadas — os
  itens não entram na nav).
- Carrossel de banner (imagem única).
- Seção "Nossas Lojas" / `useActiveSellers` na landing.

## 2. Arquitetura e componentes

Casca pública compartilhada nova (header claro + footer), aplicada à **landing** e ao
**`/comprar`**. O `/vender` mantém a própria estrutura nesta fase.

### Layout / casca
- `src/features/public/PublicShell.tsx` — envolve as páginas públicas: `<ContactStrip>` +
  `<PublicHeader>` + conteúdo + `<PublicFooter>`. Recebe `current` ("comprar" | "vender" | "home")
  para destacar o item ativo.
- `src/features/public/components/ContactStrip.tsx` — faixa escura fina no topo (e-mail +
  WhatsApp placeholders). Some no mobile estreito (opcional).
- `src/features/public/components/PublicHeader.tsx` — header branco: logo (`BrandLogo` tema
  escuro) + nav (Comprar→`/comprar`, Vender→`/vender`) + botões de auth (Entrar/Quero vender/
  Painel — mesma lógica do `PublicTopBar` atual).
- `src/features/public/components/PublicFooter.tsx` — footer claro: logo + descrição + contato/
  redes (placeholders) + colunas **Menu** (Carros/Motos/Caminhões→`/comprar?...`, Vender,
  Contato), **Anunciante** (Cadastrar loja, Entrar, Planos→`/vender#planos`), **Links Úteis**
  (DETRAN, IPVA, Tabela FIPE — links externos) + barra de copyright.

> O `PublicTopBar` atual (escuro) deixa de ser usado nas páginas migradas; pode ser removido
> se não houver mais consumidores, ou mantido até o `/vender` migrar. O plano confirma os usos.

### Landing — `src/features/public/pages/Home.tsx`
Compõe, na ordem, seções isoladas (cada uma em `src/features/public/components/home/`):
1. `HomeHero` — banner (imagem placeholder) + bloco **Busca Rápida**: `<select>` categoria
   (Carros/Motos/Caminhões) + input "Digite a marca ou modelo" + chips POPULAR. Submit →
   navega para `/comprar?q=<termo>&categoria=<cat>`; chip → `/comprar?marca=<marca>`.
2. `HomeAnunciar` — título "Por que anunciar no Revvio?" + grade de **planos** do
   `usePricingPlans()`. Reaproveita/extrai o card de plano hoje embutido em `Vender.tsx`
   (`PlanCard`) para um componente compartilhado `src/features/public/components/PlanCard.tsx`.
   CTA de cada plano → `/cadastro-vendedor` (ou `/vender#planos`).
3. `HomeMarcas` — "Marcas Mais Buscadas", dois grupos (Carros, Motos) com os logos de
   `public/marcas/{carros,motos}/*.png`; cada item → `/comprar?marca=<Marca>`.
4. `HomeQuemSomos` — bloco institucional: texto + lista de features + destaque "+anos" +
   imagem (placeholder) + 3 cards de benefício (Categorias, WhatsApp direto, Estatísticas).
   Conteúdo estático adaptado ao Revvio.

### `/comprar` — marketplace (migração do atual `Marketplace.tsx`)
- Passa a ser a rota `/comprar` (era `/`), dentro do `PublicShell`.
- **Lê parâmetros de URL** (`useSearchParams`): `q` (texto marca/modelo), `marca` (pré-filtra a
  marca), `categoria` (Carros/Motos/Caminhões, quando aplicável ao dado). Os filtros laterais
  existentes passam a inicializar a partir desses params.
- **Badge do vendedor (#7):** **manter o `MarketplaceCard` atual** (preserva o visual de hoje:
  % FIPE, contagem de fotos, selo OFERTA) e **adicionar** nele um badge da loja ("Vendido por:
  <nome>" com avatar) linkando para `/loja/<slug>`. `usePublicVehicles` já traz `seller`; o
  `MarketplaceCard` passa a receber `seller` opcional. O `VehicleCard` órfão (card antigo com
  badge) é **removido** para não deixar dois cards divergentes.

### Dados
- `usePricingPlans()` (já existe) → planos da seção Anunciar.
- `usePublicVehicles()` (já existe, já traz `seller`) → grade de `/comprar` com badge.
- Marcas: lista estática mapeando arquivo de logo → rótulo → valor de filtro
  (ex.: `volkswagem.png` → "Volkswagen"). Sem query nova.

### Assets placeholder
- Banner e imagem do "Quem Somos": arquivos **placeholder** versionados (ex. SVG em
  `public/home/`) que o cliente substitui depois. `<img>` com `onError` para um fundo neutro.

## 3. Rotas (App.tsx)
- `/` → `Home` (nova landing, dentro do `PublicShell`).
- `/comprar` → `Marketplace` (listagem, dentro do `PublicShell`).
- `/vender`, `/veiculo/:id`, `/loja/:slug`, `/login`, `/cadastro-vendedor` → inalteradas
  (o `/` antigo que apontava para `Marketplace` passa a apontar para `Home`).
- Links internos que hoje vão para `/` como "comprar" (ex.: `BrandLogo`→`/`) continuam indo à
  home; o acesso à grade é via `/comprar`.

## 4. Estilo
- Identidade do Revvio: cor de destaque **emerald/brand** (`#10b981`), tipografia e componentes
  atuais (`@/components/ui-light`, `panel`). Layout/seções espelham a referência (faixa de
  contato escura + header branco + seções claras alternando branco/cloud), trocando o laranja
  pelo verde do Revvio.
- Responsivo: grades colapsam para 1 coluna no mobile; nav vira o padrão atual em telas
  estreitas.

## 5. Testes / verificação
- Sem runner unitário no projeto: verificação por `npx tsc -b` (0) e `npm run build` (0) por
  task, no padrão das fases anteriores.
- Verificação manual: `/` mostra as 5 seções; Busca Rápida e chips levam a `/comprar` com os
  filtros aplicados; logos de marca filtram; planos da seção Anunciar refletem o que está
  cadastrado em `/dashboard/planos`; cards de `/comprar` mostram a loja com link para a
  mini-loja; header/footer claros presentes nas páginas públicas migradas.

## 6. Riscos / atenção
- **Migração da rota `/`:** garantir que nada quebre ao mover a grade para `/comprar` (links,
  `BrandLogo`, redirects de auth). O plano cobre a varredura de referências a `/`.
- **Reuso do PlanCard:** extrair de `Vender.tsx` sem regressão visual no `/vender`.
- **`VehicleCard` vs `MarketplaceCard`:** escolher um para a grade e remover o órfão para não
  deixar dois cards divergentes.
- **Logos de marca:** mapear nomes de arquivo (inclui `volkswagem.png`) para rótulos/valores de
  filtro corretos.
