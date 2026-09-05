# RESUME — Ponto de retomada (handoff entre sessões/usuários)

**Atualizado:** 2026-08-04

> Este arquivo é a fonte de verdade para retomar o trabalho em uma sessão nova
> (inclusive com OUTRO usuário do Claude Code, que não tem a memória pessoal da
> sessão anterior). Leia-o primeiro.

---

# 🔴 ONDE PARAMOS AGORA (2026-08-04) — ATPV-e / Infosimples

**Status: PAUSADO na fase de planejamento. NENHUM código foi escrito.**
Não há migration nova, nem Edge Function, nem alteração em `src/`. O único artefato
produzido é o plano.

**Leia primeiro:** `docs/superpowers/plans/2026-08-04-atpve-infosimples.md`

## O objetivo

Emitir **ATPV-e (Autorização de Transferência de Propriedade Veicular)** direto do
painel do SuperAdmin, via a **API de automação de consultas da Infosimples**.

## Decisões já travadas com o cliente

| Ponto | Decisão |
|---|---|
| UF | **SP (e-CRVsp)** no lançamento; arquitetura de adapter por UF pronta para PR/outros |
| Credenciais DETRAN | **Conta central da Revvio**; schema já nasce com `loja_id` para credencial por loja depois |
| Conta Infosimples | Existe, mas **sem as APIs `ecrvsp-atpv-*` contratadas** → construir contra mock fiel, virar produção por env |

## Descobertas que mudam o projeto

1. **`rv_contracts` (migration 0047) já tem quase tudo** que a ATPV-e precisa:
   `vehicle_plate`, `vehicle_renavam`, `vehicle_chassi`, CPF/CNPJ das duas partes,
   `sale_value`. **A emissão nasce de um contrato de compra e venda**, não do anúncio.
   Falta só `hodometro`, e-mails e endereço estruturado do comprador.
2. **`rv_vehicles` não tem nenhum dado veicular oficial** — sem `placa`, `renavam`,
   `chassi`, `hodometro`. `rv_sales` só tem `buyer_name` + `buyer_phone`.
   Boa parte do trabalho é **modelo de dados**, não integração.
3. **A Infosimples NÃO dispensa o certificado digital.** Verificado: `a3` + `a3_pin`
   aparecem em **todas** as APIs do e-CRVsp. O DETRAN-SP exige e-CPF de despachante —
   é regra do portal. A Infosimples automatiza a navegação, não substitui a credencial.
4. **Certificado sozinho não abre o e-CRVsp.** Também exige cadastro de despachante no
   e-CRVsp **+ contrato de TI com a PRODESP**, e ser despachante credenciado é
   profissão regulamentada. **Esse é o item que domina o cronograma.**
5. APIs vivas: `ecrvsp-atpv-incluir` / `-consultar` / `-imprimir` (SP) e
   `detran-pr-reg-intencao-venda` (PR). A de **MG foi descontinuada**.
6. **(2026-08-04) O cliente JÁ TEM um certificado — mas é e-CNPJ A1 da REVVIO LTDA**
   (63.340.233/0001-53, resp. Vinicius Giroto Jorge, val. até 29/07/2027), **não é
   e-CPF de despachante**. Detalhes na seção 2.6 do plano. Bom: é arquivo `.pfx`,
   cabe no Vault, sem token físico. Ruim: o parâmetro de login da API é `login_cpf`
   (CPF, não CNPJ) — o portal loga pessoa física, então este certificado
   provavelmente **não** abre o e-CRVsp. E continua faltando o credenciamento.

## Próximos passos — NENHUM é código

1. **Perguntar ao `suporte@infosimples.com.br`:** o parâmetro `a3` aceita **e-CNPJ A1
   `.pfx`** (é o que temos em mãos)? Aceita **A3 em nuvem** (BirdID/VIDaaS/SafeWeb)?
   O `login_cpf` aceita o CPF do responsável com um certificado PJ, ou exige e-CPF?
   Existe sandbox?
2. **Perguntar ao DETRAN-SP/PRODESP (novo — Rota C):** uma **revenda/loja de veículos**
   pode se credenciar no e-CRVsp e emitir ATPV-e com **e-CNPJ**, sem despachante?
   Se sim, mata a necessidade da Rota B e o certificado que já temos serve.
3. **Decidir a rota de credenciamento** (Fase 0-B do plano):
   **Rota A** = Revvio se credencia como despachante (meses) ·
   **Rota B** = parceria com despachante que já tem tudo (semanas) ·
   **Rota C** = credenciar o CNPJ como revenda (depende da resposta do item 2).
   **Recomendação: aguardar o item 2 antes de fechar. Rota B segue como plano de
   contingência.** Atenção contratual: quem responde perante o DETRAN é o titular.
4. **Não comprar e-CPF ainda** — só se os itens 1 e 2 confirmarem que é necessário.
5. Contratar as APIs `ecrvsp-atpv-*` na conta Infosimples.
6. ⚠️ **Segurança do `.pfx`:** está em `Downloads` com a senha no nome do arquivo.
   Reexportar com senha forte, mover, nunca commitar, guardar só no Vault (Fase 2).

## Se for retomar pelo código

As **Fases 1 a 3** do plano não dependem de nada acima e podem começar a qualquer
momento: (1) dados oficiais do veículo no schema, (2) cofre de credenciais no Supabase
Vault, (3) client Infosimples + adapter SP + modo mock.

---

# Histórico anterior (2026-06-22) — Nova home

## Onde paramos

A **nova home (landing pública)** está **CONCLUÍDA e mesclada em `main`** (merge `--no-ff`,
HEAD `e8533b9`, 2026-06-22). Foi executada via **superpowers:subagent-driven-development**
(1 subagente implementador + review por task), mais um ajuste de feedback do cliente.

- Plano executado: `docs/superpowers/plans/2026-06-22-home-landing-publica.md` (7 tasks).
- Spec: `docs/superpowers/specs/2026-06-22-home-landing-publica-design.md`.
- Ledger da execução: `.superpowers/sdd/progress.md` (seção "Nova Home").

## O que entrou

- `/` virou landing (faixa de contato → header claro → Hero+Busca Rápida → Anunciar (planos do
  `rv_pricing_plans`) → Marcas (logos de `public/marcas/`) → Quem Somos → footer).
- Grade de veículos foi para `/comprar` (lê `?q`/`?marca` da URL). Badge da loja no card (#7).
  Casca pública compartilhada: `PublicShell`/`PublicHeader`/`PublicFooter`.
- **Banner da home gerenciável pelo superadmin** (pedido do cliente, fora do plano original):
  tabela singleton `rv_site_settings(home_banner_url)`, página `/dashboard/aparencia` com upload
  (bucket `banners`, pasta `home/`), home consome a URL com fallback ao SVG placeholder.
- Fix de layout: a Busca Rápida não fica mais coberta pelo banner. Validação de upload (imagem/5MB).
- `VehicleCard` NÃO foi removido (não era órfão — usado em `Storefront.tsx`).

Reviews: todos os per-task ✅; review final da landing ✅ *Ready to merge*; review do banner
(RLS/storage) ✅ *Ready to merge*, 0 Critical.

## Banco (REMOTO)

- **Migration `0020_site_settings.sql` JÁ APLICADA NO REMOTO** e verificada (singleton; `anon` lê;
  RLS public-read/admin-write; storage policy do admin na pasta `home/` do bucket `banners`).
- Types regenerados do remoto (`src/lib/database.generated.ts`). A regen trouxe objetos remotos
  fora das migrations locais (`leads`, `iceberg_*`, `mark_overdue_commissions`) — drift do projeto
  remoto, inofensivo para os tipos.

## Pendências (não bloqueiam)

- Minors diferidos: breadcrumb "Lojas" do `Storefront` aponta para `/` (landing, sem listagem de
  lojas) — relabelar/repontar; extrair uma const `CONTACT` (email/whatsapp duplicados em
  `PublicHeader`/`PublicFooter`); race no upload do banner (single-admin, mitigado por `isPending`).
- Ops paralelas: deployar Edge Functions ao remoto (`invite-vendedor`, `send-email`); rotacionar a
  senha do banco (exposta no chat) e atualizar `SUPABASE_DB_URL`; deployar a migration 0019 (fix RLS
  team_read) em staging/prod se ainda pendente.

## Contexto crítico do ambiente

- **Validar SEMPRE contra o Supabase REMOTO** (`.env.local` → `VITE_SUPABASE_URL` =
  `ahtisetxygjyfvhguckl.supabase.co`). SQL no remoto via
  `docker exec -i $(docker ps -qf name=supabase_db) psql "$SUPABASE_DB_URL"`.
  Regenerar types do remoto: `npx supabase gen types typescript --db-url "$SUPABASE_DB_URL" > src/lib/database.generated.ts`.
- Sem runner unitário: verificação por `npx tsc -b` + `npm run build`.
