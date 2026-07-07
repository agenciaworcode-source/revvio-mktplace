/** Utilitários de localidades brasileiras (IBGE). */

export interface UF {
  sigla: string;
  nome: string;
}

/** 27 unidades federativas, em ordem alfabética por nome. */
export const UFS: UF[] = [
  { sigla: "AC", nome: "Acre" },
  { sigla: "AL", nome: "Alagoas" },
  { sigla: "AP", nome: "Amapá" },
  { sigla: "AM", nome: "Amazonas" },
  { sigla: "BA", nome: "Bahia" },
  { sigla: "CE", nome: "Ceará" },
  { sigla: "DF", nome: "Distrito Federal" },
  { sigla: "ES", nome: "Espírito Santo" },
  { sigla: "GO", nome: "Goiás" },
  { sigla: "MA", nome: "Maranhão" },
  { sigla: "MT", nome: "Mato Grosso" },
  { sigla: "MS", nome: "Mato Grosso do Sul" },
  { sigla: "MG", nome: "Minas Gerais" },
  { sigla: "PA", nome: "Pará" },
  { sigla: "PB", nome: "Paraíba" },
  { sigla: "PR", nome: "Paraná" },
  { sigla: "PE", nome: "Pernambuco" },
  { sigla: "PI", nome: "Piauí" },
  { sigla: "RJ", nome: "Rio de Janeiro" },
  { sigla: "RN", nome: "Rio Grande do Norte" },
  { sigla: "RS", nome: "Rio Grande do Sul" },
  { sigla: "RO", nome: "Rondônia" },
  { sigla: "RR", nome: "Roraima" },
  { sigla: "SC", nome: "Santa Catarina" },
  { sigla: "SP", nome: "São Paulo" },
  { sigla: "SE", nome: "Sergipe" },
  { sigla: "TO", nome: "Tocantins" },
];

const cache = new Map<string, string[]>();

/**
 * Lista os municípios de uma UF (sigla) via API do IBGE, em ordem alfabética.
 * Resultado é cacheado em memória por sessão.
 */
export async function fetchCidades(uf: string): Promise<string[]> {
  const key = uf.toUpperCase();
  const cached = cache.get(key);
  if (cached) return cached;

  const res = await fetch(
    `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${key}/municipios?orderBy=nome`
  );
  if (!res.ok) throw new Error("Falha ao carregar as cidades.");
  const data = (await res.json()) as Array<{ nome: string }>;
  const nomes = data.map((m) => m.nome);
  cache.set(key, nomes);
  return nomes;
}
