# Visão do admin: motivos de venda e remoção (Movimentações) — Design

**Data:** 2026-06-25
**Status:** aprovado (aguardando review do spec)

## Objetivo

Dar ao **dono da plataforma** (usuário com role `admin`, ex.: `admin@revvio.com`) visibilidade dos
**motivos de venda** e **motivos de remoção de veículos** registrados pelos garagistas dele.

Hoje esses dados já são gravados (feature de 23/06: `rv_sales.sale_reason`,
`rv_vehicles.removal_reason` + soft-delete `status='removed'`), mas **não há nenhuma tela** onde o
admin os enxergue. O admin precisa ver isso em **dois lugares**: uma visão **global consolidada**
(todos os garagistas) e dentro de **cada garagista** (SellerDetail).

## Decisões de produto

| Tema | Decisão |
|---|---|
| Onde exibir | **Global** (nova página no menu admin) **e** **por garagista** (no SellerDetail). |
| Profundidade (global) | **Listar + filtros + resumo agregado** (contagem por motivo). |
| Profundidade (por garagista) | **Enxuta**: tabelas + chips de contagem por motivo, **sem** barra de filtros (o garagista já é fixo). |
| Escopo dos dados | Venda → `rv_sales`; Remoção → `rv_vehicles` com `status='removed'`. |
| Banco de dados | **Nenhuma mudança.** Dados já existem; RLS já permite leitura do admin. |

## Pré-requisito técnico (verificado)

Nenhuma migration nem mudança de RLS é necessária:

- `rv_sales` SELECT (policy `rv_sales_read_scope`, migration 0015): `public.is_admin()` → admin lê
  todas as vendas, incluindo `sale_reason`.
- `rv_vehicles` SELECT (policy `rv_vehicles_public_read`, migration 0003): `using (true)` → admin lê
  todos os veículos, inclusive os `status='removed'`, com `removal_reason` / `removed_at`.

Feature é **100% frontend** (novos hooks de query + componentes + página + rota/menu).

## Camada de dados — novos hooks (`src/features/admin/queries.ts`)

Ambos aceitam um objeto de filtros opcional, permitindo reaproveitamento na página global (sem
`sellerId`) e no SellerDetail (com `sellerId` fixo).

```ts
type ReasonFilters = {
  sellerId?: string;   // escopo por garagista (loja). undefined = todos
  reason?: string;     // motivo exato. undefined = todos
  from?: string;       // ISO date (>=). undefined = sem limite inferior
  to?: string;         // ISO date (<=). undefined = sem limite superior
};

useAdminSales(filters?: ReasonFilters): UseQueryResult<AdminSaleRow[]>
useAdminRemovals(filters?: ReasonFilters): UseQueryResult<AdminRemovalRow[]>
```

### `useAdminSales`
- Lê `rv_sales` com join do nome do garagista (`seller:rv_sellers!rv_sales_seller_id_fkey(name)`) e
  dados do veículo (`vehicle:rv_vehicles(make, model, year)`).
- Aplica filtros server-side quando presentes: `.eq("seller_id", sellerId)`,
  `.eq("sale_reason", reason)`, `.gte("sale_date", from)`, `.lte("sale_date", to)`.
- Ordena por `sale_date` desc.
- Linha (`AdminSaleRow`): `id`, `sale_date`, `buyer_name`, `sale_price`, `payment_method`,
  `sale_reason`, `seller_name`, `vehicle_label` (ex.: "Toyota Corolla 2020").

### `useAdminRemovals`
- Lê `rv_vehicles` com `.eq("status", "removed")` + join do nome do garagista
  (`seller:rv_sellers!rv_vehicles_seller_id_fkey(name)`).
- Filtros: `.eq("seller_id", sellerId)`, `.eq("removal_reason", reason)`,
  `.gte("removed_at", from)`, `.lte("removed_at", to)`.
- Ordena por `removed_at` desc.
- Linha (`AdminRemovalRow`): `id`, `removed_at`, `removal_reason`, `seller_name`,
  `vehicle_label`, `price`.

Tipos: como nas queries existentes, `select(...)` traz as colunas novas; onde o TS reclamar (tipos
gerados desatualizados), estender o tipo local / cast pontual seguindo o padrão do arquivo
(`as ...[]`).

## Componentes reutilizáveis (`src/features/admin/components.tsx` ou arquivo próprio)

Compartilhados entre a página global e o SellerDetail:

- **`ReasonSummary`** — recebe as linhas e a lista de motivos possíveis; renderiza chips
  `motivo: contagem` do conjunto recebido (já filtrado). Motivos com 0 podem ser omitidos.
- **`SalesReasonTable`** — tabela de vendas. Prop `showSeller?: boolean` (global mostra coluna
  Garagista; SellerDetail não). Colunas: Data · Veículo · Comprador · Valor · Pagamento · Motivo
  [· Garagista].
- **`RemovalsReasonTable`** — tabela de remoções. Prop `showSeller?: boolean`. Colunas: Data ·
  Veículo · Valor · Motivo [· Garagista].

Listas de motivos reutilizam `SALE_REASONS` e `REMOVAL_REASONS` já exportados de
`src/components/ReasonField.tsx`.

## Página global — `src/features/admin/pages/Movimentacoes.tsx`

- Nova rota e item de menu em `AdminLayout`:
  `{ to: "/dashboard/movimentacoes", label: "Movimentações", icon: "clock" }`.
- Duas seções **Vendas** e **Remoções** (abas simples ou dois blocos empilhados — decisão de UI na
  implementação, default: abas).
- Cada seção contém, nesta ordem:
  1. **Barra de filtros:** garagista (`Select` populado por `useAdminSellers`) · motivo (`Select`
     da lista correspondente) · período (`from`/`to` via `Input type="date"`). Estado local na
     página; passado aos hooks.
  2. **`ReasonSummary`** com as linhas filtradas.
  3. Tabela correspondente com `showSeller={true}`.
- Estados de loading (`Spinner`) e vazio ("Nenhum registro no período/filtro").

## Visão por garagista — `src/features/admin/pages/SellerDetail.tsx`

Dois novos `Card`s no detalhe do garagista, escopados via `sellerId` da rota:

- **Card "Vendas"**: `ReasonSummary` + `SalesReasonTable showSeller={false}`, usando
  `useAdminSales({ sellerId })`.
- **Card "Veículos removidos"**: `ReasonSummary` + `RemovalsReasonTable showSeller={false}`, usando
  `useAdminRemovals({ sellerId })`.
- **Sem** barra de filtros aqui (o garagista é fixo). Mantém a visão enxuta.

## Fora de escopo (YAGNI)

- Exportação CSV / Excel.
- Gráficos / dashboards visuais (só chips de contagem).
- Edição ou exclusão do motivo após o registro.
- Hard-delete (purge) de veículos removidos.
- Restaurar veículo removido (voltar de `removed` para `available`).
- Paginação infinita (volume atual é baixo; ordenação desc basta).

## Critérios de aceite

1. Existe um item **"Movimentações"** no menu admin levando a `/dashboard/movimentacoes`.
2. A seção **Vendas** lista todas as vendas de todos os garagistas com a coluna **Motivo** e a
   coluna **Garagista**; filtros por garagista, motivo e período funcionam; o resumo mostra
   contagem por motivo do conjunto filtrado.
3. A seção **Remoções** lista todos os veículos `status='removed'` com **Motivo**, **data de
   remoção** e **Garagista**; mesmos filtros e resumo.
4. No **SellerDetail** de um garagista aparecem os cards **Vendas** e **Veículos removidos**
   escopados àquele garagista, com motivo e chips de contagem, sem barra de filtros.
5. Nenhuma migration nova; nenhum dado de outro garagista vaza (RLS já garante; filtros são apenas
   conveniência de UI sobre o que o admin já pode ler).
6. Build (`tsc -b && vite build`) verde.
