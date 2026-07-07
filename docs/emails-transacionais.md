# REVVIO 2.0 — Mapeamento de e-mails transacionais

Catálogo de todos os e-mails da plataforma. A coluna **Origem** indica quem dispara:

- **Auth nativo** — o Supabase Auth já envia (templates configuráveis no dashboard).
  Pode-se plugar o Resend como SMTP customizado do Auth para unificar remetente/branding.
- **ASAAS nativo** — o ASAAS já notifica o cliente sobre a cobrança (configurável na conta).
- **Resend custom** — evento de domínio nosso → Edge Function `send-email` com Resend.

Atores: **comprador/visitante**, **garagista** (seller), **gestor** (admin).

---

## A. Autenticação & conta
> Em geral já cobertos pelo Supabase Auth. Decisão: usar Resend como SMTP do Auth
> para padronizar identidade visual, ou manter os e-mails padrão do Supabase.

| # | Evento / gatilho | Destinatário | Conteúdo-chave | Origem | Prioridade |
|---|---|---|---|---|---|
| 1 | Confirmação de cadastro (verificar e-mail) | novo usuário | link de confirmação | Auth nativo | Alta |
| 2 | Recuperação de senha | usuário | link de reset | Auth nativo | Alta |
| 3 | Confirmação de alteração de e-mail | usuário | link de confirmação | Auth nativo | Média |
| 4 | Magic link / OTP (se habilitar login sem senha) | usuário | código/link | Auth nativo | Baixa |
| 5 | Senha alterada (alerta de segurança) | usuário | aviso + "não foi você?" | Resend custom | Média |
| 6 | Boas-vindas (após confirmar conta) | usuário | onboarding, próximos passos | Resend custom | Média |

## B. Ciclo do garagista (cadastro → aprovação)
> Núcleo do fluxo do escopo. Todos **Resend custom**.

| # | Evento / gatilho | Destinatário | Conteúdo-chave | Origem | Prioridade |
|---|---|---|---|---|---|
| 7 | Cadastro recebido / em análise | garagista | "recebemos, aguarde aprovação" | Resend custom | Alta |
| 8 | Novo vendedor para revisar | admin | dados + link p/ `/dashboard/sellers/:id` | Resend custom | Alta |
| 9 | Cadastro **aprovado** | garagista | acesso liberado + link `/painel` | Resend custom | Alta |
| 10 | Cadastro **rejeitado / suspenso** | garagista | motivo + contato | Resend custom | Alta |
| 11 | Conta **reativada** | garagista | acesso restaurado | Resend custom | Média |

## C. Operação — veículos & vendas
| # | Evento / gatilho | Destinatário | Conteúdo-chave | Origem | Prioridade |
|---|---|---|---|---|---|
| 12 | Veículo cadastrado | admin | qual veículo + vendedor | Resend custom | Média |
| 13 | Venda registrada (confirmação) | garagista | resumo da venda + comissão gerada | Resend custom | Média |
| 14 | Lead pela mini-loja (se houver form) | garagista | dados do interessado | Resend custom | Baixa¹ |

¹ Hoje o contato é WhatsApp direto; só vale se criarmos um formulário de lead.

## D. Financeiro & ASAAS (cobrança do garagista)
> ⚠️ O ASAAS **já envia** avisos de cobrança/vencimento/recebimento ao cliente.
> Decidir por evento: deixar o ASAAS notificar, OU centralizar no Resend (branding),
> OU os dois. Recomendo deixar o ASAAS cuidar de boleto/pix/vencimento e usar o
> Resend só para marcos de relacionamento (plano ativado, pagamento confirmado).

| # | Evento / gatilho | Destinatário | Conteúdo-chave | Origem | Prioridade |
|---|---|---|---|---|---|
| 15 | Plano ativado / assinatura criada | garagista | itens do plano + valores | Resend custom | Média |
| 16 | Nova cobrança gerada (fatura/boleto/pix) | garagista | link da fatura, vencimento | ASAAS nativo (default) | — |
| 17 | Pagamento confirmado / recebido | garagista | recibo | Resend custom (via webhook) | Média |
| 18 | Cobrança vencida (overdue) | garagista | lembrete + 2ª via | ASAAS nativo (default) | — |
| 19 | Plano cancelado | garagista | confirmação do cancelamento | Resend custom | Baixa |

## E. Admin / operacional (futuro)
| # | Evento / gatilho | Destinatário | Conteúdo-chave | Origem | Prioridade |
|---|---|---|---|---|---|
| 20 | Resumo periódico (digest) | admin | KPIs da semana | Resend custom | Baixa |
| 21 | Falha no webhook ASAAS / integração | admin | alerta técnico | Resend custom | Baixa |

---

## Como cada evento será disparado (arquitetura)

- **Mudanças de status do garagista (7–11)**: trigger no `rv_sellers` (AFTER INSERT/UPDATE
  de `status`) → chama a Edge Function `send-email` (via `pg_net`/webhook do banco), ou a
  própria UI do admin chama a função ao aprovar/suspender. Recomendo o **trigger no banco**
  para garantir o e-mail mesmo se a ação vier por outro caminho.
- **Veículo cadastrado / venda (12–13)**: trigger AFTER INSERT em `rv_vehicles` / `rv_sales`.
- **Pagamento confirmado (17)**: dentro do `asaas-webhook` já existente, ao receber
  `PAYMENT_RECEIVED/CONFIRMED`.
- **Auth (1–4)**: configurar no dashboard; opcionalmente Resend como SMTP do Auth.

## MVP sugerido (1ª leva a implementar na opção 2)
Itens **#7, #8, #9, #10** (ciclo de aprovação — o coração do escopo) + **#17** (pagamento
confirmado). O resto entra incremental.

## Decisões tomadas
1. **Auth (1–4)**: usar o **Resend como SMTP do Supabase Auth** (branding REVVIO).
2. **ASAAS (16, 18)**: **centralizar no Resend** — nossos próprios e-mails de cobrança,
   disparados pelo `asaas-webhook`. (Recomenda-se desligar as notificações nativas do
   ASAAS no painel para não duplicar.)
3. **Remetente**: `no-reply@revvio.com.br`.

## Status de implementação
- ✅ `send-email` (Edge Function) + templates Resend (#7–#13, #17, cobranças)
- ✅ Triggers no banco (`0007_email_triggers.sql`): #7, #8, #9, #10, #11, #12, #13
- ✅ `asaas-webhook` envia #16/#17/#18 conforme o evento ASAAS
- ⏳ Auth (1–4): configurar o SMTP no dashboard (passo manual abaixo)

## Setup (pós-deploy)

### 1. Secrets das funções
```bash
supabase secrets set RESEND_API_KEY=<key> \
  RESEND_FROM="REVVIO <no-reply@revvio.com.br>" \
  EMAIL_TRIGGER_SECRET=<segredo-forte> \
  APP_URL=https://<dominio-do-app>
supabase functions deploy send-email asaas-webhook
```

### 2. Apontar os triggers para a função (rodar 1x no SQL Editor)
```sql
insert into private.email_config (function_url, trigger_secret)
values ('https://<ref>.functions.supabase.co/send-email', '<EMAIL_TRIGGER_SECRET>')
on conflict (id) do update
  set function_url = excluded.function_url,
      trigger_secret = excluded.trigger_secret;
```
> O `trigger_secret` deve ser **idêntico** ao secret `EMAIL_TRIGGER_SECRET`.

### 3. Resend como SMTP do Auth (e-mails 1–4)
Dashboard → **Authentication → Emails/SMTP**, ativar SMTP customizado:
- Host `smtp.resend.com` · Porta `465` · User `resend` · Senha = `RESEND_API_KEY`
- Sender `no-reply@revvio.com.br`
- Personalizar os templates (confirmação, recuperação de senha, etc.)

### 4. Verificar o domínio no Resend
Adicionar `revvio.com.br` no Resend e configurar os registros DNS (SPF/DKIM).
**Sem isso, o Resend só envia para o e-mail dono da conta** (modo de teste).
