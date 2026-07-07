# REVVIO 2.0 — Go-live (Fase 6)

Passos para colocar em produção, na ordem.

## 1. Banco
- [ ] Aplicar migrations `0001`→`0011` no projeto de produção (em ordem)
- [ ] Rodar `seed.sql` com o e-mail real do admin (ou promover via Dashboard)
- [ ] Confirmar RLS habilitado em todas as tabelas `rv_*` (já vem nas migrations)
- [ ] Rodar `docs/rls-isolation-test.sql` apontando para 2 contas de teste
- [ ] Habilitar a extensão **pg_cron** no Dashboard → a `0010` agenda a varredura
      `mark_overdue_commissions()` (sem pg_cron, chame a RPC manualmente/por job externo)
- [ ] Confirmar que o **Realtime** está ligado (a `0011` adiciona `rv_vehicles` e
      `rv_sellers` à publication `supabase_realtime`)

## 2. Tipos (recomendado antes do build final)
- [x] `npm run types:gen` → gera `src/lib/database.generated.ts` (tipos reais do banco).
      Os aliases (`Seller`, `Vehicle`, …) ficam em `database.types.ts`, escrito à mão,
      que re-exporta o gerado — regenerar os tipos não apaga mais os aliases.

## 3. Storage
- [ ] Buckets `avatars`, `banners`, `vehicle-images` existem (criados em `0005`)
- [ ] Upload testado: arquivo cai em `<seller_id>/...` e a URL pública abre

## 4. Edge Functions + ASAAS
- [ ] `supabase functions deploy asaas-billing asaas-webhook`
- [ ] Secrets: `ASAAS_API_KEY`, `ASAAS_ENV=production`, `ASAAS_WEBHOOK_TOKEN`
- [ ] `config.toml`: `asaas-webhook` com `verify_jwt = false` (já configurado)
- [ ] Webhook no painel ASAAS → `https://<project>.functions.supabase.co/asaas-webhook`
      com header `asaas-access-token` = `ASAAS_WEBHOOK_TOKEN`
- [ ] Teste sandbox completo antes de virar a chave para produção

## 5. Auth
- [x] Confirmação de e-mail tratada nos dois modos: o cadastro guarda os dados em
      `user_metadata`; se a confirmação estiver LIGADA, o `AuthProvider` recria o
      `rv_sellers` a partir dos metadados no primeiro login (idempotente). Sem mais
      "usuário preso" após confirmar o e-mail.
- [ ] `site_url` e `additional_redirect_urls` apontando para o domínio de produção

## 6. Frontend
- [ ] `.env` de produção com URL + anon key do projeto cloud
- [ ] `npm run build` sem erros; publicar `dist/` (Vercel/Netlify/etc.)
- [ ] SPA fallback (todas as rotas → `index.html`) configurado no host

## 7. Smoke test em produção
- [ ] Fluxo: cadastro → aprovação admin → cadastro de veículo → venda → comissão
- [ ] Vitrine pública e mini-loja abrindo e com WhatsApp funcional
- [ ] Cobrança ASAAS real (1 ciclo) confirmada via webhook

## Pendências técnicas conhecidas
- Bundle: rotas com code-splitting (`lazy`/`Suspense`); chunk inicial ~418 kB. OK.
- Por decisão de negócio, **a única receita da plataforma são os planos (ASAAS)**.
  A comissão por venda (`register_sale`) é gerenciamento financeiro do garagista e
  NÃO gera cobrança ASAAS — comportamento intencional, não pendência.
