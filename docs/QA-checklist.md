# REVVIO — Checklist de QA (hierarquia Plataforma → Garagista → Vendedor)

Validação manual ponta a ponta. Marque cada item ao testar no navegador.
Pré-requisitos: `.env.local` preenchido, migrations `0001`→`0019` aplicadas,
admin promovido, `npm run dev` no ar. Os testes automatizados citados ficam em
`docs/superpowers/tests/` (rodar com `supabase start` no ar).

> **Criação de usuário & e-mail:** garagista nasce por `signUp` (Supabase Auth);
> vendedor é criado pela Edge Function `invite-vendedor` via `inviteUserByEmail`
> (Supabase Auth). Os e-mails transacionais (confirmação, convite, aprovação)
> saem pelo **Resend** — como SMTP do Auth e/ou pela função `send-email`. Em
> ambiente local os testes verificam a camada de dados, não a entrega real.

## 0. Setup
- [ ] `npm install && npm run dev` sobe sem erro em http://localhost:5173
- [ ] `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` válidas (sem erro de boot)
- [ ] Admin promovido: login do admin cai em `/dashboard`

## 1. Cadastro do garagista e papéis
- [ ] `/cadastro-vendedor` mostra o título **"Cadastro de Garagista"** e cria a conta
- [ ] Garagista novo cai em **/aguardando-aprovacao** (status `pending`)
- [ ] E-mail de "cadastro recebido" sai pelo Resend (ou template do Auth)
- [ ] Login de garagista `pending` é barrado do `/painel`
- [ ] Admin aprova → garagista loga e entra no `/painel` (badge "Garagista")
- [ ] Admin suspende → garagista vai para **/conta-suspensa**
- [ ] Logout limpa a sessão; rota protegida sem sessão redireciona p/ `/login`

## 2. Equipe do garagista (vendedores)
- [ ] `/painel/equipe`: convidar vendedor (nome, e-mail, taxa %) chama `invite-vendedor`
- [ ] Vendedor nasce **ativo** vinculado à loja; e-mail de convite sai (Resend/Auth)
- [ ] Vendedor define a senha pelo link e loga → `/painel` (modo vendedor)
- [ ] Garagista ajusta taxa e suspende/reativa o vendedor
- [ ] Automatizado: `bash docs/superpowers/tests/b3_invite_vendedor_test.sh` → `✅ B3`

## 3. Painel do Vendedor (modo limitado)
- [ ] Nav reduzida: **sem** "Equipe" e **sem** "Perfil / Mini-Loja"
- [ ] Veículos = estoque **da loja** (compartilhado); pode cadastrar e registrar venda
- [ ] Registrar venda fica **atribuída ao próprio vendedor**; comissão na taxa dele
- [ ] Dashboard/Financeiro mostram **só as próprias** vendas e comissões
- [ ] Vendedor **não** consegue dar baixa em comissão

## 4. Painel do Garagista (modo gestor da loja)
- [ ] Dashboard da loja (carros, vendas, comissões a pagar, equipe)
- [ ] Veículos: cadastrar/editar/excluir; upload de imagens vai p/ `vehicle-images/<lojaId>/`
- [ ] Registrar venda: seleciona **o vendedor** da equipe; comissão na taxa dele
- [ ] Vendas da loja com coluna do vendedor; vê **todas** as vendas/comissões da loja
- [ ] Financeiro: **marcar comissão paga** (e reverter) reflete na hora
- [ ] Automatizado: `... psql ... < docs/superpowers/tests/c1_commission_manager_test.sql` → `✅ C1`

## 5. Gestor: troca de contexto (Plataforma ↔ Minha loja)
- [ ] Admin vê o seletor **"Plataforma ↔ Minha loja"** nos dois painéis
- [ ] "Minha loja" leva o admin ao `/painel` (badge "Garagista") sem relogin
- [ ] "Plataforma" volta ao `/dashboard`
- [ ] Garagista/vendedor **não** veem o seletor (UI inalterada)

## 6. Marketplace público (identidade = loja)
- [ ] `/` lista só veículos `available` de garagistas **ativos**
- [ ] `/veiculo/:id`: galeria, specs, card "Vendido por" (a **loja**) e WhatsApp
- [ ] `/loja/:slug`: banner, avatar, bio, catálogo, WhatsApp/Instagram da loja
- [ ] Veículo de loja **suspensa/pending** NÃO aparece na vitrine

## 7. Admin (plataforma)
- [ ] `/dashboard`: KPIs globais + alerta de pendentes (UI mantida)
- [ ] `/dashboard/sellers`: aprovar / suspender / reativar refletem na hora
- [ ] Editor de plano e "Ativar cobrança (ASAAS)" (ver seção 9)

## 8. Isolamento de dados (RLS) — 3 níveis
- [ ] Loja X ≠ Loja Y: `... psql ... < docs/superpowers/tests/a3_rls_test.sql` → `✅ A3`
- [ ] Vendedor A ≠ Vendedor B (mesma loja): `... psql ... < docs/superpowers/tests/f1_intra_loja_isolation_test.sql` → `✅ F1`
- [ ] Fluxo e2e convite→venda→comissão→baixa: `bash docs/superpowers/tests/f2_e2e_flow_test.sh` → `✅ F2`
- [ ] Logado como vendedor A, nenhuma tela do app traz dados de B nem de outra loja

## 9. Integração ASAAS (cobrança do plano) — requer secret
- [ ] `supabase functions deploy asaas-billing asaas-webhook` ok
- [ ] `ASAAS_API_KEY` + `ASAAS_ENV=sandbox` como secrets
- [ ] Ativar plano mensal cria assinatura; `taxa_unica` gera cobrança avulsa
- [ ] Webhook do ASAAS atualiza `status` em `rv_charges`
- [ ] Não-admin recebe 403 ao chamar `asaas-billing`
