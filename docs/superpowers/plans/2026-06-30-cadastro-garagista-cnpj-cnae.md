# Cadastro de garagista só-CNPJ com validação de CNAE — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar o campo CPF/CNPJ do auto-cadastro de garagista por **apenas CNPJ**, validando pela BrasilAPI que a empresa está ATIVA e tem ao menos um CNAE (principal ou secundário) do ramo automotivo; auto-preencher nome e cidade.

**Architecture:** A regra mora no servidor (helper Deno compartilhado `_shared/cnpj.ts`). Uma nova Edge Function pública `cnpj-lookup` usa esse helper para a UX do frontend (auto-preencher + ok/erro), e a `signup-checkout` re-valida com o mesmo helper antes de criar a cobrança (gate definitivo). O frontend (`CadastroVendedor.tsx`) consulta `cnpj-lookup` quando o CNPJ atinge 14 dígitos.

**Tech Stack:** React + react-hook-form + zod + Vite (front, TS); Supabase Edge Functions (Deno/TS); BrasilAPI (`GET https://brasilapi.com.br/api/cnpj/v1/{cnpj}`); ASAAS (já existente).

## Global Constraints

- **Sem runner de testes no front** — gate é `tsc -b` + `npm run build` (rodar de `/home/israel/Documentos/2026 RaiTechLabs/revvio`).
- **Edge Functions (Deno):** verificadas por `deno check` (se disponível) + deploy + validação manual no remoto (`supabase functions deploy <fn>`).
- **CNAEs permitidos (7 dígitos):** `4511101, 4511102, 4511103, 4511104, 4512901, 4512902, 4512903, 4512904, 4512905, 4512906, 4512907`.
- **Provedor:** BrasilAPI, sem chave. Sem fallback ReceitaWS.
- **Match CNAE:** principal (`cnae_fiscal`) OU qualquer secundário (`cnaes_secundarios[].codigo`).
- **Sem migration** — reuso da coluna `rv_pending_signups.cpf_cnpj` gravando o CNPJ (só dígitos).
- **Mensagens de erro (verbatim):**
  - Não encontrado: `"CNPJ não encontrado na Receita."`
  - Inativo: `` `Este CNPJ está ${situacao}. Apenas empresas ativas podem se cadastrar.` ``
  - CNAE fora: `"A atividade da empresa não é elegível. O cadastro é exclusivo para lojas do ramo automotivo."`
  - Falha de consulta: `"Não foi possível consultar o CNPJ agora. Tente novamente."`
  - CNPJ inválido (formato/DV): `"CNPJ inválido."`
- **Commits frequentes**, um por task. Não fazer push/deploy automático até o fim (ver memória `commit-push-sempre` — o deploy das functions acontece na verificação final).

---

### Task 1: Helper Deno compartilhado `_shared/cnpj.ts`

**Files:**
- Create: `supabase/functions/_shared/cnpj.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `ALLOWED_CNAES: Set<string>` — os 11 códigos de 7 dígitos.
  - `normalizeCnae(code: string | number): string` — só dígitos.
  - `type BrasilApiCnpj = { razao_social?: string; nome_fantasia?: string; municipio?: string; uf?: string; cnae_fiscal?: number; cnaes_secundarios?: { codigo: number; descricao?: string }[]; descricao_situacao_cadastral?: string; situacao_cadastral?: string | number; }`
  - `lookupCnpj(cnpj: string): Promise<BrasilApiCnpj | null>` — `null` quando 404/erro de rede.
  - `type CnpjValidation = { ok: boolean; reason?: "inactive" | "cnae"; name: string; city: string; situacao: string }`
  - `validateCnpj(data: BrasilApiCnpj): CnpjValidation`

- [ ] **Step 1: Criar o helper**

Create `supabase/functions/_shared/cnpj.ts`:

```ts
/** Validação de CNPJ p/ cadastro de garagista: consulta BrasilAPI + regra de CNAE. */

export const ALLOWED_CNAES = new Set<string>([
  "4511101",
  "4511102",
  "4511103",
  "4511104",
  "4512901",
  "4512902",
  "4512903",
  "4512904",
  "4512905",
  "4512906",
  "4512907",
]);

export type BrasilApiCnpj = {
  razao_social?: string;
  nome_fantasia?: string;
  municipio?: string;
  uf?: string;
  cnae_fiscal?: number;
  cnaes_secundarios?: { codigo: number; descricao?: string }[];
  descricao_situacao_cadastral?: string;
  situacao_cadastral?: string | number;
};

export function normalizeCnae(code: string | number): string {
  return String(code ?? "").replace(/\D/g, "");
}

/** Title Case simples p/ municípios que vêm em CAIXA ALTA. */
function titleCase(s: string): string {
  return s
    .toLocaleLowerCase("pt-BR")
    .replace(/(^|\s|-)([a-zà-ú])/g, (_m, sep, ch) => sep + ch.toLocaleUpperCase("pt-BR"));
}

/** Consulta a BrasilAPI. Retorna null em 404/erro de rede (chamador trata como "não encontrado"). */
export async function lookupCnpj(cnpj: string): Promise<BrasilApiCnpj | null> {
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) return null;
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
    if (!res.ok) return null;
    return (await res.json()) as BrasilApiCnpj;
  } catch {
    return null;
  }
}

export type CnpjValidation = {
  ok: boolean;
  reason?: "inactive" | "cnae";
  name: string;
  city: string;
  situacao: string;
};

export function validateCnpj(data: BrasilApiCnpj): CnpjValidation {
  const name = (data.nome_fantasia || data.razao_social || "").trim();
  const city = data.municipio ? titleCase(data.municipio.trim()) : "";
  const situacao = (data.descricao_situacao_cadastral || "").trim().toUpperCase();

  if (situacao !== "ATIVA") {
    return { ok: false, reason: "inactive", name, city, situacao: situacao || "INATIVO" };
  }

  const codes = [
    data.cnae_fiscal,
    ...(data.cnaes_secundarios ?? []).map((c) => c.codigo),
  ]
    .filter((c) => c != null)
    .map((c) => normalizeCnae(c as number));

  const hasAllowed = codes.some((c) => ALLOWED_CNAES.has(c));
  if (!hasAllowed) {
    return { ok: false, reason: "cnae", name, city, situacao };
  }

  return { ok: true, name, city, situacao };
}
```

- [ ] **Step 2: Verificar a lógica pura com node**

Run (de `/home/israel/Documentos/2026 RaiTechLabs/revvio`):

```bash
node --input-type=module -e '
const ALLOWED = new Set(["4511101","4511102","4511103","4511104","4512901","4512902","4512903","4512904","4512905","4512906","4512907"]);
const norm = (c) => String(c ?? "").replace(/\D/g, "");
function validate(data){
  const situacao=(data.descricao_situacao_cadastral||"").trim().toUpperCase();
  if(situacao!=="ATIVA") return {ok:false,reason:"inactive"};
  const codes=[data.cnae_fiscal,...(data.cnaes_secundarios??[]).map(c=>c.codigo)].filter(c=>c!=null).map(norm);
  return codes.some(c=>ALLOWED.has(c))?{ok:true}:{ok:false,reason:"cnae"};
}
console.log(JSON.stringify(validate({descricao_situacao_cadastral:"ATIVA",cnae_fiscal:4511101})));          // ok principal
console.log(JSON.stringify(validate({descricao_situacao_cadastral:"ATIVA",cnae_fiscal:9999999,cnaes_secundarios:[{codigo:4512907}]}))); // ok secundário
console.log(JSON.stringify(validate({descricao_situacao_cadastral:"ATIVA",cnae_fiscal:5611201})));          // cnae fora
console.log(JSON.stringify(validate({descricao_situacao_cadastral:"BAIXADA",cnae_fiscal:4511101})));        // inativo
'
```

Expected:
```
{"ok":true}
{"ok":true}
{"ok":false,"reason":"cnae"}
{"ok":false,"reason":"inactive"}
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/_shared/cnpj.ts
git commit -m "feat(cnpj): helper compartilhado de consulta+validacao de CNPJ/CNAE"
```

---

### Task 2: Edge Function pública `cnpj-lookup`

**Files:**
- Create: `supabase/functions/cnpj-lookup/index.ts`
- Modify: `supabase/config.toml` (adicionar bloco da função)

**Interfaces:**
- Consumes: `lookupCnpj`, `validateCnpj` de `../_shared/cnpj.ts`; `corsHeaders`, `json` de `../_shared/cors.ts`.
- Produces (HTTP): POST `{ cnpj: string }` →
  - sucesso: `{ ok: true, name, city, razaoSocial, fantasia, municipio, uf }`
  - falha: `{ ok: false, error: string }` (sempre HTTP 200 p/ o front ler o corpo sem o wrapper de erro do supabase-js).

- [ ] **Step 1: Criar a função**

Create `supabase/functions/cnpj-lookup/index.ts`:

```ts
import { corsHeaders, json } from "../_shared/cors.ts";
import { lookupCnpj, validateCnpj } from "../_shared/cnpj.ts";

// Consulta pública de CNPJ (sem JWT) usada pelo cadastro do garagista para
// auto-preencher nome/cidade e barrar empresas inativas ou fora do ramo.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const digits = String(body.cnpj ?? "").replace(/\D/g, "");
    if (digits.length !== 14) return json({ ok: false, error: "CNPJ inválido." });

    const data = await lookupCnpj(digits);
    if (!data) return json({ ok: false, error: "CNPJ não encontrado na Receita." });

    const v = validateCnpj(data);
    if (!v.ok) {
      const error =
        v.reason === "inactive"
          ? `Este CNPJ está ${v.situacao}. Apenas empresas ativas podem se cadastrar.`
          : "A atividade da empresa não é elegível. O cadastro é exclusivo para lojas do ramo automotivo.";
      return json({ ok: false, error });
    }

    return json({
      ok: true,
      name: v.name,
      city: v.city,
      razaoSocial: data.razao_social ?? "",
      fantasia: data.nome_fantasia ?? "",
      municipio: data.municipio ?? "",
      uf: data.uf ?? "",
    });
  } catch {
    return json({ ok: false, error: "Não foi possível consultar o CNPJ agora. Tente novamente." });
  }
});
```

- [ ] **Step 2: Registrar no config.toml**

Modify `supabase/config.toml` — adicionar ao final do arquivo (após o bloco `[functions.signup-checkout]`):

```toml

# cnpj-lookup: consulta pública de CNPJ p/ o cadastro do garagista → sem JWT.
[functions.cnpj-lookup]
verify_jwt = false
```

- [ ] **Step 3: Type-check da função (se o deno CLI estiver disponível)**

Run:

```bash
cd "/home/israel/Documentos/2026 RaiTechLabs/revvio" && (command -v deno >/dev/null && deno check supabase/functions/cnpj-lookup/index.ts || echo "deno CLI ausente — type-check no deploy")
```

Expected: `Check ...` sem erros, ou a mensagem de fallback. (A verificação funcional real é no deploy da Task 6.)

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/cnpj-lookup/index.ts supabase/config.toml
git commit -m "feat(cnpj): edge function publica cnpj-lookup (validacao+autofill)"
```

---

### Task 3: Re-validação server-side em `signup-checkout`

**Files:**
- Modify: `supabase/functions/signup-checkout/index.ts`

**Interfaces:**
- Consumes: `lookupCnpj`, `validateCnpj` de `../_shared/cnpj.ts`.
- Produces: o body do `signup-checkout` passa a ler `cnpj` (em vez de `cpf_cnpj`); 400 com mensagem se a validação reprovar. Continua gravando em `rv_pending_signups.cpf_cnpj`.

- [ ] **Step 1: Importar o helper**

Modify `supabase/functions/signup-checkout/index.ts` — adicionar ao bloco de imports (logo após o import de `../_shared/asaas.ts`):

```ts
import { lookupCnpj, validateCnpj } from "../_shared/cnpj.ts";
```

- [ ] **Step 2: Ler `cnpj` e validar**

Modify `supabase/functions/signup-checkout/index.ts` — substituir a linha que lê `cpf_cnpj`:

De:
```ts
    const cpf_cnpj = body.cpf_cnpj ? String(body.cpf_cnpj) : null;
```
Para:
```ts
    const cnpj = body.cnpj ? String(body.cnpj).replace(/\D/g, "") : null;
```

E substituir a validação atual de obrigatório:

De:
```ts
    if (!cpf_cnpj) return json({ error: "Informe seu CPF/CNPJ para continuar." }, 400);
```
Para:
```ts
    if (!cnpj || cnpj.length !== 14)
      return json({ error: "CNPJ inválido." }, 400);

    // Gate definitivo: re-valida CNPJ/CNAE no servidor (o front pode ser burlado).
    const cnpjData = await lookupCnpj(cnpj);
    if (!cnpjData) return json({ error: "CNPJ não encontrado na Receita." }, 400);
    const cnpjCheck = validateCnpj(cnpjData);
    if (!cnpjCheck.ok)
      return json(
        {
          error:
            cnpjCheck.reason === "inactive"
              ? `Este CNPJ está ${cnpjCheck.situacao}. Apenas empresas ativas podem se cadastrar.`
              : "A atividade da empresa não é elegível. O cadastro é exclusivo para lojas do ramo automotivo.",
        },
        400
      );
```

- [ ] **Step 3: Usar `cnpj` no createCustomer e no upsert**

Modify `supabase/functions/signup-checkout/index.ts`:

Em `createCustomer`, substituir `cpfCnpj: cpf_cnpj.replace(/\D/g, "")` por:
```ts
        cpfCnpj: cnpj,
```

No `upsert` de `rv_pending_signups`, substituir a linha `cpf_cnpj,` por:
```ts
        cpf_cnpj: cnpj,
```

- [ ] **Step 4: Type-check (se o deno CLI estiver disponível)**

Run:

```bash
cd "/home/israel/Documentos/2026 RaiTechLabs/revvio" && (command -v deno >/dev/null && deno check supabase/functions/signup-checkout/index.ts || echo "deno CLI ausente — type-check no deploy")
```

Expected: sem erros, ou a mensagem de fallback.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/signup-checkout/index.ts
git commit -m "feat(cnpj): signup-checkout re-valida CNPJ/CNAE antes de cobrar"
```

---

### Task 4: Máscara e validador de CNPJ no front

**Files:**
- Modify: `src/lib/masks.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `maskCnpj(value: string): string` — formata `00.000.000/0000-00` (trunca em 14 dígitos).
  - `isValidCnpj(value: string): boolean` — 14 dígitos + dígitos verificadores válidos; rejeita sequências repetidas.

- [ ] **Step 1: Adicionar `maskCnpj` e `isValidCnpj`**

Modify `src/lib/masks.ts` — adicionar ao final do arquivo:

```ts

/** CNPJ progressivo: "00.000.000/0000-00" (até 14 dígitos). */
export function maskCnpj(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2}\.\d{3})(\d)/, "$1.$2")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

/** Valida os 2 dígitos verificadores do CNPJ. Rejeita sequências repetidas. */
export function isValidCnpj(value: string): boolean {
  const d = value.replace(/\D/g, "");
  if (d.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(d)) return false;
  const calc = (len: number) => {
    let sum = 0;
    let pos = len - 7;
    for (let i = len; i >= 1; i--) {
      sum += Number(d[len - i]) * pos--;
      if (pos < 2) pos = 9;
    }
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}
```

- [ ] **Step 2: Verificar o validador com node**

Run:

```bash
cd "/home/israel/Documentos/2026 RaiTechLabs/revvio" && node --input-type=module -e '
function isValidCnpj(value){
  const d=value.replace(/\D/g,"");
  if(d.length!==14) return false;
  if(/^(\d)\1{13}$/.test(d)) return false;
  const calc=(len)=>{let sum=0,pos=len-7;for(let i=len;i>=1;i--){sum+=Number(d[len-i])*pos--;if(pos<2)pos=9;}const r=sum%11;return r<2?0:11-r;};
  return calc(12)===Number(d[12])&&calc(13)===Number(d[13]);
}
console.log(isValidCnpj("11.222.333/0001-81")); // true (CNPJ válido de teste)
console.log(isValidCnpj("11.222.333/0001-80")); // false (DV errado)
console.log(isValidCnpj("00.000.000/0000-00")); // false (sequência)
console.log(isValidCnpj("11.222.333/0001"));    // false (curto)
'
```

Expected:
```
true
false
false
false
```

- [ ] **Step 3: Type-check do front**

Run:

```bash
cd "/home/israel/Documentos/2026 RaiTechLabs/revvio" && npx tsc -b
```

Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/lib/masks.ts
git commit -m "feat(cnpj): maskCnpj + isValidCnpj em masks"
```

---

### Task 5: Frontend `CadastroVendedor.tsx` — só CNPJ + auto-validação

**Files:**
- Modify: `src/features/auth/pages/CadastroVendedor.tsx`

**Interfaces:**
- Consumes: `maskCnpj`, `isValidCnpj` de `@/lib/masks`; Edge Function `cnpj-lookup` via `supabase.functions.invoke`.
- Produces: form que envia `{ name, email, phone, cnpj, city, plan, cycle }` ao `signup-checkout`.

- [ ] **Step 1: Trocar imports e schema**

Modify `src/features/auth/pages/CadastroVendedor.tsx`:

Substituir o import de masks:
```ts
import { maskPhone, maskCpfCnpj } from "@/lib/masks";
```
Por:
```ts
import { maskPhone, maskCnpj, isValidCnpj } from "@/lib/masks";
```

Substituir o schema (campo `cpf_cnpj`):
```ts
  cpf_cnpj: z.string().min(11, "CPF/CNPJ inválido"),
```
Por:
```ts
  cnpj: z.string().refine((v) => isValidCnpj(v), "CNPJ inválido"),
```

- [ ] **Step 2: Estado de validação + handler de consulta**

Modify `src/features/auth/pages/CadastroVendedor.tsx` — dentro do componente, após `const [formError, setFormError] = useState<string | null>(null);` adicionar:

```ts
  const [cnpjStatus, setCnpjStatus] = useState<
    "idle" | "loading" | "valid" | "invalid"
  >("idle");
  const [cnpjMsg, setCnpjMsg] = useState<string | null>(null);
```

E adicionar a função de consulta (após `setFormError`/antes de `onSubmit`), usando `setValue`:

```ts
  async function checkCnpj(rawCnpj: string) {
    const digits = rawCnpj.replace(/\D/g, "");
    if (digits.length !== 14 || !isValidCnpj(digits)) {
      setCnpjStatus("idle");
      setCnpjMsg(null);
      return;
    }
    setCnpjStatus("loading");
    setCnpjMsg(null);
    const { data, error } = await supabase.functions.invoke("cnpj-lookup", {
      body: { cnpj: digits },
    });
    if (error || !data || data.ok !== true) {
      setCnpjStatus("invalid");
      setCnpjMsg(data?.error ?? "Não foi possível consultar o CNPJ agora. Tente novamente.");
      return;
    }
    if (data.name) setValue("name", data.name, { shouldValidate: true });
    if (data.city) setValue("city", data.city, { shouldValidate: true });
    setCnpjStatus("valid");
    setCnpjMsg(
      [data.razaoSocial, data.municipio && `${data.municipio}${data.uf ? "/" + data.uf : ""}`]
        .filter(Boolean)
        .join(" — ") || "CNPJ válido."
    );
  }
```

Adicionar `setValue` à desestruturação do `useForm`:
```ts
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CadastroForm>({ resolver: zodResolver(schema) });
```

Substituir `const cpfField = register("cpf_cnpj");` por:
```ts
  const cnpjField = register("cnpj");
```

- [ ] **Step 3: Trocar o body do onSubmit**

Modify `src/features/auth/pages/CadastroVendedor.tsx` — no `onSubmit`, substituir `cpf_cnpj: values.cpf_cnpj,` por:
```ts
        cnpj: values.cnpj.replace(/\D/g, ""),
```

- [ ] **Step 4: Trocar o campo na UI (CNPJ + status) e travar o botão**

Modify `src/features/auth/pages/CadastroVendedor.tsx` — substituir o `<AuthField id="cpf_cnpj" ...>` (e seu wrapper, se necessário) pelo campo de CNPJ com auto-consulta no blur/change. Substituir o bloco do CPF/CNPJ:

```tsx
          <AuthField
            id="cpf_cnpj"
            label="CPF / CNPJ"
            icon="badge"
            inputMode="numeric"
            placeholder="000.000.000-00"
            error={errors.cpf_cnpj?.message}
            {...cpfField}
            onChange={(e) => {
              e.target.value = maskCpfCnpj(e.target.value);
              cpfField.onChange(e);
            }}
          />
```

Por:

```tsx
          <div>
            <AuthField
              id="cnpj"
              label="CNPJ"
              icon="badge"
              inputMode="numeric"
              placeholder="00.000.000/0000-00"
              error={errors.cnpj?.message}
              {...cnpjField}
              onChange={(e) => {
                e.target.value = maskCnpj(e.target.value);
                cnpjField.onChange(e);
                if (e.target.value.replace(/\D/g, "").length !== 14) {
                  setCnpjStatus("idle");
                  setCnpjMsg(null);
                }
              }}
              onBlur={(e) => {
                cnpjField.onBlur(e);
                void checkCnpj(e.target.value);
              }}
            />
            {cnpjStatus === "loading" && (
              <p className="mt-1 text-xs text-slate-500">Consultando CNPJ…</p>
            )}
            {cnpjStatus === "valid" && cnpjMsg && (
              <p className="mt-1 text-xs text-emerald-600">✓ {cnpjMsg}</p>
            )}
            {cnpjStatus === "invalid" && cnpjMsg && (
              <p className="mt-1 text-xs text-red-500">{cnpjMsg}</p>
            )}
          </div>
```

> Nota: a consulta dispara no `onBlur` (ao sair do campo com 14 dígitos válidos), evitando chamadas a cada tecla. O `onChange` reseta o status quando o CNPJ deixa de ter 14 dígitos.

Travar o botão de envio — substituir:
```tsx
          disabled={isSubmitting}
```
Por:
```tsx
          disabled={isSubmitting || cnpjStatus !== "valid"}
```

- [ ] **Step 5: Type-check + build**

Run:

```bash
cd "/home/israel/Documentos/2026 RaiTechLabs/revvio" && npx tsc -b && npm run build
```

Expected: `tsc` sem erros e build concluído (`dist/` gerado).

- [ ] **Step 6: Commit**

```bash
git add src/features/auth/pages/CadastroVendedor.tsx
git commit -m "feat(cnpj): cadastro de garagista so-CNPJ com auto-validacao e autofill"
```

---

### Task 6: Deploy das Edge Functions + validação manual (gate final)

**Files:** nenhum (operacional).

- [ ] **Step 1: Deploy das funções no remoto**

Run:

```bash
cd "/home/israel/Documentos/2026 RaiTechLabs/revvio" && supabase functions deploy cnpj-lookup signup-checkout
```

Expected: deploy OK das duas funções.

- [ ] **Step 2: Validação funcional do cnpj-lookup (via curl no endpoint público)**

Run (substituir `<PROJECT_REF>` por `ahtisetxygjyfvhguckl` e `<ANON_KEY>` pela chave anon do `.env.local`):

```bash
curl -s -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/cnpj-lookup" \
  -H "Authorization: Bearer <ANON_KEY>" -H "Content-Type: application/json" \
  -d '{"cnpj":"<CNPJ_REAL_DO_RAMO_AUTOMOTIVO>"}'
```

Expected: `{"ok":true,"name":"...","city":"...","razaoSocial":"...","municipio":"...","uf":"..."}`.

Repetir com um CNPJ ativo **fora** do ramo → `{"ok":false,"error":"A atividade da empresa não é elegível...."}`; e com um CNPJ inexistente → `{"ok":false,"error":"CNPJ não encontrado na Receita."}`.

- [ ] **Step 3: Validação ponta a ponta no app**

Abrir `/vender` → escolher um plano → no cadastro, digitar um CNPJ do ramo automotivo e sair do campo:
- Nome e Cidade auto-preenchem; aparece o ✓ com razão social; botão libera.
- Digitar um CNPJ fora do ramo → mensagem de inelegibilidade; botão travado.
- Concluir com um CNPJ válido → redireciona ao ASAAS (fluxo de pagamento existente).

- [ ] **Step 4: Deploy do front (conforme memória `commit-push-sempre` + `deploy-vps-revvio`)**

Após o gate verde, seguir o procedimento de deploy do projeto (push origin/main + build estático + rsync/pm2 reload na VPS). Confirmar com o usuário se deve prosseguir com push/deploy.

---

## Self-Review

**Spec coverage:**
- §1/§2 CNPJ-only + BrasilAPI + match principal-ou-secundário + autofill + ATIVA + auto ao completar → Tasks 1, 4, 5. ✓
- §3 CNAEs permitidos (Set de 7 dígitos) → Task 1 (`ALLOWED_CNAES`). ✓
- §4.1 `_shared/cnpj.ts` → Task 1. ✓
- §4.2 `cnpj-lookup` → Task 2. ✓
- §4.3 `signup-checkout` re-valida + `cnpj` no body → Task 3. ✓
- §5 sem migration / reuso `cpf_cnpj` → Task 3 (upsert `cpf_cnpj: cnpj`). ✓
- §6 frontend (schema, estado, auto-consulta, label, botão travado) → Task 5. ✓
- §6.1 `maskCnpj` + `isValidCnpj` → Task 4. ✓
- §7 config.toml + deploy → Tasks 2 e 6. ✓
- §8 mensagens verbatim → Global Constraints + Tasks 2/3/5. ✓
- §9 verificação (tsc+build, deploy, manual) → Tasks 4/5/6. ✓
- §10 fora de escopo respeitado (sem webhook, sem rename, sem fallback). ✓

**Placeholder scan:** sem TBD/TODO; todo passo tem código ou comando concreto. `<PROJECT_REF>`/`<ANON_KEY>`/`<CNPJ_REAL...>` na Task 6 são entradas operacionais necessárias (valores reais), não placeholders de código.

**Type consistency:** `lookupCnpj`/`validateCnpj`/`ALLOWED_CNAES`/`CnpjValidation.reason` ("inactive"|"cnae") usados de forma idêntica nas Tasks 1→2→3. `maskCnpj`/`isValidCnpj` idênticos nas Tasks 4→5. Body `cnpj` consistente entre Task 5 (front) e Task 3 (signup-checkout). ✓
