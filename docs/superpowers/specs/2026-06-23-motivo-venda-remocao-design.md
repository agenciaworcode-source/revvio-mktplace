# Motivo de venda e motivo de remoção — Design

**Data:** 2026-06-23
**Status:** aprovado (aguardando review do spec)

## Objetivo

Toda vez que um veículo sai do inventário ativo do sistema, registrar **por quê**:

- **Venda realizada** → campo obrigatório **"Motivo da venda"**, gravado em `rv_sales`.
- **Exclusão de veículo** → campo obrigatório **"Motivo da remoção"**, gravado no próprio veículo via soft-delete.

Ambos os campos usam **lista pré-definida + opção "Outro"** (texto livre).

## Decisões de produto

| Tema | Decisão |
|---|---|
| Entrada do motivo | Select com itens pré-definidos + "Outro" (texto livre). |
| Persistência da remoção | **Soft-delete**: veículo permanece no banco com `status='removed'` + motivo; some das listagens. |
| Escopo da remoção | Vendedor/garagista **e** Admin. |
| Obrigatoriedade | Motivo **obrigatório** nos dois fluxos. |

### Listas de motivos
- **Venda:** À vista · Financiada · Troca · Repasse/lojista · Consignação · Outro
- **Remoção:** Vendido fora da plataforma · Desistência do proprietário · Cadastro duplicado · Erro de cadastro · Veículo indisponível · Outro

Quando "Outro" é selecionado, o texto digitado é gravado como o motivo. Caso contrário, grava-se o rótulo escolhido.

## Banco de dados

### Migration 0030 — enum (arquivo isolado)
```sql
alter type vehicle_status add value if not exists 'removed';
```
Em arquivo separado porque o Postgres exige que o novo valor de enum esteja commitado antes de ser usado.

### Migration 0031 — colunas + register_sale v3
```sql
alter table public.rv_sales    add column if not exists sale_reason   text;
alter table public.rv_vehicles add column if not exists removal_reason text;
alter table public.rv_vehicles add column if not exists removed_at     timestamptz;
alter table public.rv_vehicles add column if not exists removed_by     uuid;
```

`register_sale` v3: drop da assinatura v2 e recriação com novo parâmetro `p_sale_reason text default null`, inserindo `sale_reason` no insert de `rv_sales`. Mantém toda a lógica de comissão/atualização de status já existente. Recria o `grant execute` com a nova assinatura.

## Soft-delete (sem função nova)

A exclusão deixa de ser `delete()` e passa a ser:
```ts
update rv_vehicles
set status = 'removed', removal_reason = <motivo>, removed_at = now(), removed_by = <person>
where id = <id>
```
RLS de update já permite garagista editar os próprios veículos e admin editar qualquer um (mesmo caminho de `useSaveVehicle` e do toggle `blocked`), então não é necessária função `security definer`.

`removed_by` recebe o id da pessoa atual quando disponível no client; se não houver, fica `null` (não bloqueia a operação).

## Filtragem das listagens

- `seller/queries.useVehicles`: adicionar `.neq("status", "removed")`.
- `admin/queries` (query de veículos, ~linha 369): adicionar `.neq("status", "removed")`.
- Listagens públicas (`public/queries`) já filtram `status='available'`/`'sold'`, então `removed` não aparece e as contagens de "disponíveis"/"vendidos" não mudam.

Não haverá tela para listar veículos removidos (fora de escopo). O dado fica persistido para relatório futuro.

## Frontend

### Venda — `src/features/seller/pages/Sales.tsx`
- Novo campo **"Motivo da venda"**: `Select` com a lista + "Outro"; quando "Outro", exibe `Input` de texto.
- `schema` zod ganha `sale_reason` (obrigatório; quando "Outro", o texto não pode ser vazio).
- `onSubmit` envia `sale_reason` resolvido (rótulo ou texto livre) para `useRegisterSale`.
- Tabela de vendas (`Sales` list): nova coluna **"Motivo"**.

### `src/features/seller/queries.ts`
- `RegisterSaleInput` ganha `sale_reason: string`; RPC passa `p_sale_reason`.
- `useDeleteVehicle`: recebe `{ id, reason, personId }`; troca `delete()` por `update` de soft-delete.

### Modal de exclusão — vendedor (`seller/pages/Vehicles.tsx`) e admin (`admin/pages/Vehicles.tsx`)
- Adicionar campo **"Motivo da remoção"**: `Select` + "Outro" (texto). Estado local no componente do modal.
- Botão "Excluir" do modal fica desabilitado enquanto não houver motivo válido.
- `confirmDelete` passa o motivo resolvido para a mutation.

### `src/features/admin/queries.ts`
- Mutation de exclusão de veículo (~linha 412): troca `delete()` por `update` de soft-delete com `removal_reason`/`removed_at`/`removed_by`.

### Tipos
`select("*")` já retorna as novas colunas; onde o TypeScript reclamar das colunas novas (tipos gerados desatualizados), estender o tipo local / cast pontual, seguindo o padrão já usado no arquivo (`as VehicleWithOwner[]`). Os tipos gerados serão regenerados em fluxo separado.

## Fora de escopo (YAGNI)
- Tela/filtro para visualizar veículos removidos.
- Hard-delete real (purge) de duplicados/erros — pode virar ferramenta de admin no futuro.
- Edição do motivo após o registro.

## Critérios de aceite
1. Registrar venda exige selecionar um motivo; "Outro" exige texto; o motivo aparece na tabela de vendas e em `rv_sales.sale_reason`.
2. Excluir veículo (vendedor e admin) exige motivo; o veículo some das listagens mas permanece no banco com `status='removed'`, `removal_reason`, `removed_at`.
3. Veículos removidos não aparecem em nenhuma listagem (painel garagista, painel admin, site público).
4. Build (`tsc -b && vite build`) verde; migrations aplicáveis no remoto.
