# RESUME — Ponto de retomada (handoff entre sessões/usuários)

**Atualizado:** 2026-06-22

> Este arquivo é a fonte de verdade para retomar o trabalho em uma sessão nova
> (inclusive com OUTRO usuário do Claude Code, que não tem a memória pessoal da
> sessão anterior). Leia-o primeiro.

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
