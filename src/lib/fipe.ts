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
  const fipePrice = parseFipeValor(raw.Valor);
  return {
    make: raw.Marca,
    model: raw.Modelo,
    year: fipeYear(raw.AnoModelo),
    fipePrice: Number.isNaN(fipePrice) ? null : fipePrice,
    fuel: mapFipeFuel(raw.SiglaCombustivel),
  };
}
