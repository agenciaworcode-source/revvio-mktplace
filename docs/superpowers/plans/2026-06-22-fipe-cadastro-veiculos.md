# Integração FIPE no Cadastro de Veículos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar Marca/Modelo/Ano do cadastro de veículos dinâmicos via FIPE (cascata), preenchendo o valor sugerido no campo Preço.

**Architecture:** Client puro da Parallelum FIPE v1 (`src/lib/fipe.ts`) consumido por um componente de cascata (`FipeSelector.tsx`) via react-query, integrado ao `VehicleForm` existente que faz `setValue` nos campos do react-hook-form. Sem backend novo e sem migration.

**Tech Stack:** React + TypeScript, react-hook-form + zod, @tanstack/react-query, Tailwind (componentes `ui-light`), fetch nativo para a Parallelum FIPE v1.

## Global Constraints

- Sem runner de teste unitário no projeto. Gate de cada task = **`npx tsc -b`** (typecheck) **+ `npm run build`** verdes.
- Fonte FIPE: **`https://parallelum.com.br/fipe/api/v1/{tipo}`** com `tipo ∈ { carros, motos, caminhoes }` (BrasilAPI está 403 — não usar).
- Nenhuma migration / nenhuma coluna nova. Usa colunas existentes de `rv_vehicles`: `make`, `model`, `year`, `price`, `fipe_price`, `fuel`.
- Tipo de combustível alvo: `FuelType = "flex" | "gasolina" | "diesel" | "etanol" | "hibrido" | "eletrico" | "gnv"` (de `@/lib/database.types`).
- Componentes de UI vêm de `@/components/ui-light` (`Field`, `Select`, `Input`, `Spinner`, `Alert`).
- Após a feature completa e verde: commit + push + **deploy na VPS** conforme `deploy-vps-revvio` (build estático → rsync `/var/www/revvio` → `pm2 reload revvio`).

---

### Task 1: Client puro da FIPE (`src/lib/fipe.ts`)

**Files:**
- Create: `src/lib/fipe.ts`

**Interfaces:**
- Consumes: `FuelType` de `@/lib/database.types`.
- Produces:
  - `type FipeTipo = "carros" | "motos" | "caminhoes"`
  - `type FipeMarca = { codigo: string; nome: string }`
  - `type FipeModelo = { codigo: string; nome: string }`
  - `type FipeAno = { codigo: string; nome: string }`
  - `type FipeResult = { make: string; model: string; year: number | null; fipePrice: number; fuel: FuelType | null }`
  - `fetchMarcas(tipo: FipeTipo): Promise<FipeMarca[]>`
  - `fetchModelos(tipo: FipeTipo, marcaCod: string): Promise<FipeModelo[]>`
  - `fetchAnos(tipo: FipeTipo, marcaCod: string, modeloCod: string): Promise<FipeAno[]>`
  - `fetchResult(tipo, marcaCod, modeloCod, anoCod): Promise<FipeResult>`
  - `parseFipeValor(s: string): number`
  - `mapFipeFuel(sigla: string): FuelType | null`
  - `fipeYear(anoModelo: number): number | null`

- [ ] **Step 1: Criar `src/lib/fipe.ts` com o client e helpers**

```ts
import type { FuelType } from "@/lib/database.types";

const BASE = "https://parallelum.com.br/fipe/api/v1";

export type FipeTipo = "carros" | "motos" | "caminhoes";
export type FipeMarca = { codigo: string; nome: string };
export type FipeModelo = { codigo: string; nome: string };
export type FipeAno = { codigo: string; nome: string };
export type FipeResult = {
  make: string;
  model: string;
  year: number | null;
  fipePrice: number;
  fuel: FuelType | null;
};

type RawValor = {
  Valor: string;
  Marca: string;
  Modelo: string;
  AnoModelo: number;
  SiglaCombustivel: string;
};

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`FIPE indisponível (HTTP ${res.status}).`);
  }
  return (await res.json()) as T;
}

/** "R$ 86.472,00" -> 86472. Retorna NaN se não parsear. */
export function parseFipeValor(s: string): number {
  const cleaned = s
    .replace(/[R$\s]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  return Number.parseFloat(cleaned);
}

/** Sigla FIPE -> nosso enum de combustível (best-effort). */
export function mapFipeFuel(sigla: string): FuelType | null {
  switch (sigla?.toUpperCase()) {
    case "G":
      return "gasolina";
    case "A":
      return "etanol";
    case "D":
      return "diesel";
    default:
      return null;
  }
}

/** AnoModelo da FIPE -> ano usável (32000 = 0 km -> ano atual). */
export function fipeYear(anoModelo: number): number | null {
  if (!Number.isFinite(anoModelo)) return null;
  if (anoModelo >= 3000) return new Date().getFullYear();
  return anoModelo;
}

export function fetchMarcas(tipo: FipeTipo): Promise<FipeMarca[]> {
  return getJson<FipeMarca[]>(`${BASE}/${tipo}/marcas`);
}

export async function fetchModelos(
  tipo: FipeTipo,
  marcaCod: string
): Promise<FipeModelo[]> {
  const data = await getJson<{ modelos: { codigo: number | string; nome: string }[] }>(
    `${BASE}/${tipo}/marcas/${marcaCod}/modelos`
  );
  return data.modelos.map((m) => ({ codigo: String(m.codigo), nome: m.nome }));
}

export function fetchAnos(
  tipo: FipeTipo,
  marcaCod: string,
  modeloCod: string
): Promise<FipeAno[]> {
  return getJson<FipeAno[]>(`${BASE}/${tipo}/marcas/${marcaCod}/modelos/${modeloCod}/anos`);
}

export async function fetchResult(
  tipo: FipeTipo,
  marcaCod: string,
  modeloCod: string,
  anoCod: string
): Promise<FipeResult> {
  const raw = await getJson<RawValor>(
    `${BASE}/${tipo}/marcas/${marcaCod}/modelos/${modeloCod}/anos/${anoCod}`
  );
  return {
    make: raw.Marca,
    model: raw.Modelo,
    year: fipeYear(raw.AnoModelo),
    fipePrice: parseFipeValor(raw.Valor),
    fuel: mapFipeFuel(raw.SiglaCombustivel),
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: sem erros (exit 0).

- [ ] **Step 3: Sanity-check dos helpers puros**

Rodar este check pontual (cole os valores e confira manualmente — não há runner unitário):

Run: `node -e "const c=(s)=>Number.parseFloat(s.replace(/[R\$\s]/g,'').replace(/\./g,'').replace(',','.')); console.log(c('R\$ 86.472,00'), c('R\$ 1.234.567,89'))"`
Expected: `86472 1234567.89`

(Valida a lógica de `parseFipeValor`. `mapFipeFuel('D')→"diesel"`, `mapFipeFuel('X')→null`, `fipeYear(32000)→ano atual`, `fipeYear(2014)→2014` — confirmados por inspeção.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/fipe.ts
git commit -m "feat(fipe): client puro da Parallelum FIPE v1 + helpers de parse"
```

---

### Task 2: Componente de cascata `FipeSelector` (`src/features/seller/components/FipeSelector.tsx`)

**Files:**
- Create: `src/features/seller/components/FipeSelector.tsx`

**Interfaces:**
- Consumes: de `@/lib/fipe` → `FipeTipo`, `FipeResult`, `fetchMarcas`, `fetchModelos`, `fetchAnos`, `fetchResult`. De `@/components/ui-light` → `Field`, `Select`, `Spinner`, `Alert`.
- Produces:
  - `type FipeSelectorProps = { onSelect: (r: FipeResult) => void; onUseManual: () => void }`
  - `export function FipeSelector(props: FipeSelectorProps): JSX.Element`

- [ ] **Step 1: Criar `src/features/seller/components/FipeSelector.tsx`**

```tsx
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchMarcas,
  fetchModelos,
  fetchAnos,
  fetchResult,
  type FipeTipo,
  type FipeResult,
} from "@/lib/fipe";
import { Alert, Field, Select, Spinner } from "@/components/ui-light";

const DAY = 24 * 60 * 60 * 1000;

const TIPOS: { value: FipeTipo; label: string }[] = [
  { value: "carros", label: "Carro" },
  { value: "motos", label: "Moto" },
  { value: "caminhoes", label: "Caminhão" },
];

export type FipeSelectorProps = {
  onSelect: (r: FipeResult) => void;
  onUseManual: () => void;
};

export function FipeSelector({ onSelect, onUseManual }: FipeSelectorProps) {
  const qc = useQueryClient();
  const [tipo, setTipo] = useState<FipeTipo>("carros");
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [ano, setAno] = useState("");
  const [loadingValor, setLoadingValor] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const marcas = useQuery({
    queryKey: ["fipe", "marcas", tipo],
    queryFn: () => fetchMarcas(tipo),
    staleTime: DAY,
    gcTime: DAY,
  });
  const modelos = useQuery({
    queryKey: ["fipe", "modelos", tipo, marca],
    queryFn: () => fetchModelos(tipo, marca),
    enabled: !!marca,
    staleTime: DAY,
    gcTime: DAY,
  });
  const anos = useQuery({
    queryKey: ["fipe", "anos", tipo, marca, modelo],
    queryFn: () => fetchAnos(tipo, marca, modelo),
    enabled: !!marca && !!modelo,
    staleTime: DAY,
    gcTime: DAY,
  });

  function resetFrom(level: "tipo" | "marca" | "modelo") {
    if (level === "tipo") setMarca("");
    if (level === "tipo" || level === "marca") setModelo("");
    setAno("");
  }

  async function handleAno(anoCod: string) {
    setAno(anoCod);
    if (!anoCod) return;
    setLoadingValor(true);
    setError(null);
    try {
      const result = await qc.fetchQuery({
        queryKey: ["fipe", "valor", tipo, marca, modelo, anoCod],
        queryFn: () => fetchResult(tipo, marca, modelo, anoCod),
        staleTime: DAY,
        gcTime: DAY,
      });
      onSelect(result);
    } catch {
      setError("Não foi possível consultar o valor na FIPE agora. Tente novamente ou preencha manualmente.");
    } finally {
      setLoadingValor(false);
    }
  }

  const anyError = marcas.isError || modelos.isError || anos.isError || error;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-slate-700">Buscar pela tabela FIPE</p>
        <button
          type="button"
          onClick={onUseManual}
          className="text-xs font-medium text-brand hover:underline"
        >
          Não encontrei / preencher manualmente
        </button>
      </div>

      {anyError && (
        <Alert variant="error" className="mb-3">
          {error ?? "Não foi possível consultar a FIPE agora. Tente novamente ou preencha manualmente."}
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Tipo">
          <Select
            value={tipo}
            onChange={(e) => {
              setTipo(e.target.value as FipeTipo);
              resetFrom("tipo");
            }}
          >
            {TIPOS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Marca">
          <Select
            value={marca}
            disabled={marcas.isLoading}
            onChange={(e) => {
              setMarca(e.target.value);
              resetFrom("marca");
            }}
          >
            <option value="">{marcas.isLoading ? "Carregando…" : "Selecione a marca"}</option>
            {(marcas.data ?? []).map((m) => (
              <option key={m.codigo} value={m.codigo}>
                {m.nome}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Modelo">
          <Select
            value={modelo}
            disabled={!marca || modelos.isLoading}
            onChange={(e) => {
              setModelo(e.target.value);
              resetFrom("modelo");
            }}
          >
            <option value="">
              {!marca ? "Escolha a marca primeiro" : modelos.isLoading ? "Carregando…" : "Selecione o modelo"}
            </option>
            {(modelos.data ?? []).map((m) => (
              <option key={m.codigo} value={m.codigo}>
                {m.nome}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Ano">
          <Select
            value={ano}
            disabled={!modelo || anos.isLoading}
            onChange={(e) => handleAno(e.target.value)}
          >
            <option value="">
              {!modelo ? "Escolha o modelo primeiro" : anos.isLoading ? "Carregando…" : "Selecione o ano"}
            </option>
            {(anos.data ?? []).map((a) => (
              <option key={a.codigo} value={a.codigo}>
                {a.nome}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {loadingValor && (
        <p className="mt-3 flex items-center gap-2 text-sm text-slate-500">
          <Spinner className="h-4 w-4" /> Consultando valor na FIPE…
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Confirmar que `Alert` aceita `className`**

Run: `grep -nA6 "export function Alert" src/components/ui-light.tsx`
Expected: a assinatura aceita `className` (props espalhadas). Se **não** aceitar, remover os `className="mb-3"` dos `<Alert>` e envolver num `<div className="mb-3">`.

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc -b && npm run build`
Expected: sem erros (exit 0).

- [ ] **Step 4: Commit**

```bash
git add src/features/seller/components/FipeSelector.tsx
git commit -m "feat(fipe): componente FipeSelector (cascata Tipo/Marca/Modelo/Ano)"
```

---

### Task 3: Integrar `FipeSelector` no `VehicleForm`

**Files:**
- Modify: `src/features/seller/pages/Vehicles.tsx`

**Interfaces:**
- Consumes: `FipeSelector` de `../components/FipeSelector`, `FipeResult` de `@/lib/fipe`.
- Produces: nenhum export novo (mudança interna do `VehicleForm`).

- [ ] **Step 1: Importar `FipeSelector` e `FipeResult`**

No topo de `src/features/seller/pages/Vehicles.tsx`, adicionar após os imports existentes:

```tsx
import { FipeSelector } from "../components/FipeSelector";
import type { FipeResult } from "@/lib/fipe";
```

- [ ] **Step 2: Adicionar estado `manual` e `setValue` no `VehicleForm`**

Localizar (≈ linha 119) o destructuring do `useForm`:

```tsx
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toDefaults(vehicle),
  });
```

Substituir por (adiciona `setValue` e o estado `manual` — começa manual na edição, FIPE na criação):

```tsx
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toDefaults(vehicle),
  });
  const [manual, setManual] = useState<boolean>(!!vehicle);

  function applyFipe(r: FipeResult) {
    setValue("make", r.make, { shouldValidate: true });
    setValue("model", r.model, { shouldValidate: true });
    setValue("year", r.year, { shouldValidate: true });
    setValue("fipe_price", r.fipePrice, { shouldValidate: true });
    setValue("price", r.fipePrice, { shouldValidate: true });
    if (r.fuel) setValue("fuel", r.fuel, { shouldValidate: true });
  }
```

- [ ] **Step 3: Substituir os campos Marca/Modelo/Ano pela seção FIPE + modo manual**

Localizar o início do primeiro grid (≈ linha 187) e os três primeiros `Field` (Marca, Modelo, Ano):

```tsx
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Marca" error={errors.make?.message}>
          <Input placeholder="Toyota" {...register("make")} />
        </Field>
        <Field label="Modelo" error={errors.model?.message}>
          <Input placeholder="Corolla" {...register("model")} />
        </Field>
        <Field label="Ano" error={errors.year?.message}>
          <Input type="number" placeholder="2022" {...register("year")} />
        </Field>
        <Field label="Preço (R$)" error={errors.price?.message}>
```

Substituir por (move Marca/Modelo/Ano para uma seção condicional acima do grid; o grid passa a começar em "Preço"):

```tsx
      {manual ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Marca" error={errors.make?.message}>
            <Input placeholder="Toyota" {...register("make")} />
          </Field>
          <Field label="Modelo" error={errors.model?.message}>
            <Input placeholder="Corolla" {...register("model")} />
          </Field>
          <Field label="Ano" error={errors.year?.message}>
            <Input type="number" placeholder="2022" {...register("year")} />
          </Field>
          <div className="sm:col-span-3">
            <button
              type="button"
              onClick={() => setManual(false)}
              className="text-xs font-medium text-brand hover:underline"
            >
              Usar a tabela FIPE
            </button>
          </div>
        </div>
      ) : (
        <>
          <FipeSelector onSelect={applyFipe} onUseManual={() => setManual(true)} />
          <input type="hidden" {...register("make")} />
          <input type="hidden" {...register("model")} />
          <input type="hidden" {...register("year")} />
          {(errors.make || errors.model || errors.year) && (
            <Alert variant="error">Selecione marca, modelo e ano na FIPE (ou preencha manualmente).</Alert>
          )}
        </>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Preço (R$)" error={errors.price?.message}>
```

(O restante do grid — Preço, Quilometragem, Cor, Preço FIPE, Status — permanece inalterado.)

- [ ] **Step 4: Typecheck + build**

Run: `npx tsc -b && npm run build`
Expected: sem erros (exit 0).

- [ ] **Step 5: Verificação manual no app**

Run: `npm run dev` e abrir `http://localhost:5173/painel/veiculos` (logado como garagista). Conferir o checklist:

1. **Novo veículo (carro):** abre em modo FIPE. Selecionar Marca → Modelo → Ano. Ao escolher o Ano, **Preço FIPE** e **Preço** são preenchidos com o valor da FIPE e o **Combustível** mapeado (gasolina/etanol/diesel).
2. Ajustar o **Preço** manualmente e **salvar**; o card mostra o veículo com o preço ajustado.
3. Trocar o **Tipo** para Moto/Caminhão → cascata recarrega e funciona.
4. Clicar **"preencher manualmente"** → aparecem os inputs de texto Marca/Modelo/Ano; salvar funciona.
5. **Editar** um veículo existente → abre em **modo manual** com os valores atuais, sem quebrar.
6. (Opcional) Simular falha: no DevTools → Network → Offline e tentar selecionar um ano → aparece o aviso não-bloqueante e o botão de modo manual.

- [ ] **Step 6: Commit**

```bash
git add src/features/seller/pages/Vehicles.tsx
git commit -m "feat(veiculo): cadastro usa FIPE para Marca/Modelo/Ano + valor sugerido no preço"
```

---

## Encerramento (após as 3 tasks verdes)

- [ ] **Gate final:** `npx tsc -b && npm run build` verdes.
- [ ] **Push:** `git push origin main`.
- [ ] **Deploy:** seguir `deploy-vps-revvio` — backup de `/var/www/revvio`, `rsync -az --delete --chown=ubuntu:ubuntu dist/ root@72.60.243.106:/var/www/revvio/`, `pm2 reload revvio`, e validar `curl localhost:3115/` (HTTP 200).

## Self-Review (cobertura do spec)

- §2 fonte Parallelum / 3 tipos → Task 1 (`fetch*` com `tipo`), Task 2 (seletor de Tipo). ✓
- §3.1 client puro + helpers (`parseFipeValor`/`mapFipeFuel`/`fipeYear`) → Task 1. ✓
- §3.2 cascata + react-query staleTime longo + fallback manual + busca de valor → Task 2. ✓
- §3.3 integração `setValue` (make/model/year/fipe_price/price/fuel) + default manual em edição → Task 3. ✓
- §4 fluxo de dados → Task 3 Step 2/3 (`applyFipe`). ✓
- §5 sem migration → confirmado (nenhuma task de banco). ✓
- §6 erros/loading (selects disabled + aviso não-bloqueante) → Task 2 Step 1. ✓
- §7 edge cases (0 km via `fipeYear`, combustível sem equivalente, edição legado) → Task 1 + Task 3. ✓
- §8 verificação (gate tsc+build + checklist manual) → Steps de verificação em cada task. ✓
