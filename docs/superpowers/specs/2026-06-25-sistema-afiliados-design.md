# Sistema de Afiliados — Design

**Data:** 2026-06-25
**Status:** aprovado (aguardando review do spec)

## Objetivo

Permitir que cada **garagista** vincule **afiliados independentes** para divulgar e ajudar a vender
os seus carros, com link próprio por veículo, comissão definida pelo garagista, e visibilidade do
desempenho para o afiliado, o garagista e o dono da plataforma (admin Revvio).

O recurso é **liberado conforme o plano** que o garagista contratou junto à Revvio.

## Decisões de produto (todas confirmadas no brainstorming)

| Tema | Decisão |
|---|---|
| Identidade do afiliado | **Usuário com login e painel próprio.** Modelado como `rv_sellers` com `role='afiliado'`, `parent_id`=loja. |
| Cardinalidade | **1 afiliado = 1 garagista** (`parent_id` único). Mesma pessoa em 2 lojas = 2 cadastros/logins. |
| Gating por plano | **Booleano por plano** (`affiliates_enabled`). Seed: **só Profissional** habilitado; admin edita os demais pelo front. |
| Comissão | **Taxa por afiliado** (`commission_rate` na linha do afiliado), definida pelo garagista. |
| Atribuição de venda | **Manual** na hora da venda (garagista escolhe), **com sugestão automática** a partir dos cliques rastreados do comprador. |
| Comissão vendedor × afiliado | **Exclusivo:** uma venda tem vendedor interno OU afiliado, nunca os dois → uma linha de comissão. |
| Tracking | **Ambos:** ação de compartilhar (esforço) **e** cliques recebidos via ref (resultado). |
| Onboarding | **Convite por e-mail**, reaproveitando o fluxo de convite de vendedor. |
| Painel do afiliado | Leitura de desempenho + editar próprio perfil + botão "sinalizar venda" (notifica o garagista). |
| Quem paga a comissão | **O garagista** (Revvio não movimenta o dinheiro). Ciclo pendente→paga já existente; garagista dá baixa. |

## Abordagem arquitetural

**Reaproveitar `rv_sellers` com novo role `afiliado`** (recomendada e aprovada). O afiliado é
estruturalmente um "primo" do vendedor: já existem `user_id` (login), `parent_id` (loja),
`commission_rate`, `seller_status`, fluxo de convite e helpers de RLS (`current_loja`,
`current_person`, `is_admin`, `is_loja_manager`). Uma tabela `rv_affiliates` separada duplicaria
tudo isso; só se justificaria num modelo N:N afiliado↔garagista, que foi descartado (1:1 via
`parent_id`).

## Modelo de dados (mudanças de schema)

> Migrations a partir de **0034** (a numeração final é atribuída no plano). O novo valor de enum vai
> em arquivo isolado (Postgres exige o valor commitado antes do uso), como foi com `'removed'`.

1. **`app_role`** (enum): `add value 'afiliado'` — migration isolada.
2. **`rv_sellers`**: `add column ref_code text unique` — código curto e estável usado no link público;
   preenchido só em afiliados (gerado no convite).
3. **`rv_pricing_plans`**: `add column affiliates_enabled boolean not null default false`.
   Seed: `update ... set affiliates_enabled = true where key = 'profissional'`.
4. **`rv_sales`**: `add column affiliate_id uuid references rv_sellers(id)` (nullable).
   `check`: no máximo um entre (`vendedor_id`, `affiliate_id`) preenchido (exclusividade).
5. **`rv_commissions`**: `add column affiliate_id uuid references rv_sellers(id)` (nullable). Em
   venda de afiliado, o `register_sale` grava `affiliate_id` (com `vendedor_id` nulo); em venda de
   vendedor, grava `vendedor_id` (com `affiliate_id` nulo) — exclusividade espelhando `rv_sales`.
   Coluna explícita (em vez de reaproveitar `vendedor_id`) para relatórios e RLS diretos. Mantém o
   ciclo pendente→paga.
6. **`rv_click_events`**: `add column affiliate_id uuid references rv_sellers(id)` (nullable) +
   ampliar o `check (kind in ...)` com `'affiliate_share'` e `'affiliate_link_visit'`.

### `register_sale` v4
Drop da assinatura v3 e recriação com `+ p_affiliate_id uuid default null`. Regras:
- **Exclusividade:** se `p_affiliate_id` não for nulo, `p_vendedor_id` deve ser nulo (e vice-versa);
  caso contrário, lança erro. Reforçado pelo `check` na tabela.
- **Vínculo:** o afiliado deve pertencer à loja da venda (`parent_id = loja`) e estar ativo —
  mesma validação já feita para o vendedor.
- **Comissão:** em venda de afiliado, calcula com a `commission_rate` **do afiliado** e grava em
  `rv_commissions` com `affiliate_id` preenchido (`vendedor_id` nulo), mesma estrutura/ciclo. Grava
  também `rv_sales.affiliate_id`.
- Demais comportamentos (status do veículo → `sold`, `sale_reason`, etc.) inalterados.
- Recria o `grant execute` com a nova assinatura.

## Onboarding (convite — espelha vendedor)

- Painel do garagista ganha a área **"Afiliados"** (gated por `affiliates_enabled` do plano; sem o
  plano, exibe aviso de upgrade, sem o CRUD).
- **"Convidar afiliado":** nome, e-mail, comissão (%). Cria a linha em `rv_sellers`
  (`role='afiliado'`, `parent_id`=loja, `commission_rate`, `ref_code` gerado) e dispara o e-mail de
  convite reaproveitando o fluxo de vendedor; o afiliado **define a própria senha** e entra no
  painel de afiliado.
- Garagista pode **editar a comissão** e **suspender/reativar** (reusa `seller_status`). Afiliado
  suspenso não loga e seus links param de atribuir.

## Links do afiliado + tracking

- O afiliado tem um **`ref_code`** estável. Link de um carro: `/veiculo/:id?ref=<ref_code>`.
- **Painel do afiliado → "Carros":** lista os carros **disponíveis** da loja (`status='available'`,
  não `blocked`), cada um com **"Copiar link"** e **"Compartilhar no WhatsApp"** (texto pronto,
  padrão do gerador existente).
  - A ação de copiar/compartilhar loga **`affiliate_share`** (`affiliate_id`, `vehicle_id`) →
    alimenta "o que ele divulgou".
- **Visita pelo link:** ao abrir `/veiculo/:id?ref=<code>`, a página pública chama o RPC
  **`log_affiliate_visit(p_ref_code text, p_vehicle_id bigint)`** (`security definer`, insert
  público controlado, no espírito do `log_click_event`) que resolve o afiliado pelo `ref_code` e
  grava **`affiliate_link_visit`** (`affiliate_id`, `vehicle_id`, `buyer_id` se houver comprador
  logado) → alimenta "cliques recebidos".
- O `ref` é guardado no cliente (localStorage) para sobreviver à navegação até um eventual
  cadastro/login do comprador (base da sugestão na venda).

## Atribuição de venda + sugestão automática

- Formulário de venda (garagista) ganha um seletor **"Responsável"** aceitando **vendedor interno
  OU afiliado** (exclusivo — escolher um limpa o outro), estendendo o seletor de vendedor atual.
- **Sugestão:** ao escolher o comprador (ou abrir a venda a partir de um lead com comprador
  conhecido), busca a **visita mais recente via ref daquele comprador** (`affiliate_link_visit`
  com `buyer_id`) e **pré-seleciona** o afiliado, com aviso *"Este comprador veio pelo link do
  afiliado X"*. O garagista **confirma ou troca**; nada é gravado sem a ação dele. Sem comprador
  rastreável → sem sugestão (manual).

## Painéis

### Painel do afiliado (`role='afiliado'`)
- **Carros:** disponíveis da loja, com copiar link / compartilhar WhatsApp (`affiliate_share`).
- **Desempenho (read-only):** compartilhamentos, cliques recebidos (por carro), vendas atribuídas
  a ele e comissões (pendente/paga).
- **Perfil:** editar nome, telefone, foto.
- **Sinalizar venda:** botão "Avisei uma venda" que **notifica o garagista** (não cria venda).

### Painel do garagista
- **Afiliados:** lista (status, comissão), convidar, editar comissão, suspender/reativar — gated
  pelo plano.
- **Visão geral dos afiliados dele** (mesmos KPIs/rankings do admin, **escopados a
  `parent_id = current_loja`**): total de vendas geradas pelos afiliados dele (qtd e R$), quais
  afiliados dele mais vendem, cliques/compartilhamentos, comissões a pagar; filtros por afiliado e
  período.
- No **registro de venda:** seletor com afiliados + sugestão automática.

### Painel do admin (dono da Revvio) — visão consolidada global
- **Lista global de afiliados:** afiliado → **a que garagista pertence**, status, comissão, nº de
  vendas, volume (R$) gerado, comissões pagas/pendentes.
- **KPIs:** total de vendas geradas por afiliados (qtd e R$), participação dos afiliados no GMV, nº
  de afiliados ativos.
- **Rankings:** afiliados que mais vendem (por volume e por qtd); garagistas que mais usam
  afiliados.
- **Filtros:** por garagista, por afiliado, por período (padrão da página Movimentações).
- **Drill-down por afiliado:** links/cliques/compartilhamentos, vendas registradas e comissões.

## RLS & segurança

- **Afiliado** (é uma pessoa via `current_person`): catálogo já é leitura pública; lê os próprios
  `rv_click_events`, `rv_sales` e `rv_commissions`. Estender as policies de `rv_sales` e
  `rv_commissions` com `affiliate_id = public.current_person()`.
- **Garagista:** lê afiliados e desempenho onde `parent_id = current_loja()` (já coberto pelo
  escopo de loja existente).
- **Admin:** `is_admin()` já cobre leitura global.
- `log_affiliate_visit`: `security definer`, `grant execute` a `anon, authenticated` (como
  `log_click_event`).

## Faseamento (para o plano de implementação)

Feature grande → plano em **4 fases** entregáveis e testáveis:
1. **Fundação:** schema (enum, colunas, `register_sale` v4, RLS, `log_affiliate_visit`) + gating no
   plano.
2. **Onboarding + painel do afiliado:** convite, carros, links, `affiliate_share`, perfil,
   sinalizar venda.
3. **Tracking de visita + atribuição na venda + sugestão:** captura do ref na página pública, UI de
   venda com seletor afiliado e pré-seleção sugerida.
4. **Relatórios:** painel do garagista (visão geral dos afiliados dele) + painel do admin
   (KPIs/rankings/drill-down).

## Fora de escopo (YAGNI)

- Afiliado vinculado a múltiplos garagistas (N:N).
- Comissão por veículo (override) — apenas taxa por afiliado.
- Atribuição automática de comissão por cookie/janela (a comissão é sempre confirmada manualmente).
- Pagamento da comissão do afiliado via Revvio/ASAAS (o garagista paga por fora; só registramos o
  ciclo pendente→paga).
- Auto-cadastro público de afiliado (apenas convite por e-mail).
- Limite numérico de afiliados por plano (gating é booleano).

## Critérios de aceite

1. Admin consegue habilitar/desabilitar `affiliates_enabled` por plano; só Profissional vem
   habilitado por seed.
2. Garagista em plano habilitado convida afiliado por e-mail; o afiliado define senha e acessa o
   painel próprio. Garagista em plano não habilitado não vê o CRUD (vê aviso de upgrade).
3. Afiliado vê os carros disponíveis da loja e gera link/WhatsApp por carro; copiar/compartilhar
   gera evento `affiliate_share`.
4. Abrir `/veiculo/:id?ref=<code>` registra `affiliate_link_visit` (com `buyer_id` quando logado).
5. Ao registrar venda, o garagista pode atribuir a um afiliado (exclusivo com vendedor); quando há
   comprador rastreável, o afiliado vem pré-sugerido e pode ser confirmado/trocado. A comissão é
   gerada com a taxa do afiliado.
6. Afiliado vê (read-only) seus cliques, compartilhamentos, vendas e comissões; edita o próprio
   perfil; consegue sinalizar uma venda ao garagista.
7. Garagista vê a visão geral dos afiliados dele (KPIs/rankings/comissões a pagar), escopada à loja.
8. Admin vê a visão global: lista de afiliados com o garagista de cada um, KPIs (vendas geradas por
   afiliados), rankings e drill-down, com filtros por garagista/afiliado/período.
9. RLS garante que afiliado só enxerga o próprio desempenho; garagista só os seus afiliados; admin
   tudo. Build (`tsc -b && vite build`) verde; migrations aplicáveis no remoto.
