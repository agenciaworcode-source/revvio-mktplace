# Contas de comprador + rastreamento de cliques — Design

**Data:** 2026-06-23
**Status:** aprovado (aguardando review do spec)

## Objetivo

Atrelar a uma identidade real os cliques que tiram o cliente do site e dar ao dono da plataforma (e ao garagista) visão de **quem** demonstrou interesse em cada carro.

Para isso, introduz-se um novo tipo de conta — o **comprador** — que precisa estar logado para enviar o formulário de interesse ("Quero ver o carro"). Sobre essa identidade, constrói-se o log de eventos de clique e os painéis de drill-down.

Entrega em duas fases dependentes:
- **Fase 1** — contas de comprador (cadastro/login e-mail+senha, perfil, "Minha conta") + gate de login no formulário do veículo.
- **Fase 2** — log de eventos `rv_click_events` + painéis (admin filtra garagista → carros → cliques → compradores; garagista vê os próprios).

## Decisões de produto (já validadas)

| Tema | Decisão |
|---|---|
| Autenticação do comprador | E-mail + senha (mesmo Supabase Auth dos vendedores). |
| Dados do cadastro | Completo: nome, e-mail, telefone, cidade, senha. |
| Confirmação de e-mail | **Não** obrigatória (entra e já pode contatar). |
| Gate UX | **Modal inline** de login/cadastro; ao logar, continua a ação. |
| Botões com gate (Fase 1) | **"Quero ver o carro"** (form do veículo) **+ WhatsApp e Instagram da mini-loja**. Todos exigem login. Telefone (texto) fica aberto. |
| Página "Minha conta" | Incluída na Fase 1 (editar nome/telefone/cidade/senha + sair). |
| Identidade dos canais (WhatsApp/Instagram) | **Identificada** — como os botões da mini-loja passam a exigir login, os eventos de canal carregam `buyer_id`. |
| Quem vê o drill-down (Fase 2) | Admin (com filtro por garagista, aba "Anúncios") **e** garagista (só os próprios carros). |
| Dois rastreamentos (Fase 2) | (1) Cliques **por veículo** → quem clicou; (2) Acessos a **canais externos** (WhatsApp/Instagram) da mini-loja → contagem + quem acessou. |

**Trade-off registrado:** exigir login antes do contato tende a reduzir o volume de leads (atrito), em troca de identidade confiável. Aceito conscientemente.

---

## Fase 1 — Contas de comprador + gate

### Banco (migration)
- `rv_buyers` (PK `id uuid` = `auth.users.id`): `name text not null`, `phone text`, `city text`, `email text`, `created_at timestamptz default now()`, `updated_at timestamptz default now()` (trigger `set_updated_at`).
  - RLS: `select`/`update`/`insert` onde `id = auth.uid()`; admin/garagista podem `select` (para a Fase 2). Sem `delete` público.
- `rv_leads`: nova coluna `buyer_id uuid references public.rv_buyers(id) on delete set null`. Índice `idx_rv_leads_buyer_id`.

### Auth (AuthProvider)
- Mesmo Supabase Auth para todos. Após autenticar, `loadSeller` continua tentando `rv_sellers`; se **não houver** seller, carrega `rv_buyers` e expõe novos campos no contexto: `buyer: Buyer | null` e `isBuyer: boolean`.
- O perfil de comprador **não** ativa nenhum estado de vendedor (`seller` permanece `null`), então os guards de `/painel` e `/dashboard` seguem barrando comprador.

### Roteamento
- `/login` passa a ser login genérico (comprador e vendedor usam o mesmo form). Pós-login, o redirecionamento ramifica: se virou `seller` → fluxo atual (painel/cadastro-vendedor); se virou `buyer` → volta para a rota de origem (ou `/`). Buyers **nunca** caem em `/cadastro-vendedor`.
- Novas rotas públicas: `/cadastro` (cadastro de comprador) e `/minha-conta` (protegida: exige `isBuyer`).
- Header: "Entrar" → `/login`; quando logado como comprador, mostra o nome + acesso a "Minha conta" e "Sair". "Área do anunciante" inalterado.

### Cadastro do comprador
- Form: nome, e-mail, telefone (máscara), cidade, senha. `supabase.auth.signUp` (sem confirmação) → na sessão criada, insere/upsert em `rv_buyers` com os dados. Entra direto.

### Gate no "Quero ver o carro" (`VehicleDetails` / `LeadForm`)
- Se `!user`: o submit abre um **modal de auth** (abas Entrar / Criar conta). Ao autenticar como comprador, o modal fecha e o envio prossegue automaticamente.
- Logado como comprador: o `LeadForm` vem **pré-preenchido** do perfil (nome/telefone/email/cidade, editáveis); resta a mensagem. O lead é gravado com `buyer_id = buyer.id`.
- O incremento de clique atual (`increment_vehicle_clicks`) é mantido.

### Gate nos canais da mini-loja (`Storefront`)
- Botões **WhatsApp** e **Instagram** do garagista também exigem login: se `!user`, o clique abre o `BuyerAuthModal` (mesmo componente). Após autenticar, registra o evento de canal (com `buyer_id`) e abre o link externo.
- Telefone exibido como texto continua aberto (sem gate).

### "Minha conta" (`/minha-conta`)
- Página simples: edita nome/telefone/cidade (e-mail somente leitura), troca de senha (`supabase.auth.updateUser`), e botão "Sair".

---

## Fase 2 — Log de eventos + painéis

### Banco (migration)
- `rv_click_events`:
  - `id bigint generated always as identity primary key`
  - `seller_id uuid not null references rv_sellers(id) on delete cascade`
  - `vehicle_id bigint references rv_vehicles(id) on delete set null`
  - `buyer_id uuid references rv_buyers(id) on delete set null`
  - `kind text not null check (kind in ('vehicle_interest','store_whatsapp','store_instagram'))`
  - `created_at timestamptz not null default now()`
  - Índices: `(seller_id)`, `(vehicle_id)`, `(buyer_id)`, `(created_at desc)`.
  - RLS: `insert` público (`with check (true)`) — anônimo grava `buyer_id` nulo, comprador grava o próprio. `select`: admin ou `seller_id = current_loja()`.
- Função `log_click_event(p_kind text, p_seller_id uuid, p_vehicle_id bigint default null)` `security definer`: insere o evento usando `buyer_id = auth.uid()` quando houver sessão (e existir em `rv_buyers`), senão nulo. `grant execute` a `anon, authenticated`.

### Captura (frontend)
- `vehicle_interest`: disparado no envio do "Quero ver o carro" (sempre com comprador logado → identidade real).
- `store_whatsapp` / `store_instagram`: disparados nos botões da mini-loja, **que agora exigem login** → também com `buyer_id` (identidade real). Eventuais registros anônimos antigos aparecem como "Visitante não identificado".
- Tudo best-effort (não bloqueia a navegação).

### Painel admin (estende a aba "Anúncios" — `admin/pages/Leads.tsx`), com filtro por garagista
**Rastreamento 1 — Cliques por veículo:**
- Lista de carros do garagista com **nº de cliques** (contagem de `vehicle_interest` por `vehicle_id`).
- Expandir um carro → lista de **compradores que clicaram**: nome, telefone, e-mail, cidade, data/hora do último clique e nº de cliques.

**Rastreamento 2 — Acessos a canais externos (WhatsApp/Instagram da mini-loja):**
- Totais por canal do garagista + lista de **compradores que acessaram** cada canal (nome, telefone, e-mail, data/hora, nº de acessos).

### Painel garagista (`/painel/leads`, hoje só managers)
- Os mesmos dois rastreamentos, restritos aos próprios carros/loja (`seller_id = current_loja()`), sem o filtro de garagista.

### Queries
- `useClicksByVehicle(sellerId?)`: agrega cliques `vehicle_interest` por carro.
- `useClickBuyers(vehicleId)`: compradores que clicaram naquele carro (join `rv_click_events` × `rv_buyers`), com contagem e último horário.
- `useChannelClicks(sellerId?)`: totais + compradores por canal (`store_whatsapp`/`store_instagram`) da loja.

---

## Arquitetura / isolamento
- `rv_buyers` e o contexto de comprador no `AuthProvider` são a fronteira da Fase 1; nada do fluxo de vendedor muda de comportamento.
- `rv_click_events` + `log_click_event` são a fronteira da Fase 2; os painéis apenas leem agregados via queries dedicadas.
- O modal de auth é um componente reutilizável (`BuyerAuthModal`) consumido pelo gate.

## LGPD
- Passa a haver dado pessoal de comprador atrelado a comportamento (cliques). Adicionar menção na Política de Privacidade (finalidade: intermediação de contato; controlador: a loja/garagista). Consentimento implícito no cadastro ("Ao criar conta você aceita..."). Tratado como item de conteúdo, não bloqueia a engenharia.

## Fora de escopo (YAGNI)
- Login social / magic link / OTP.
- Área "Meus interesses" (histórico) do comprador.
- Exportação/relatório CSV dos cliques.
- Planos com comissão sobre vendas pelo sistema (motivação futura citada pelo cliente; não faz parte das Fases 1–2).

## Critérios de aceite
1. Visitante navega e vê todos os carros sem login.
2. Clicar em "Quero ver o carro" sem login abre o modal; após cadastro/login (e-mail+senha, sem confirmação), o envio prossegue e o lead grava `buyer_id`.
3. Clicar em WhatsApp/Instagram da mini-loja sem login abre o modal; após autenticar, registra o evento de canal (com `buyer_id`) e abre o link.
4. Comprador logado vê o form pré-preenchido e acessa "Minha conta" para editar perfil/senha e sair.
5. Vendedor/garagista/admin continuam logando e usando seus painéis exatamente como hoje.
6. Cada "Quero ver o carro" gera `rv_click_events` (`vehicle_interest`) com `buyer_id`; cada acesso a WhatsApp/Instagram gera evento (`store_whatsapp`/`store_instagram`) com `buyer_id`.
7. Admin (aba Anúncios) filtra por garagista e vê **dois rastreamentos**: cliques por veículo (com quem clicou) e acessos a canais (com quem acessou). Garagista vê o mesmo para a própria loja.
8. Build (`tsc -b && vite build`) verde; migrations aplicáveis no remoto.
