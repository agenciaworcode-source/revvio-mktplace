# Excluir mini-loja (super admin)

Data: 2026-06-22 · Branch: `feat-delete-store`

## Objetivo

Permitir que o super admin exclua uma mini-loja (garagista) e todo o seu
histórico a partir da página **Gestão de Mini-Lojas** (`Stores.tsx`).

## Motivação técnica

Apagar uma linha de `rv_sellers` tem comportamento de FK misto:

- **cascateia:** vendedores (`parent_id`), planos (`rv_plans`), cobranças (`rv_charges`).
- `rv_vehicles.seller_id` é `ON DELETE SET NULL` → veículos **órfãos** (não apagados).
- `rv_sales.seller_id` e `rv_commissions.seller_id` **sem cascade** → o delete
  **falha** com violação de FK quando há vendas/comissões.

Logo, a exclusão precisa apagar os filhos na ordem certa, de forma atômica.

## Decisões

- **Mecanismo:** RPC atômica `admin_delete_store(p_seller_id)` (`SECURITY DEFINER`).
- **Storage:** não limpar (avatar/banner/fotos ficam no bucket; custo desprezível).
- **Confirmação:** modal pedindo digitar o nome exato da loja.

## Implementação

### 1. Migration `0023_admin_delete_store.sql` (reescrita)

Substitui as policies de DELETE por uma função:

```sql
create or replace function public.admin_delete_store(p_seller_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;

  -- ids da loja + vendedores (parent_id)
  delete from public.rv_commissions
    where seller_id in (select id from public.rv_sellers
                        where id = p_seller_id or parent_id = p_seller_id);
  delete from public.rv_sales
    where seller_id in (select id from public.rv_sellers
                        where id = p_seller_id or parent_id = p_seller_id);
  delete from public.rv_vehicles
    where seller_id in (select id from public.rv_sellers
                        where id = p_seller_id or parent_id = p_seller_id);
  -- apaga a loja → cascateia vendedores, planos e cobranças
  delete from public.rv_sellers where id = p_seller_id;
end;
$$;

revoke all on function public.admin_delete_store(uuid) from public, anon;
grant execute on function public.admin_delete_store(uuid) to authenticated;
```

`SECURITY DEFINER` ignora RLS; o gate é o `is_admin()` interno. Não são
necessárias policies de DELETE.

### 2. `useDeleteStore()` em `src/features/admin/queries.ts`

Mutation que chama `supabase.rpc("admin_delete_store", { p_seller_id })` e
invalida `["admin-sellers"]`, `["admin-vehicles"]`, `["admin-finance"]`,
`["charges"]`.

### 3. UI em `src/features/admin/pages/Stores.tsx`

- Botão **Excluir** (danger) em cada card, abaixo de "Visitar mini-loja".
- Estado local `target` (loja selecionada) controla um `Modal` (ui-light)
  "Excluir mini-loja": aviso do que será apagado + `Input` para digitar o nome
  exato. "Excluir definitivamente" fica `disabled` até o texto bater com o nome.
- `onSuccess` fecha o modal.

## Fora de escopo (YAGNI)

Limpeza de storage, soft-delete/lixeira, log de auditoria.
