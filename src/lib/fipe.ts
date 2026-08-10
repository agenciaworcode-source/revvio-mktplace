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
  fipePrice: number | null;
  fuel: FuelType | null;
};

/** `fetchResult` + os campos que a página pública de consulta exibe. */
export type FipeValorDetalhado = FipeResult & {
  /** Valor já formatado pela FIPE ("R$ 86.472,00"). */
  valorLabel: string;
  /** Código da tabela ("008030-6"). */
  codigoFipe: string;
  /** Mês da tabela consultada ("junho de 2026"). */
  mesReferencia: string;
  /** Combustível por extenso ("Gasolina"). */
  combustivel: string;
};

type RawValor = {
  Valor: string;
  Marca: string;
  Modelo: string;
  AnoModelo: number;
  Combustivel: string;
  CodigoFipe: string;
  MesReferencia: string;
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

export async function fetchValorDetalhado(
  tipo: FipeTipo,
  marcaCod: string,
  modeloCod: string,
  anoCod: string
): Promise<FipeValorDetalhado> {
  const raw = await getJson<RawValor>(
    `${BASE}/${tipo}/marcas/${marcaCod}/modelos/${modeloCod}/anos/${anoCod}`
  );
  const fipePrice = parseFipeValor(raw.Valor);
  return {
    make: raw.Marca,
    model: raw.Modelo,
    year: fipeYear(raw.AnoModelo),
    fipePrice: Number.isNaN(fipePrice) ? null : fipePrice,
    fuel: mapFipeFuel(raw.SiglaCombustivel),
    valorLabel: raw.Valor,
    codigoFipe: raw.CodigoFipe,
    mesReferencia: raw.MesReferencia,
    combustivel: raw.Combustivel,
  };
}

export function fetchResult(
  tipo: FipeTipo,
  marcaCod: string,
  modeloCod: string,
  anoCod: string
): Promise<FipeResult> {
  return fetchValorDetalhado(tipo, marcaCod, modeloCod, anoCod);
}

/* ============================================================
   Slugs das URLs públicas (/tabela-fipe/:marca/:modelo/:ano)
   ============================================================ */

/** "VW - VolksWagen" -> "vw-volkswagen"; "80 2.6/2.8" -> "80-2-6-2-8". */
export function slugify(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[^\x00-\x7F]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Slug único dentro de uma lista. A FIPE tem nomes que colidem depois de
 * normalizados ("80 2.6/ 2.8" e "80 2.6/2.8" viram o mesmo slug); a partir da
 * segunda ocorrência entra o sufixo -2, -3… na ordem em que a API devolve.
 * Gerar e resolver usam esta mesma função, então o par sempre bate.
 */
export function slugsUnicos(nomes: string[]): string[] {
  const vistos = new Map<string, number>();
  return nomes.map((nome) => {
    const base = slugify(nome);
    const n = (vistos.get(base) ?? 0) + 1;
    vistos.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  });
}

/**
 * Primeira palavra do modelo — é como a listagem da marca é agrupada.
 * Em caixa alta porque a FIPE mistura grafias na mesma família ("Uno" e
 * "UNO", "Blazer" e "BLAZER"), que sem normalizar viram dois grupos.
 */
export function grupoDoModelo(nome: string): string {
  return (nome.trim().split(/\s+/)[0] ?? nome).toUpperCase();
}

/* ============================================================
   Histórico de preços (API v2, só para assinantes)
   ============================================================ */

const V2 = "https://parallelum.com.br/fipe/api/v2";

const V2_TIPO: Record<FipeTipo, string> = {
  carros: "cars",
  motos: "motorcycles",
  caminhoes: "trucks",
};

/**
 * Token da parallelum (https://fipe.api.br). A consulta de meses anteriores é
 * paga: sem token a API devolve 402 e a página esconde o gráfico/histórico.
 */
const FIPE_TOKEN = import.meta.env.VITE_FIPE_TOKEN as string | undefined;

export const historicoDisponivel = !!FIPE_TOKEN;

export type FipeReferencia = { codigo: number; mes: string };
export type FipeHistoricoPonto = { mes: string; preco: number };

/** Tabelas de referência da FIPE, da mais recente para a mais antiga. */
export async function fetchReferencias(): Promise<FipeReferencia[]> {
  const data = await getJson<{ Codigo: number; Mes: string }[]>(`${BASE}/referencias`);
  return data.map((r) => ({ codigo: r.Codigo, mes: r.Mes }));
}

/**
 * Valor do veículo nos últimos `meses` fechamentos da tabela, do mais antigo
 * para o mais novo (ordem em que o gráfico desenha). Meses que a API recusar
 * são descartados em vez de derrubar a página inteira.
 */
export async function fetchHistorico(
  tipo: FipeTipo,
  marcaCod: string,
  modeloCod: string,
  anoCod: string,
  meses = 13
): Promise<FipeHistoricoPonto[]> {
  if (!FIPE_TOKEN) return [];
  const refs = (await fetchReferencias()).slice(0, meses);
  const url = `${V2}/${V2_TIPO[tipo]}/brands/${marcaCod}/models/${modeloCod}/years/${anoCod}`;

  const pontos = await Promise.all(
    refs.map(async (ref) => {
      try {
        const res = await fetch(`${url}?reference=${ref.codigo}`, {
          headers: { "X-Subscription-Token": FIPE_TOKEN },
        });
        if (!res.ok) return null;
        const json = (await res.json()) as { price?: string };
        const preco = parseFipeValor(json.price ?? "");
        if (Number.isNaN(preco)) return null;
        return { mes: ref.mes.replace("/", " de "), preco };
      } catch {
        return null;
      }
    })
  );

  return pontos.filter((p): p is FipeHistoricoPonto => p !== null).reverse();
}
