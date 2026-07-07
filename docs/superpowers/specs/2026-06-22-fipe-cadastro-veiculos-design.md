# Design — Integração FIPE no cadastro de veículos

**Data:** 2026-06-22
**Status:** aprovado (brainstorming) — pronto para plano de implementação

## 1. Contexto e objetivo

No painel do garagista/vendedor (`/painel/veiculos` → `src/features/seller/pages/Vehicles.tsx`),
o cadastro de veículo hoje tem **Marca** e **Modelo** como `Input` de texto livre, **Ano** como
número e dois campos de preço separados: **Preço** (`price`, o valor de venda) e **Preço FIPE**
(`fipe_price`, referência para o selo "abaixo da FIPE"). Tudo é digitado manualmente.

**Objetivo:** tornar **Marca → Modelo → Ano** dinâmicos, alimentados pela tabela FIPE em cascata,
e ao selecionar o ano **trazer o valor de sugestão da FIPE** automaticamente para o campo **Preço**
(além de gravar o valor exato em **Preço FIPE**).

### Decisões de produto (do brainstorming)

- **Escopo:** carros **+ motos + caminhões** (os 3 tipos da FIPE). Um seletor de "Tipo" precede a Marca.
- **Fallback manual:** Marca/Modelo/Ano viram selects FIPE, mas com um toggle **"preencher
  manualmente"** que revela os campos de texto originais. Preserva carros fora da tabela FIPE e a
  edição de registros legados (marca/modelo em texto livre que não batem com a FIPE).
- **Valor:** ao escolher o ano, gravar o valor exato em `fipe_price` **e** pré-preencher `price` com
  o mesmo valor como **sugestão editável**. Bônus: preencher também o combustível quando mapeável.
- **Infra:** chamar a API **direto do navegador** (sem backend novo), com cache do react-query.

> **Correção de fonte (validada na implementação do brainstorming):** a opção escolhida foi
> "BrasilAPI direto do front", mas a BrasilAPI FIPE está retornando **403** (a fonte FIPE bloqueia o
> proxy dela) e não expõe o passo Ano→Valor de forma limpa. Mantém-se a mesma abordagem (direto do
> front, grátis, sem token), trocando a fonte para a **Parallelum FIPE v1**, que tem CORS liberado
> (`Access-Control-Allow-Origin: *`) e a cascata completa Marca→Modelo→Ano→Valor.

## 2. Fonte de dados — Parallelum FIPE v1

Base: `https://parallelum.com.br/fipe/api/v1/{tipo}` com `tipo ∈ { carros, motos, caminhoes }`.

| Passo | Endpoint | Resposta (relevante) |
|---|---|---|
| Marcas | `/{tipo}/marcas` | `[{ "codigo": "59", "nome": "VW - VolksWagen" }]` |
| Modelos | `/{tipo}/marcas/{marca}/modelos` | `{ "modelos": [{ "codigo": 5940, "nome": "AMAROK ..." }], "anos": [...] }` |
| Anos | `/{tipo}/marcas/{marca}/modelos/{modelo}/anos` | `[{ "codigo": "2014-3", "nome": "2014 Diesel" }]` |
| Valor | `/{tipo}/marcas/{marca}/modelos/{modelo}/anos/{ano}` | `{ "Valor": "R$ 86.472,00", "Marca": "...", "Modelo": "...", "AnoModelo": 2014, "Combustivel": "Diesel", "SiglaCombustivel": "D", "CodigoFipe": "005340-6", "MesReferencia": "junho de 2026" }` |

Observações:
- O `codigo` do ano embute combustível (`AAAA-S`, sufixo `1`=Gasolina, `2`=Álcool, `3`=Diesel; `32000-S`=0 km).
- A resposta de **Valor** já traz `Marca`, `Modelo` e `AnoModelo` limpos — usar esses como fonte
  canônica dos nomes gravados em `make`/`model`/`year`.
- Rate limit existe na v1 (pode dar `429`); o tratamento é o fallback manual (ver §6).

## 3. Arquitetura

Duas unidades novas + uma alterada. Nenhuma mudança de banco.

### 3.1 `src/lib/fipe.ts` — client puro (sem React)

- `type FipeTipo = "carros" | "motos" | "caminhoes"`.
- `fetchMarcas(tipo): Promise<FipeMarca[]>` — `FipeMarca = { codigo: string; nome: string }`.
- `fetchModelos(tipo, marcaCod): Promise<FipeModelo[]>` — desembrulha `.modelos`; `codigo` normalizado para string.
- `fetchAnos(tipo, marcaCod, modeloCod): Promise<FipeAno[]>` — `FipeAno = { codigo: string; nome: string }`.
- `fetchValor(tipo, marcaCod, modeloCod, anoCod): Promise<FipeValor>` — objeto bruto tipado.
- Helpers puros e isolados (fáceis de raciocinar/verificar):
  - `parseFipeValor(s: string): number` — `"R$ 86.472,00"` → `86472`. Remove `R$`/espaços/`.` de milhar, troca `,` por `.`.
  - `mapFipeFuel(sigla: string): Fuel | null` — `G→"gasolina"`, `A→"etanol"`, `D→"diesel"`; senão `null`.
  - `fipeYear(anoModelo: number): number | null` — `>= 3000` (ex.: 32000 = 0 km) → ano atual; senão o próprio valor.
- Cada `fetch*` lança `Error` com mensagem amigável em status não-2xx (consumido pelo react-query).

### 3.2 `src/features/seller/components/FipeSelector.tsx` — cascata + toggle manual

- **Props:** `{ onSelect: (r: FipeResult) => void; onManual: () => void; manual: boolean; onToggleManual: (v: boolean) => void }`,
  onde `FipeResult = { make: string; model: string; year: number | null; fipePrice: number; fuel: Fuel | null }`.
- **Estado local** (não são campos do form): `tipo`, `marcaCod`, `modeloCod`, `anoCod`. Trocar um nível
  reseta os filhos.
- **Hooks react-query** (co-locados no arquivo, ou `fipeQueries.ts`): `useFipeMarcas(tipo)`,
  `useFipeModelos(tipo, marca)`, `useFipeAnos(tipo, marca, modelo)`. `enabled` encadeado (modelos só
  quando há marca, etc.). `staleTime`/`gcTime` longos (FIPE muda 1x/mês — usar 24h). `queryKey` inclui
  tipo + códigos.
- **Busca do valor:** ao escolher o ano, chamar `queryClient.fetchQuery` (ou um `useQuery` com `enabled`
  no anoCod) para `fetchValor`; ao resolver, montar `FipeResult` (`make`/`model`/`year` da resposta,
  `fipePrice = parseFipeValor`, `fuel = mapFipeFuel`) e chamar `onSelect`.
- **Selects nativos** (`Select` do `ui-light`), com spinner/disabled enquanto carregam. Listas longas
  (modelos) usam type-ahead nativo do `<select>` — combobox com busca fica como melhoria futura (YAGNI).
- **Toggle manual:** um link/checkbox "não encontrei / preencher manualmente" que chama `onToggleManual`.

### 3.3 `Vehicles.tsx` (VehicleForm) — integração

- Novo estado `manual: boolean` no `VehicleForm`. Inicializa `true` quando editando um veículo cuja
  `make` **não** está entre as marcas FIPE conhecidas — heurística simples: começa manual em **edição**
  de qualquer veículo existente (dados legados), e começa em **modo FIPE** em **criação**. (Evita
  bloquear o fluxo carregando marcas só para decidir o default.)
- Quando `!manual`: renderiza `<FipeSelector …/>` no lugar dos três `Field` (Marca/Modelo/Ano).
  `onSelect(r)` faz `setValue` em `make`, `model`, `year`, `fipe_price`, `price` (sugestão) e, se
  `r.fuel`, em `fuel`. Os campos `make`/`model`/`year` continuam registrados no form (hidden ou
  read-only) para a validação zod existente continuar válida.
- Quando `manual`: renderiza os `Field` de texto originais (Marca/Modelo/Ano) — comportamento atual.
- `Preço` e `Preço FIPE` permanecem campos editáveis visíveis nos dois modos.
- O `onSubmit`/payload e o `useSaveVehicle` **não mudam**.

## 4. Fluxo de dados (modo FIPE, criação)

1. Form abre → `tipo = "carros"` → `useFipeMarcas` carrega marcas.
2. Seleciona Marca → carrega modelos. Seleciona Modelo → carrega anos.
3. Seleciona Ano → `fetchValor` → `onSelect`:
   - `make` = `resp.Marca`, `model` = `resp.Modelo`, `year` = `fipeYear(resp.AnoModelo)`,
   - `fipe_price` = `parseFipeValor(resp.Valor)`, `price` = mesmo valor (editável),
   - `fuel` = `mapFipeFuel(resp.SiglaCombustivel)` se não-nulo.
4. Garagista ajusta o Preço se quiser → **submit usa o fluxo de save existente**.

## 5. Banco de dados

**Nenhuma migration.** A feature usa apenas colunas existentes em `rv_vehicles`: `make`, `model`,
`year`, `price`, `fipe_price`, `fuel`. (Melhoria futura possível: coluna `codigo_fipe` para
re-precificar — **fora do escopo**.)

## 6. Erros e estados de carregamento

- Cada select desabilitado + spinner enquanto sua query está `isLoading`.
- Falha em qualquer `fetch*` (rede, `429`, `5xx`): exibir aviso **não-bloqueante** dentro da seção FIPE
  — "Não foi possível consultar a FIPE agora. Tente novamente ou preencha manualmente." — com botão que
  ativa o modo manual. O form permanece salvável pelo modo manual.
- `parseFipeValor` defensivo: se não conseguir parsear, não preenche `price`/`fipe_price` e mantém o que
  estava.

## 7. Edge cases

- **0 km:** `AnoModelo` 32000 → `fipeYear` retorna o ano atual.
- **Combustível sem equivalente** (flex/híbrido/elétrico/GNV não derivam da sigla FIPE) → não sobrescreve `fuel`.
- **Edição de veículo legado** (marca fora da FIPE) → inicia em modo manual; usuário pode trocar para FIPE.
- **Preço já preenchido em edição:** ao entrar no modo manual, valores atuais são mantidos.
- **Troca de Tipo/Marca/Modelo** reseta os selects-filhos e não dispara `onSelect` até haver um Ano.

## 8. Testes / verificação

Projeto sem runner unitário → gate = **`tsc -b` + `npm run build`**. Os helpers puros
(`parseFipeValor`, `mapFipeFuel`, `fipeYear`) são isolados e verificáveis por inspeção. Checklist de
verificação manual:

1. Criar veículo (carro): selecionar Marca→Modelo→Ano e confirmar que Preço FIPE e Preço são preenchidos
   com o valor da FIPE e o combustível mapeado.
2. Ajustar o Preço manualmente e salvar; conferir persistência.
3. Trocar o Tipo para Moto/Caminhão e repetir a cascata.
4. Toggle "preencher manualmente" → campos de texto aparecem e salvam normalmente.
5. Editar um veículo legado → abre em modo manual sem quebrar.
6. Simular falha de rede/rate-limit → aviso não-bloqueante + fallback manual funcionam.

## 9. Fora do escopo

- Persistir `CodigoFipe`/mês de referência no banco.
- Combobox com busca textual (selects nativos por ora).
- Re-precificação automática de estoque quando a FIPE atualiza.
- Cache server-side / Edge Function proxy (só react-query no client).
