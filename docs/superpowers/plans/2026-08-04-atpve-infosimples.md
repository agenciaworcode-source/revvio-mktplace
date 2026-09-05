# Plano — Emissão de ATPV-e via API Infosimples (painel SuperAdmin)

**Data:** 2026-08-04
**Escopo:** integrar a API de automação de consultas da Infosimples para emitir,
consultar e imprimir a **ATPV-e / Intenção de Venda** direto do painel do SuperAdmin.

---

## 1. Decisões travadas com o cliente

| Ponto | Decisão |
|---|---|
| UF no lançamento | **SP (e-CRVsp)** funcionando; arquitetura de **adapter por UF** pronta para PR/outros |
| Credenciais DETRAN | **Conta central da Revvio** agora; schema já nasce com `loja_id` para credencial por loja |
| Conta Infosimples | Existe, mas **sem essas APIs contratadas** → implementar contra **mock fiel** + adapter; virar produção por variável de ambiente |

---

## 2. Descobertas técnicas (pesquisa da documentação pública)

### 2.1 Quais APIs existem hoje

| Serviço | Slug Infosimples | Situação |
|---|---|---|
| ATPV / Intenção de Venda — **Incluir** | `ecrvsp-atpv-incluir` | ✅ ativa (SP) |
| ATPV / Intenção de Venda — **Consultar** | `ecrvsp-atpv-consultar` | ✅ ativa (SP) |
| ATPV / Intenção de Venda — **Imprimir** (PDF) | `ecrvsp-atpv-imprimir` | ✅ ativa (SP) |
| DETRAN/PR — Registrar Intenção de Venda | `detran-pr-reg-intencao-venda` | ✅ ativa (PR) |
| DETRAN/MG — Emitir ATPV-e | `detran-mg-atpve` | ❌ **descontinuada** |

> A documentação **detalhada** (endpoint exato, tipos, exemplos de JSON, tabela de
> códigos) fica **atrás do login** em `api.infosimples.com/consultas/docs`. Tudo que
> está marcado com ⚠️ abaixo é **inferência a confirmar na Fase 0**.

### 2.2 Parâmetros de `ecrvsp-atpv-incluir` (confirmados na página pública)

**Autenticação no portal do DETRAN (não é o token da API):**
`login_cpf`, `login_senha`, **`a3`**, **`a3_pin`**

**Proprietário/vendedor:** `proprietario_cpf_cnpj`, `proprietario_email`
**Veículo:** `placa`, `renavam`, `chassi`, `hodometro`
**Comprador:** `comprador_nome`, `comprador_cpf_cnpj`, `comprador_email`,
`comprador_cep`, `comprador_logradouro`, `comprador_numero`, `comprador_complemento`,
`comprador_bairro`, `comprador_municipio`, `comprador_uf`
**Negócio:** `venda_valor`

**Resposta:** `mensagem`, `numero_atpve`

### 2.3 Demais operações

- `ecrvsp-atpv-consultar` → entrada `placa`, `renavam` + credenciais.
  Saída: `comunicacoes[]` (`comprador`, `intencao`) e `intencoes[]`
  (`assinatura`, `comprador`, `intencao`, `veiculo`).
- `ecrvsp-atpv-imprimir` → entrada `placa`, `renavam` + credenciais. Saída: `pdf_emitido`.

### 2.4 Convenções da API (⚠️ confirmar na Fase 0)

- Endpoint: `POST https://api.infosimples.com/api/v2/consultas/ecrvsp/atpv/incluir`
  (o slug do site mapeia para o caminho).
- Parâmetro `token` no corpo + `timeout` (a chamada é **síncrona e lenta**: automação
  de portal, dezenas de segundos).
- Envelope de resposta: `code`, `code_message`, `header`, `data_count`, `data[]`,
  `errors[]`, `site_receipts[]`.
- Faixas de código: `200` sucesso, `6xx` erro de consulta/site (parâmetro inválido,
  credencial inválida, site fora do ar, timeout, dado não encontrado), `7xx` erro de
  conta/token. **Parte dos erros é cobrada** — confirmar quais.

### 2.5 O maior risco: o certificado A3

**A Infosimples NÃO dispensa o certificado digital.** Isso foi verificado:

- O **DETRAN-SP** exige que despachantes e auxiliares acessem o e-CRVsp com
  **e-CPF (certificado digital)**. É regra do portal, não da Infosimples.
- A Infosimples **não tem integração oficial com o governo** — ela automatiza a
  navegação no portal. Quem loga continua sendo o titular do certificado.
- Prova no próprio contrato: `a3` + `a3_pin` aparecem em **todas** as APIs do
  e-CRVsp (`ecrvsp-processos-andamento`, `ecrvsp-estampagem-autorizacao`,
  `ecrvsp-docs-dados-cadastrais`, `ecrvsp-atpv-*`). Se fosse resolvido do lado
  deles, o parâmetro não existiria.

**O que a Infosimples resolve é o trabalho manual**, não a credencial: em vez de
alguém abrir o navegador, logar e preencher, o sistema dispara e recebe o
`numero_atpve` de volta.

**A pergunta em aberto não é "dá para não ter certificado" — é "dá para o
certificado ser em nuvem".** Confirmar com `suporte@infosimples.com.br` antes de
qualquer código:

1. O `a3` aceita **certificado A3 em nuvem** (BirdID / VIDaaS / Safeweb — assinatura
   via HSM, sem hardware)? Se sim, a emissão roda 100% no servidor.
2. Aceita **A1** (`.pfx` em base64) como alternativa?
3. Se só aceitar token/cartão físico, **qual o mecanismo** — máquina dedicada com a
   mídia plugada?
4. Existe ambiente de **homologação/sandbox**?

| Resposta | Consequência para o projeto |
|---|---|
| Aceita A3 em nuvem ou A1 | ✅ Plano segue como desenhado, emissão automática ponta a ponta |
| Só hardware físico | ⚠️ Plano B: fluxo assistido — o sistema monta e valida o payload, e a emissão final sai de uma máquina com a mídia plugada |

Por isso a Fase 0 é **bloqueante para as fases 4+**.

### 2.6 Certificado em mãos (2026-08-04) — e-CNPJ A1 da Revvio

O cliente já possui um certificado. Inspecionado, é:

| Campo | Valor |
|---|---|
| Tipo | **e-CNPJ A1** (`.pfx`), ICP-Brasil — não é A3, **não é e-CPF** |
| Titular | REVVIO LTDA — CNPJ 63.340.233/0001-53 |
| Responsável | Vinicius Giroto Jorge — CPF 433.364.988-99 |
| AC | AC SyngularID Múltipla (emissão por videoconferência) |
| Validade | 29/07/2026 → 29/07/2027 |
| EKU | E-mail Seguro + Autenticação de Cliente (serve para mTLS) |

**O que ele resolve:** o risco de "mídia física" cai. É arquivo, tem chave privada
exportável, cabe no Supabase Vault e roda no servidor sem token plugado. A pergunta 3
da lista acima (token físico) deixa de ser problema **para este certificado**.

**O que ele NÃO resolve — e é o ponto central:**

1. É **PJ, não e-CPF**. A descoberta 2.5 é que o e-CRVsp exige e-CPF de despachante.
2. **Evidência forte no próprio contrato da API:** o parâmetro de login é
   `login_cpf` — **CPF, não CPF/CNPJ** (ver 2.2). O portal loga pessoa física.
   Um e-CNPJ tende a ser rejeitado no login, mesmo tendo o CPF do responsável
   embutido no SAN.
3. **Certificado ≠ acesso.** Continua faltando cadastro no e-CRVsp + contrato de TI
   com a PRODESP. Isso não mudou em nada.

**Pergunta nova que este certificado abre (Rota C — não verificada):** o e-CRVsp tem
perfis de credenciamento além de despachante (revenda/loja de veículos, financeira,
leiloeiro). **Se** uma empresa do setor automotivo puder se credenciar como revenda e
operar com e-CNPJ, a Rota B (parceria com despachante) deixa de ser necessária — cada
garagista, ou a Revvio, opera com o próprio CNPJ. **Isso é hipótese, não fato:
confirmar com o DETRAN-SP/PRODESP antes de contar com ela.**

**Custo de errar caiu:** A1 vale 1 ano e já foi comprado. O alerta original de
"queimar 1–3 anos de validade" era sobre A3 e não se aplica aqui.

⚠️ **Segurança:** o `.pfx` estava em `Downloads` com a senha no nome do arquivo
(`123456`). Esse certificado assina como a REVVIO LTDA (e-CAC, Receita, NF-e, atos
societários). Antes de qualquer uso: reexportar com senha forte, tirar de `Downloads`,
**nunca** commitar no repo, e guardar exclusivamente no Vault (Fase 2).

---

## 3. Estado atual do sistema (o que falta no domínio)

Levantamento no código:

- `rv_vehicles` **não tem** `placa`, `renavam`, `chassi` nem `hodometro`.
- `rv_sales` guarda só `buyer_name` + `buyer_phone` — **sem CPF, e-mail ou endereço**.
- `rv_vehicle_owners` tem só `owner_name` / `owner_phone` — **sem CPF do proprietário**.
- ✅ **`rv_contracts` (migration 0047) já tem quase tudo**: `vehicle_plate`,
  `vehicle_renavam`, `vehicle_chassi`, `vendedor_cpf_cnpj`, `comprador_cpf_cnpj`,
  `comprador_address`, `sale_value`. É admin-only e é o **ponto de partida natural**
  da emissão.

**Conclusão de arquitetura:** a ATPV-e nasce **a partir de um contrato de compra e
venda já emitido** no painel — não a partir do anúncio. Isso evita duplicar cadastro
de PII e reaproveita um fluxo que o SuperAdmin já usa. Os campos que faltam
(`hodometro`, e-mails, endereço estruturado do comprador) entram como complemento
no formulário de emissão.

---

## 4. Arquitetura proposta

```
Painel SuperAdmin (React)
  └─ /dashboard/atpve  +  botão "Emitir ATPV-e" no ContractSheet
        │ supabase.functions.invoke
        ▼
  Edge Function  atpve-emit        (verify_jwt = true, admin-only)
        │  1. valida payload (zod)
        │  2. cria rv_atpve_emissions status=queued (idempotency_key)
        │  3. responde 202 imediatamente
        │  4. EdgeRuntime.waitUntil(processa em background)
        ▼
  _shared/atpve/registry.ts  →  adapter por UF
        ├─ sp-ecrvsp.ts   (incluir / consultar / imprimir)
        └─ pr-detran.ts   (stub, fase futura)
        ▼
  _shared/infosimples.ts   client HTTP genérico
        │ token, timeout, envelope, mapa de códigos, modo mock|live
        ▼
  api.infosimples.com  ──►  e-CRVsp (DETRAN-SP)
        │
        ▼
  rv_atpve_emissions (status/numero_atpve/pdf_path/custo/erro)
  Storage bucket privado  atpve-docs/
        │
        ▼
  Realtime → UI atualiza sozinha quando a emissão conclui
```

**Por que assíncrono:** a automação de portal pode levar **minutos**, e a Edge
Function tem teto de wall-clock. Enfileirar + processar em background + Realtime é
o único desenho que não estoura timeout nem trava a UI.

---

## 5. Banco de dados

### `rv_detran_credentials` — cofre de credenciais
```sql
create type detran_provider as enum ('ecrvsp_sp', 'detran_pr');

create table public.rv_detran_credentials (
  id            uuid primary key default gen_random_uuid(),
  provider      detran_provider not null,
  loja_id       uuid references public.rv_sellers(id) on delete cascade, -- null = credencial global da Revvio
  label         text not null,
  login_cpf     text not null,
  secret_ref    text not null,   -- ponteiro para o Supabase Vault (senha, a3, a3_pin)
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index on rv_detran_credentials (provider, coalesce(loja_id,'00000000-0000-0000-0000-000000000000'::uuid)) where active;
```
- **Nenhum segredo em coluna comum.** Senha, `a3` e `a3_pin` vão para o **Supabase
  Vault**; a tabela guarda só o ponteiro.
- RLS: `for all using (public.is_admin())` — e nunca expor `secret_ref` ao cliente.
- `loja_id` nulo hoje (conta central) → a fase "por loja" não exige migration nova.

### `rv_atpve_emissions` — ciclo de vida da emissão
```sql
create type atpve_status as enum
  ('queued','processing','issued','failed','cancelled');

create table public.rv_atpve_emissions (
  id               uuid primary key default gen_random_uuid(),
  contract_id      uuid references public.rv_contracts(id) on delete set null,
  sale_id          uuid references public.rv_sales(id) on delete set null,
  vehicle_id       bigint references public.rv_vehicles(id) on delete set null,
  provider         detran_provider not null,
  uf               varchar(2) not null,
  status           atpve_status not null default 'queued',

  -- espelho do que foi enviado (sem credenciais, CPF mascarado no log)
  placa            varchar(10) not null,
  renavam          varchar(20) not null,
  chassi           varchar(30),
  hodometro        integer,
  venda_valor      numeric(12,2) not null,
  proprietario_cpf_cnpj text not null,
  comprador_cpf_cnpj    text not null,
  comprador_nome        text not null,
  request_payload  jsonb not null default '{}',   -- sem segredos

  -- retorno
  numero_atpve     text,
  provider_code    integer,
  provider_message text,
  raw_response     jsonb,
  site_receipts    text[] not null default '{}',
  pdf_path         text,                          -- bucket atpve-docs
  cost             numeric(10,2),                 -- custo cobrado pela chamada

  idempotency_key  text not null unique,
  attempts         smallint not null default 0,
  created_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- trava dura: um veículo não pode ter duas ATPV-e vivas
create unique index uq_atpve_ativa on rv_atpve_emissions (placa, renavam)
  where status in ('queued','processing','issued');
```
- RLS admin-only (mesmo padrão de `rv_contracts`).
- Bucket **privado** `atpve-docs`, leitura só admin, PDF servido por signed URL.
- Tabela `rv_atpve_events` (append-only) para auditoria de cada transição.

**Idempotência é requisito de segurança, não de conforto:** ATPV-e é documento
oficial, e emitir duas vezes o mesmo veículo é um problema real no DETRAN.
`idempotency_key = sha256(provider|placa|renavam|comprador_cpf|venda_valor)` +
índice único parcial + botão bloqueado enquanto houver emissão viva.

---

## 6. Fases de execução

### Fase 0 — Descoberta do contrato real (**bloqueante**)
1. Contratar/liberar as 3 APIs `ecrvsp-atpv-*` na conta Infosimples.
2. Baixar da área logada: endpoint exato, tabela de códigos, exemplo de request e
   response de cada uma, política de cobrança por código, limite de `timeout`.
3. Perguntar ao suporte (`suporte@infosimples.com.br`) as 3 questões do §2.5 (A3).
4. **Saída:** `docs/integracoes/infosimples-ecrvsp.md` com os contratos reais +
   fixtures JSON em `supabase/functions/_shared/atpve/__fixtures__/`.

> Enquanto a Fase 0 não fecha, as fases 1–3 rodam normalmente (não dependem do
> contrato exato). As fases 4+ consomem as fixtures.

### Fase 0-B — Acesso ao e-CRVsp (**bloqueante — provavelmente domina o cronograma**)

**Certificado digital sozinho NÃO abre o e-CRVsp.** São três exigências separadas:

1. **e-CPF ICP-Brasil** — comprado em qualquer AC (Certisign, Serasa Experian, Valid,
   Soluti, SafeWeb, AC Digital, sindicatos contábeis). Validação por **videoconferência**
   ou presencial, com CPF + RG/CNH + comprovante de endereço. Emissão na hora.
2. **Cadastro de despachante no e-CRVsp** — serviço "Solicitar Cadastro de Despachante
   ao e-CRVsp" no portal de serviços do estado de SP.
3. **Contrato de prestação de serviços de TI com a PRODESP** — adesão a qualquer tempo,
   acesso liberado automaticamente após a assinatura.

Ser **despachante credenciado no DETRAN-SP** é profissão regulamentada com
credenciamento próprio — não é qualquer loja que consegue.

**Preços do e-CPF (2026, confirmar na compra):**

| Tipo | Validade | Faixa |
|---|---|---|
| A3 **em nuvem** | 12 meses | ~R$ 146 |
| A3 **em nuvem** | 36 meses | ~R$ 250 |
| A1 (`.pfx`) | 12 meses | ~R$ 110–200 |
| A3 token físico | 36 meses | ~R$ 250 + R$ 150–250 da mídia |

⚠️ **Não comprar o certificado antes da resposta da Fase 0** sobre o formato aceito no
parâmetro `a3`. Errar o formato queima o dinheiro e 1–3 anos de validade.

**Duas rotas de negócio:**

| Rota | Como | Prazo | Trade-off |
|---|---|---|---|
| **A** — Revvio se credencia | Certificado + cadastro + PRODESP em nome da Revvio | Meses (burocracia de despachante) | Controle total, custo/emissão menor, escala |
| **B** — parceria com despachante | Ele já tem certificado + credenciamento; a Revvio automatiza e paga por emissão/mensalidade | Semanas | Dependência de terceiro; **quem responde perante o DETRAN é o titular do certificado** — tem que estar no contrato |

**Recomendação:** Rota B para lançar, Rota A depois se o volume justificar.
A arquitetura suporta as duas sem retrabalho: `rv_detran_credentials` tem `loja_id`
nulável, então "credencial do despachante parceiro" e "credencial da Revvio" são o
mesmo mecanismo — trocar de rota é trocar um registro no cofre.

**Ordem correta:** (1) perguntar à Infosimples sobre o `a3` → (2) decidir rota A/B →
(3) **só então** comprar o certificado no formato certo → (4) cadastro + PRODESP (se A).

Itens 1 e 2 são conversa, não código. As Fases 1–3 rodam em paralelo sem depender deles.

### Fase 1 — Domínio: dados oficiais do veículo
- Migration `0052_vehicle_documento.sql`: `placa`, `renavam`, `chassi`, `hodometro`
  em `rv_vehicles` (todos opcionais; anúncios antigos ficam nulos).
- `rv_vehicle_owners`: `owner_cpf_cnpj`, `owner_email`.
- Nunca expor placa/renavam/chassi ao público: revisar as policies e as queries do
  catálogo (`Storefront`, `/comprar`) para não vazar em `select *`.
- UI: campos no cadastro de veículo do garagista, com máscaras
  (`src/lib/masks.ts` já tem a base) e validação de placa (antiga + Mercosul).
- **Verificação:** `npx tsc -b` + `npm run build` + inspeção de que a listagem
  pública não retorna os novos campos.

### Fase 2 — Cofre de credenciais
- Migration `0053_detran_credentials.sql` (tabela acima + RLS + Vault).
- Secrets: `INFOSIMPLES_TOKEN`, `INFOSIMPLES_MODE` (`mock|live`),
  `ECRVSP_LOGIN_CPF`, `ECRVSP_LOGIN_SENHA`, `ECRVSP_A3`, `ECRVSP_A3_PIN`.
- Tela `/dashboard/atpve/credenciais` (admin): cadastrar/rotacionar, **nunca ler de
  volta o segredo** — só mostra `label`, últimos dígitos e status.
- Botão "Testar credencial" → chamada barata de `consultar` para validar login.
- **Verificação:** tentar ler a credencial com JWT de garagista → deve dar 0 linhas.

### Fase 3 — Client + adapter + mock
- `_shared/infosimples.ts`: `callInfosimples(path, params, opts)` — injeta token,
  aplica `timeout`, normaliza o envelope, mapeia `code` → erro tipado
  (`InfosimplesError` com `retryable: boolean`), registra custo.
- `_shared/atpve/types.ts`: contrato interno neutro de UF
  (`AtpveEmitInput`, `AtpveEmitResult`, `AtpveQueryResult`).
- `_shared/atpve/sp-ecrvsp.ts`: mapeia o contrato interno ↔ parâmetros do e-CRVsp.
- `_shared/atpve/registry.ts`: `getAdapter(uf)`; `pr-detran.ts` como stub que lança
  "UF não suportada".
- **Modo mock** (`INFOSIMPLES_MODE=mock`): responde pelas fixtures, incluindo os
  caminhos de erro (credencial inválida, site fora, veículo com restrição).
- **Verificação:** rodar a function local nos dois modos e conferir os dois caminhos.

### Fase 4 — Edge Functions
- `atpve-emit` (`verify_jwt = true`): valida admin via JWT → zod no payload →
  grava `queued` → responde 202 → `EdgeRuntime.waitUntil` processa, atualiza para
  `issued`/`failed`, grava `numero_atpve`, `raw_response`, `cost`, `site_receipts`.
- `atpve-status`: reconsulta o DETRAN (`consultar`) e reconcilia o registro local —
  rede de segurança para quando a resposta se perde no meio.
- `atpve-pdf`: chama `imprimir`, salva no bucket `atpve-docs`, devolve signed URL.
- `config.toml`: as três com `verify_jwt = true`.
- Retry só para erros marcados `retryable` (site fora / timeout), com backoff e
  `attempts` limitado a 3. **Erro de dado nunca dá retry automático.**
- **Verificação:** emitir em mock ponta a ponta; forçar cada código de erro;
  disparar a mesma emissão duas vezes e confirmar que a segunda é rejeitada.

### Fase 5 — UI do SuperAdmin
- Nova entrada no `AdminLayout`: **"ATPV-e"** (`/dashboard/atpve`, ícone `file`).
- **Listagem**: filtros por status, placa, data, loja; badge de status; custo total
  do período; link para o PDF e para os `site_receipts`.
- **Emissão**: botão **"Emitir ATPV-e"** dentro do `ContractSheet` de um contrato de
  `compra_venda` — pré-preenche vendedor/comprador/veículo/valor e pede só o que
  falta (`hodometro`, e-mails, endereço estruturado do comprador).
- Modal de confirmação explícito: "Este documento é oficial e será emitido no
  DETRAN-SP. Confira os dados." + resumo antes do envio.
- Estado ao vivo via **Supabase Realtime** em `rv_atpve_emissions` (o projeto já tem
  Realtime configurado na migration 0011).
- Erros traduzidos para linguagem de operação — nunca mostrar `code_message` cru.
- **Verificação:** `npm run build` + walkthrough manual do fluxo em mock.

### Fase 6 — Consultar e Imprimir
- Aba "Consultar por placa" (roda `ecrvsp-atpv-consultar` avulso, sem emitir).
- Botão "Baixar ATPV-e" nas emissões `issued` → `atpve-pdf` → signed URL.
- Reprocessar PDF quando o download anterior falhou.

### Fase 7 — Operação, custo e QA
- Página de custos: soma de `cost` por período/loja (a API é cobrada por chamada,
  e **parte dos erros também é cobrada**).
- Alerta de saldo/erro `7xx` (token inválido, saldo insuficiente) por e-mail ao
  admin, reaproveitando `send-email`.
- LGPD: `raw_response` com CPF **mascarado** no que for logado; retenção definida;
  bucket privado; acesso só admin.
- Atualizar `docs/QA-checklist.md`, `docs/permissoes.md` e `docs/GO-LIVE.md`
  (novos secrets + deploy das 3 functions).

---

## 7. Riscos e mitigação

| Risco | Impacto | Mitigação |
|---|---|---|
| **A3 só aceita hardware físico** (a Infosimples não dispensa o certificado — §2.5) | Mata a emissão 100% em nuvem | Fase 0 bloqueante com o suporte; plano B = fluxo assistido (o sistema monta e valida o payload, o despachante finaliza na máquina com a mídia) |
| Emissão duplicada de documento oficial | Alto — problema no DETRAN | `idempotency_key` único + índice parcial + trava de UI + reconciliação via `consultar` |
| Chamada lenta (minutos) estourando a Edge Function | Emissão "perdida" | Desenho assíncrono + `atpve-status` para reconciliar |
| Portal do DETRAN muda e quebra a automação | Emissões falhando em lote | Erros tipados, alerta ao admin, adapter isolado (muda 1 arquivo) |
| Custo por chamada, inclusive em erro | Financeiro | Coluna `cost`, painel de custos, sem retry em erro de dado |
| PII (CPF, endereço, e-mail) em nova superfície | LGPD | RLS admin-only, Vault, bucket privado, mascaramento em log |
| Credencial DETRAN vazando | Crítico | Vault, nunca devolver segredo ao cliente, rotação pela UI |

---

## 8. Fora de escopo nesta entrega

- Emissão por garagista (fica só no SuperAdmin; o schema já suporta).
- UFs além de SP (adapter pronto, `pr-detran.ts` é stub).
- Assinatura digital do comprador (é fluxo do próprio DETRAN, fora da API).
- Comunicação de venda "legada" (o ATPV-e já cumpre esse papel no e-CRVsp).

---

## 9. Ordem de execução recomendada

```
Fase 0   (contrato da API + pergunta do A3)  ─┐
Fase 0-B (certificado + credenciamento e-CRVsp) ─┤ bloqueiam a Fase 4+
   │                                             │
Fase 1 ──► Fase 2 ──► Fase 3 ──────────────────►─┴─► Fase 4 ──► 5 ──► 6 ──► 7
```

Fases 1–3 podem começar **hoje**, sem depender nem da liberação das APIs nem do
credenciamento. A **Fase 0-B provavelmente domina o cronograma** e deve ser iniciada
antes de qualquer linha de código.
