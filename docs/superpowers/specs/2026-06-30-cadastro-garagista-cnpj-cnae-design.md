# Cadastro de garagista só-CNPJ com validação de CNAE

**Data:** 2026-06-30 · **Status:** aprovado (brainstorming) — pronto para plano de implementação

## 1. Contexto e objetivo

O auto-cadastro de garagista (`/cadastro-vendedor`, `src/features/auth/pages/CadastroVendedor.tsx`)
hoje pede 5 campos: **Nome/Loja, E-mail, Telefone, CPF/CNPJ, Cidade**. Os dados vão para a Edge
Function `signup-checkout`, que cria a cobrança no ASAAS e grava em `rv_pending_signups`; a conta
(`auth.user` + `rv_sellers`) só nasce no webhook quando o pagamento confirma (fluxo de criação
adiada — ver `2026-06-22-onboarding-criacao-adiada-design.md`).

**Duas mudanças:**

1. O campo passa a ser **apenas CNPJ** — só empresas podem se cadastrar.
2. **Consultar os CNAEs da empresa pelo CNPJ** e só permitir o cadastro se a empresa tiver pelo
   menos um CNAE do ramo automotivo (lista fechada de 11 abaixo).

## 2. Decisões de produto (do brainstorming, 2026-06-30)

- Campo **só CNPJ** (remove CPF).
- Provedor de consulta: **BrasilAPI** (`GET https://brasilapi.com.br/api/cnpj/v1/{cnpj}`),
  gratuita, sem chave. Sem fallback ReceitaWS (fora de escopo).
- Match de CNAE: aprova se o **CNAE principal OU qualquer secundário** estiver na lista permitida.
- A consulta **auto-preenche Nome e Cidade** (nome fantasia → razão social como fallback; município).
  Campos ficam editáveis.
- **Exige situação cadastral ATIVA** — bloqueia BAIXADA/SUSPENSA/INAPTA/NULA.
- Validação **automática** ao completar 14 dígitos do CNPJ.

## 3. CNAEs permitidos

Lista fechada (normalizada para 7 dígitos — a BrasilAPI devolve CNAE como inteiro, ex.: `4511101`):

| Código formatado | Normalizado | Atividade |
|---|---|---|
| 4511-1/01 | 4511101 | Comércio a varejo de automóveis, camionetas e utilitários novos |
| 4511-1/02 | 4511102 | Comércio a varejo de automóveis, camionetas e utilitários usados |
| 4511-1/03 | 4511103 | Comércio por atacado de automóveis, camionetas e utilitários novos e usados |
| 4511-1/04 | 4511104 | Representantes comerciais e agentes do comércio de veículos automotores |
| 4512-9/01 | 4512901 | Representantes comerciais e agentes do comércio de motocicletas/motonetas, peças e acessórios |
| 4512-9/02 | 4512902 | Comércio sob consignação de veículos automotores |
| 4512-9/03 | 4512903 | Comércio a varejo de motocicletas e motonetas novas |
| 4512-9/04 | 4512904 | Comércio a varejo de motocicletas e motonetas usadas |
| 4512-9/05 | 4512905 | Comércio por atacado de motocicletas e motonetas |
| 4512-9/06 | 4512906 | Comércio a varejo de peças e acessórios novos para motocicletas e motonetas |
| 4512-9/07 | 4512907 | Comércio a varejo de peças e acessórios usados para motocicletas e motonetas |

`ALLOWED_CNAES = {4511101, 4511102, 4511103, 4511104, 4512901, 4512902, 4512903, 4512904,
4512905, 4512906, 4512907}`

A comparação normaliza ambos os lados removendo não-dígitos (`String(codigo).replace(/\D/g,'')`),
cobrindo tanto o `cnae_fiscal` (inteiro) quanto `cnaes_secundarios[].codigo`.

## 4. Arquitetura — validação autoritativa no servidor

A regra mora no servidor (não burlável pelo frontend). Dois consumidores usam o **mesmo helper
compartilhado**:

### 4.1 `supabase/functions/_shared/cnpj.ts` (novo)

- `ALLOWED_CNAES: Set<string>` — os 7 dígitos da tabela acima.
- `lookupCnpj(cnpj: string): Promise<BrasilApiCnpj>` — normaliza 14 dígitos e faz
  `fetch(https://brasilapi.com.br/api/cnpj/v1/{cnpj})`. Erros de rede / 404 são tratados pelo chamador.
- `validateCnpj(data): { ok: boolean; reason?: 'not_found'|'inactive'|'cnae'; name; city; situacao }`
  - Coleta os CNAEs: `cnae_fiscal` + `cnaes_secundarios[].codigo`, normaliza, checa interseção com
    `ALLOWED_CNAES`.
  - Checa `descricao_situacao_cadastral` (ou `situacao_cadastral`) === ATIVA.
  - `name` = `nome_fantasia` ou `razao_social`; `city` = `municipio` (Title Case se vier em CAIXA ALTA).

### 4.2 `supabase/functions/cnpj-lookup/index.ts` (nova Edge Function, `verify_jwt=false`)

- Input: `{ cnpj }`.
- Normaliza para 14 dígitos; se não tiver 14 → 400 "CNPJ inválido."
- `lookupCnpj` → se 404/erro de rede → `{ ok:false, error:"CNPJ não encontrado na Receita." }`.
- `validateCnpj`:
  - `reason==='inactive'` → `{ ok:false, error:"Este CNPJ está {situacao}. Apenas empresas ativas podem se cadastrar." }`
  - `reason==='cnae'` → `{ ok:false, error:"A atividade da empresa não é elegível. O cadastro é exclusivo para lojas do ramo automotivo." }`
  - ok → `{ ok:true, name, city, razaoSocial, fantasia, municipio, uf }`.
- CORS como nas demais funções (reusa `_shared/cors.ts`).
- Usada pelo **frontend** para UX (auto-preencher + ok/erro).

### 4.3 `supabase/functions/signup-checkout/index.ts` (alterada)

- Body: `cpf_cnpj` → **`cnpj`** (lê `body.cnpj`).
- Após validar e-mail/plano e antes de criar customer/cobrança: `lookupCnpj` + `validateCnpj`;
  se reprovar → 400 com a mensagem correspondente (mesmo texto da 4.2). **Gate definitivo.**
- Usa `cnpj` (só dígitos) em `createCustomer({ cpfCnpj })`.
- Continua gravando em `rv_pending_signups.cpf_cnpj` (reuso da coluna, ver §5) com o CNPJ.

## 5. Banco de dados

**Sem migration.** Reuso as colunas existentes `rv_pending_signups.cpf_cnpj` e `rv_sellers.cpf_cnpj`
gravando o CNPJ (apenas dígitos, como já é hoje). Renomear coluna fica fora de escopo.

## 6. Frontend — `src/features/auth/pages/CadastroVendedor.tsx`

- Schema zod: remove `cpf_cnpj`; adiciona `cnpj` com 14 dígitos + dígitos verificadores válidos.
- Estado novo: `cnpjStatus: 'idle'|'loading'|'valid'|'invalid'`, `cnpjMsg: string|null`.
- `onChange` do CNPJ aplica `maskCnpj`; quando os dígitos chegam a 14, dispara `cnpj-lookup`:
  - `loading` durante a consulta.
  - `valid` → `setValue('name', data.name)`, `setValue('city', data.city)` (editáveis), libera o submit,
    mostra confirmação (ex.: razão social + município).
  - `invalid` → mostra `data.error`, mantém submit bloqueado.
  - Re-editar o CNPJ (≠14 dígitos) volta para `idle` e re-bloqueia.
- Botão de envio fica `disabled` enquanto `cnpjStatus !== 'valid'` (além do `isSubmitting`).
- Label "CPF / CNPJ" → **"CNPJ"**; placeholder `00.000.000/0000-00`; `inputMode="numeric"`.
- `onSubmit` envia `cnpj` (em vez de `cpf_cnpj`) no body do `signup-checkout`.

### 6.1 `src/lib/masks.ts`

- `maskCnpj(value)` → formata `00.000.000/0000-00` (trunca em 14 dígitos).
- `isValidCnpj(value)` → valida os 2 dígitos verificadores (rejeita sequências repetidas tipo
  `00000000000000`). Usada no schema zod.

## 7. Config / deploy

- `supabase/config.toml`: adicionar `[functions.cnpj-lookup]` com `verify_jwt = false`.
- Deploy: `supabase functions deploy cnpj-lookup signup-checkout`.

## 8. Erros e estados (resumo das mensagens)

- 14 dígitos incompletos / DV inválido → erro do zod no campo ("CNPJ inválido").
- CNPJ não encontrado → "CNPJ não encontrado na Receita."
- Situação ≠ ATIVA → "Este CNPJ está {situação}. Apenas empresas ativas podem se cadastrar."
- CNAE fora da lista → "A atividade da empresa não é elegível. O cadastro é exclusivo para lojas do
  ramo automotivo."
- BrasilAPI fora do ar / timeout → mensagem genérica "Não foi possível consultar o CNPJ agora.
  Tente novamente." (frontend mantém submit bloqueado).

## 9. Testes / verificação

- Helpers puros (`isValidCnpj`, normalização de CNAE, `validateCnpj`) checáveis por inspeção/teste.
- Front gate: `tsc -b` + `npm run build`.
- Edge (Deno): deploy + validação manual:
  1. CNPJ real do ramo automotivo, ATIVO → auto-preenche nome/cidade, libera, cadastra, vai ao ASAAS.
  2. CNPJ ativo mas sem CNAE da lista → bloqueado com a mensagem de elegibilidade.
  3. CNPJ inexistente/baixado → mensagens correspondentes.
  4. Tentar enviar direto ao `signup-checkout` com CNPJ inelegível (bypass do front) → 400.

## 10. Fora de escopo (agora)

- Fallback ReceitaWS e cache da consulta BrasilAPI.
- Renomear coluna `cpf_cnpj` → `cnpj` no banco.
- Revalidar CNPJ no `asaas-webhook` (cobrança só nasce após `signup-checkout` já ter validado).
- Cadastro manual de garagista pelo admin (não afetado).
