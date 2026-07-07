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

export type LookupResult =
  | { status: "ok"; data: BrasilApiCnpj }
  | { status: "not_found" }
  | { status: "unavailable" };

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { at: number; result: LookupResult }>();

/**
 * Consulta a BrasilAPI com cache em memória (TTL 5min) e timeout de 5s.
 * Distingue "não encontrado" (404) de "indisponível" (rede/timeout/5xx/429),
 * para que uma instabilidade da BrasilAPI não seja reportada como CNPJ inexistente.
 * Só "ok"/"not_found" são cacheados; "unavailable" não (permite retry).
 */
export async function lookupCnpj(cnpj: string): Promise<LookupResult> {
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) return { status: "not_found" };

  const cached = cache.get(digits);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.result;

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 5_000);
  let result: LookupResult;
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`, {
      signal: ac.signal,
    });
    if (res.status === 404) {
      result = { status: "not_found" };
    } else if (!res.ok) {
      result = { status: "unavailable" };
    } else {
      result = { status: "ok", data: (await res.json()) as BrasilApiCnpj };
    }
  } catch {
    result = { status: "unavailable" };
  } finally {
    clearTimeout(timer);
  }

  if (result.status !== "unavailable") cache.set(digits, { at: Date.now(), result });
  return result;
}

export type CnpjValidation = {
  ok: boolean;
  reason?: "inactive" | "cnae";
  name: string;
  city: string;
  situacao: string;
};

export function validateCnpj(data: BrasilApiCnpj): CnpjValidation {
  const name = data.nome_fantasia?.trim() || data.razao_social?.trim() || "";
  const city = data.municipio ? titleCase(data.municipio.trim()) : "";
  const situacaoRaw =
    data.descricao_situacao_cadastral ||
    (typeof data.situacao_cadastral === "string" ? data.situacao_cadastral : "");
  const situacao = situacaoRaw.trim().toUpperCase();

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
