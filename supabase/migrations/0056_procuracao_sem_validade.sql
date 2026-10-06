-- ============================================================
-- 0056_procuracao_sem_validade.sql — procuração sem prazo de 90 dias
-- ============================================================
-- A pedido do cliente (06/10/2026), a procuração deixa de dizer
-- "Validade de 90 (noventa) dias a contar da assinatura, salvo revogação
-- expressa anterior." O seed da 0055 é `on conflict do nothing`, então a
-- frase só sai do modelo já gravado por aqui. `replace` mantém qualquer outra
-- edição que o superadmin tenha feito no texto e não faz nada se rodar de novo.
-- Aplicada em produção via REST em 06/10/2026.

update public.rv_contract_models
   set body = replace(body,
         ' Validade de 90 (noventa) dias a contar da assinatura, salvo revogação expressa anterior.',
         ''),
       updated_at = now()
 where slug = 'procuracao'
   and body like '%Validade de 90 (noventa) dias%';
