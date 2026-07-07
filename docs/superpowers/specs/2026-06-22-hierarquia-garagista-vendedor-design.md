# Design — Hierarquia Plataforma → Garagista → Vendedor

**Data:** 2026-06-22
**Status:** aprovado (brainstorming) — pronto para plano de implementação

## 1. Contexto e objetivo

O REVVIO é um marketplace de intermediação de veículos. Hoje o sistema tem 2 níveis
(admin e "seller", onde `seller` = garagista). As regras de negócio confirmadas exigem
um **terceiro nível** e ajustes no domínio financeiro:

1. **Plataforma (gestor/admin):** cria e gerencia as cobranças aos garagistas via ASAAS.
   É a **única receita da plataforma**.
2. **Garagista (loja):** assina um plano na plataforma e anuncia carros. Tem o **próprio
   financeiro**, o **próprio gerenciamento de comissões** e a **própria equipe de
   vendedores**.
3. **Vendedor (equipe):** pessoa vinculada a um garagista, vende carros do estoque da loja.

O gestor **também é um garagista** (tem uma loja própria) e alterna entre os dois contextos.

### Decisões de produto (do brainstorming)

- **Vendedor tem login** e painel próprio limitado.
- **Estoque da loja é compartilhado:** carros pertencem ao garagista; qualquer vendedor da
  equipe pode anunciar/vender; a venda é **atribuída ao vendedor** que a realizou.
- **Comissão é do vendedor**, paga pelo garagista. Taxa (%) por vendedor, definida pelo
  garagista. A plataforma não participa (só cobra o plano via ASAAS).
- **Toda venda é obrigatoriamente vinculada a um vendedor** (`vendedor_id` NOT NULL),
  mesmo quando o garagista registra a venda. Se o próprio dono quiser vender e receber
  comissão, ele cria um vendedor para si na própria equipe (com taxa própria).
- **Gestor = perfil duplo na mesma conta**, com seletor "Plataforma ↔ Minha loja".
- **Garagista cria/convida o vendedor** e define a taxa; vendedor **nasce ativo**.
- **Identidade pública é a loja** (garagista); o vendedor é interno (atribuição/comissão).

## 2. Modelo de dados

Abordagem escolhida: **hierarquia auto-referente em `rv_sellers`** (menor churn, reusa
auth/status/RLS/comissão existentes).

### `rv_sellers` (árvore de pessoas)
- `role` (enum `app_role`): renomear valor `seller` → `garagista` (`ALTER TYPE ... RENAME
  VALUE`) e adicionar `vendedor`. Enum final: `admin | garagista | vendedor`.
- `parent_id uuid references rv_sellers(id)`: **nulo** para garagista/admin; aponta para o
  garagista quando a linha é um vendedor.
- `slug` passa a ser **nullable** (só garagista tem mini-loja; a UNIQUE permite múltiplos
  nulos). Colunas públicas (bio, banner, avatar, whatsapp, instagram) só fazem sentido para
  garagista.
- `commission_rate`: na linha do **vendedor** = a taxa dele (definida pelo garagista); na
  linha do garagista/admin = não usada (0).

### `rv_vehicles` (estoque da loja)
- `seller_id` = **garagista (loja)**. Sem mudança estrutural; documentar que é a loja.

### `rv_sales`
- Adicionar `vendedor_id uuid NOT NULL references rv_sellers(id)` = **quem vendeu**.
- `seller_id` continua = a **loja** (para scoping de RLS).

### `rv_commissions`
- Adicionar `vendedor_id uuid NOT NULL references rv_sellers(id)` = **quem ganha**.
- `seller_id` continua = a **loja** (scope).

### RPC `register_sale`
- Novo parâmetro `p_vendedor_id`.
- Comissão calculada pela **taxa do vendedor atribuído** (`p_vendedor_id`), não de quem chama.
- Regras: vendedor (`p_vendedor_id`) deve pertencer à loja do chamador; o carro deve ser da
  loja; se quem chama é vendedor, `p_vendedor_id` deve ser ele mesmo.
- Grava `vendedor_id = p_vendedor_id`, `seller_id =` a loja, marca o veículo como `sold`.

### Migração (não-destrutiva)
- Todas as linhas atuais viram `garagista` (parent nulo). Admin continua admin **e** dono da
  própria loja (mesma linha).
- Vendas/comissões legadas: `vendedor_id = seller_id` (atribuídas à linha do próprio
  garagista), preservando histórico sem violar o NOT NULL.

## 3. RLS e isolamento de 3 níveis

### Funções auxiliares
- `current_person()` → `rv_sellers.id` do `auth.uid()`.
- `current_loja()` → a loja do usuário: própria id se garagista/admin; `parent_id` se vendedor.
- `is_admin()` → `role = 'admin'`.
- `is_loja_manager()` → `role in ('garagista','admin')`.

### Políticas (intenção)

| Tabela | Leitura | Escrita |
|---|---|---|
| `rv_sellers` | Público: só **garagista ativo**. Própria linha. Garagista vê a **própria equipe** (`parent_id = current_loja()`). Admin tudo. | Garagista gerencia a equipe (taxa/status de quem tem `parent_id = current_loja()`). Cada um edita o próprio perfil (trigger barra colunas sensíveis). Admin tudo. |
| `rv_vehicles` | Público. | Insert/edição: `seller_id = current_loja()`. Admin tudo. |
| `rv_sales` | Garagista/admin: toda a loja (`seller_id = current_loja()`). Vendedor: só as próprias (`vendedor_id = current_person()`). | Só via `register_sale` (definer). Edição: garagista/admin da loja. |
| `rv_commissions` | Vendedor: as próprias. Garagista/admin: toda a loja. | **Marcar paga = garagista** (`is_loja_manager() and seller_id = current_loja()`). Insert só via `register_sale`. |

### Trigger `protect_seller_columns` (atualizar)
- Admin: pode tudo.
- Garagista: pode alterar `commission_rate`/`status` das linhas da **própria equipe**
  (`parent_id = current_loja()`), mas não as próprias colunas sensíveis.
- Vendedor: não altera colunas sensíveis.

### Mudança de comportamento
- O "marcar comissão paga" sai do painel admin (item anterior) e passa para o **garagista**.
  A plataforma deixa de mexer em comissões de venda.

## 4. Auth, papéis e fluxos

- **AuthProvider** expõe `role` (`admin|garagista|vendedor`), `lojaId` (`current_loja()`) e
  `personId`. Mantém a recriação de perfil de **garagista** a partir do `user_metadata`
  (confirmação de e-mail). Vendedores não usam esse caminho (são criados pela Edge Function).
- **Redirect pós-login:** admin → `/dashboard`; garagista ativo → `/painel`; vendedor ativo →
  `/painel` (modo vendedor); pending/suspenso → telas de status.
- **Route guards:** `RoleRoute` aceita lista de papéis. `/dashboard` exige `admin`; `/painel`
  aceita `garagista`, `vendedor`, `admin` (conteúdo adapta ao papel).
- **Troca de contexto do gestor:** navegação — seletor "Plataforma ↔ Minha loja" nos dois
  layouts leva entre `/dashboard` e `/painel`. Sem segunda conta, sem relogin.
- **Convite de vendedor — Edge Function `invite-vendedor` (service role, padrão do
  `asaas-billing`):**
  1. Garagista informa nome, e-mail, taxa.
  2. Função valida chamador (garagista/admin), cria usuário via `inviteUserByEmail` (link para
     definir senha) e insere a linha `rv_sellers` com `parent_id =` a loja do chamador (vinda
     do servidor), `role='vendedor'`, `status='active'`, taxa informada.
  3. Vendedor define a senha pelo link e faz login → `/painel` (modo vendedor).

## 5. Telas / UX por papel

### Público (identidade = loja)
- `CadastroVendedor` → renomear rótulos para **"Cadastro de Garagista"**.
- Vitrine `/loja/:slug`, badges e WhatsApp continuam da **loja**.

### Painel do Garagista (`/painel`, modo gestor)
- Dashboard da loja (carros, vendas, comissões a pagar, desempenho da equipe).
- Veículos (estoque compartilhado).
- **Equipe (NOVO):** lista de vendedores, convidar (Edge Function), definir taxa,
  ativar/suspender.
- Vendas (todas da loja, com coluna do vendedor; registrar seleciona o vendedor).
- Comissões/Financeiro (todas da loja, por vendedor, **marcar paga**).
- Perfil (dados públicos da loja).

### Painel do Vendedor (`/painel`, modo limitado — mesma casca, nav reduzida)
- Dashboard próprio (minhas vendas, minhas comissões).
- Veículos (estoque da loja; pode cadastrar e registrar venda → atribuída a si).
- Minhas vendas / Minhas comissões (leitura; baixa é do garagista).
- Perfil básico (sem slug público).

> `PanelShell` já recebe `nav` por prop → trocar o conjunto de itens conforme o papel.

### Admin (`/dashboard`, quase intacto)
- "Assinantes" = garagistas; Financeiro = SaaS/ASAAS; seção "Vendas intermediadas" (GMV)
  permanece. Ganha o seletor **Plataforma ↔ Minha loja**.
- **Restrição (cliente, 2026-06-22):** a UI atual do `/dashboard` deve ser **mantida** —
  o seletor de contexto é uma adição não-intrusiva; nada de redesenho do painel admin.

## 6. Plano de fases (cada uma deployável)

1. **Fase A — Banco:** enum (`seller→garagista` + `vendedor`), `parent_id`, `vendedor_id`,
   helpers, RLS, `register_sale`, backfill. Não-destrutiva.
2. **Fase B — Auth/papéis:** AuthProvider (role/loja), guards multi-papel, redirect, Edge
   Function `invite-vendedor`.
3. **Fase C — Garagista:** tela Equipe (convite/taxa/suspender), comissões com baixa, seletor
   de vendedor na venda.
4. **Fase D — Vendedor:** nav + telas limitadas (minhas vendas/comissões).
5. **Fase E — Gestor:** troca de contexto + ajustes de rótulo (garagista vs vendedor).
6. **Fase F — QA:** teste de isolamento 3 níveis (vendedor A ≠ vendedor B; loja X ≠ loja Y) +
   fluxo convite → venda → comissão → baixa.

## 7. Riscos e pontos de atenção

- **Renomear valor de enum** (`seller→garagista`) afeta dados e tipos gerados; rodar
  `npm run types:gen` após a Fase A e revisar referências a `'seller'` no código.
- **`current_seller()`** atual é usada em RLS e na RPC; será substituída por
  `current_loja()`/`current_person()` — atualizar todas as referências.
- **Criação de auth user** exige service role → só via Edge Function (a anon key não cria
  usuários). Sem isso, o convite de vendedor não funciona.
- **Isolamento por loja** depende de `current_loja()` correto; cobrir com o teste de RLS
  estendido (Fase F).
- **Rótulos**: o termo "vendedor" no código/labels hoje significa garagista — renomear com
  cuidado para não confundir os dois níveis.

## 8. Fora de escopo (YAGNI por enquanto)

- Mini-loja/perfil público por vendedor (identidade pública é da loja).
- Cobrança ASAAS de comissões de venda (comissão é acerto interno garagista↔vendedor).
- Metas/faixas de comissão, múltiplas lojas por usuário, transferência de vendedor entre lojas.
