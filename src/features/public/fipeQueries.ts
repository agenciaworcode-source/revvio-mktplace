import { useQuery } from "@tanstack/react-query";
import {
  fetchAnos,
  fetchHistorico,
  fetchMarcas,
  fetchModelos,
  fetchValorDetalhado,
  grupoDoModelo,
  historicoDisponivel,
  slugify,
  slugsUnicos,
  type FipeAno,
  type FipeMarca,
  type FipeModelo,
  type FipeTipo,
  type FipeValorDetalhado,
} from "@/lib/fipe";

/* ============================================================
   Consulta pública da tabela FIPE (/tabela-fipe)
   ============================================================

   A FIPE identifica tudo por código numérico ("6", "44", "1995-1"), que não
   serve para URL indexável. Aqui cada nível ganha um slug derivado do nome e
   a resolução slug → código acontece na própria lista já em cache, sem
   chamada extra: quem abre /tabela-fipe/audi/a3-sportback/2020-flex baixa as
   mesmas três listas que a navegação por cliques baixaria.
*/

/** Tempo de cache: a FIPE fecha uma tabela por mês, um dia é conservador. */
const DIA = 24 * 60 * 60 * 1000;

/** A página pública cobre a tabela de carros, como a tabela oficial exibe. */
export const TIPO: FipeTipo = "carros";

const cacheLongo = { staleTime: DIA, gcTime: DIA } as const;

export type MarcaFipe = FipeMarca & { slug: string; letra: string };
export type ModeloFipe = FipeModelo & { slug: string; grupo: string };
export type AnoFipe = FipeAno & {
  slug: string;
  /** Ano do modelo; `null` quando é 0 km (a FIPE devolve 32000). */
  ano: number | null;
  /** "1995" ou "0 km". */
  label: string;
  combustivel: string;
};

const ordemPt = (a: string, b: string) => a.localeCompare(b, "pt-BR");

/** Primeira letra do nome, sem acento, para o índice A–Z das marcas. */
function letraInicial(nome: string): string {
  const s = slugify(nome);
  const c = s.charAt(0).toUpperCase();
  return /[A-Z]/.test(c) ? c : "#";
}

/* ── Marcas ─────────────────────────────────────────────── */

export function useMarcas() {
  return useQuery({
    queryKey: ["fipe", "marcas", TIPO],
    queryFn: async (): Promise<MarcaFipe[]> => {
      const marcas = [...(await fetchMarcas(TIPO))].sort((a, b) => ordemPt(a.nome, b.nome));
      const slugs = slugsUnicos(marcas.map((m) => m.nome));
      return marcas.map((m, i) => ({
        ...m,
        slug: slugs[i],
        letra: letraInicial(m.nome),
      }));
    },
    ...cacheLongo,
  });
}

/** Marcas agrupadas pela inicial, na ordem em que o índice A–Z as lista. */
export function agruparPorLetra(marcas: MarcaFipe[]) {
  const grupos = new Map<string, MarcaFipe[]>();
  for (const m of marcas) {
    const atual = grupos.get(m.letra);
    if (atual) atual.push(m);
    else grupos.set(m.letra, [m]);
  }
  return [...grupos.entries()]
    .map(([letra, itens]) => ({ letra, itens }))
    .sort((a, b) => ordemPt(a.letra, b.letra));
}

/* ── Modelos ────────────────────────────────────────────── */

export function useModelos(marcaCod: string | undefined) {
  return useQuery({
    queryKey: ["fipe", "modelos", TIPO, marcaCod],
    enabled: !!marcaCod,
    queryFn: async (): Promise<ModeloFipe[]> => {
      const modelos = [...(await fetchModelos(TIPO, marcaCod!))].sort((a, b) =>
        ordemPt(a.nome, b.nome)
      );
      const slugs = slugsUnicos(modelos.map((m) => m.nome));
      return modelos.map((m, i) => ({
        ...m,
        slug: slugs[i],
        grupo: grupoDoModelo(m.nome),
      }));
    },
    ...cacheLongo,
  });
}

/** Modelos agrupados pela primeira palavra do nome ("A3", "Gol", "Onix"). */
export function agruparPorFamilia(modelos: ModeloFipe[]) {
  const grupos = new Map<string, ModeloFipe[]>();
  for (const m of modelos) {
    const atual = grupos.get(m.grupo);
    if (atual) atual.push(m);
    else grupos.set(m.grupo, [m]);
  }
  return [...grupos.entries()]
    .map(([grupo, itens]) => ({ grupo, itens }))
    .sort((a, b) => ordemPt(a.grupo, b.grupo));
}

/* ── Anos ───────────────────────────────────────────────── */

/** "1995 Gasolina" -> ano 1995 + combustível; 32000 é o 0 km da FIPE. */
function parseAno(nome: string) {
  const [primeiro, ...resto] = nome.trim().split(/\s+/);
  const n = Number.parseInt(primeiro, 10);
  const zeroKm = !Number.isFinite(n) || n >= 3000;
  return {
    ano: zeroKm ? null : n,
    label: zeroKm ? "0 km" : String(n),
    combustivel: resto.join(" "),
  };
}

export function useAnos(marcaCod: string | undefined, modeloCod: string | undefined) {
  return useQuery({
    queryKey: ["fipe", "anos", TIPO, marcaCod, modeloCod],
    enabled: !!marcaCod && !!modeloCod,
    queryFn: async (): Promise<AnoFipe[]> => {
      const anos = await fetchAnos(TIPO, marcaCod!, modeloCod!);
      const partes = anos.map((a) => parseAno(a.nome));
      const slugs = slugsUnicos(partes.map((p) => `${p.label} ${p.combustivel}`));
      return anos.map((a, i) => ({ ...a, ...partes[i], slug: slugs[i] }));
    },
    ...cacheLongo,
  });
}

/* ── Valor ──────────────────────────────────────────────── */

export function useValor(
  marcaCod: string | undefined,
  modeloCod: string | undefined,
  anoCod: string | undefined
) {
  return useQuery({
    queryKey: ["fipe", "valor", TIPO, marcaCod, modeloCod, anoCod],
    enabled: !!marcaCod && !!modeloCod && !!anoCod,
    queryFn: () => fetchValorDetalhado(TIPO, marcaCod!, modeloCod!, anoCod!),
    ...cacheLongo,
  });
}

/* ── Outras versões do mesmo ano ────────────────────────── */

export type VersaoComparada = {
  modelo: ModeloFipe;
  /** Sufixo do nome sem a família repetida: "A3 1.8 TFSI" -> "1.8 TFSI". */
  versao: string;
  anoSlug: string;
  valor: FipeValorDetalhado;
};

/** Teto de irmãos comparados — cada um custa 2 chamadas à FIPE. */
const MAX_VERSOES = 6;

/**
 * Preço das demais versões da mesma família no mesmo ano, para a tabela
 * comparativa. Irmão que não tiver o ano (ou cuja consulta falhar) some da
 * tabela em vez de derrubar a página.
 */
export function useVersoesDoAno(
  marcaCod: string | undefined,
  modelos: ModeloFipe[] | undefined,
  modeloAtual: ModeloFipe | undefined,
  ano: number | null | undefined,
  combustivel: string | undefined
) {
  const grupo = modeloAtual?.grupo;
  // O modelo consultado entra sempre — em família grande ele cairia fora do
  // corte e a tabela compararia versões sem mostrar a que o visitante abriu.
  const irmaos = (modelos ?? [])
    .filter((m) => m.grupo === grupo && m.codigo !== modeloAtual?.codigo)
    .slice(0, MAX_VERSOES - 1);
  if (modeloAtual) irmaos.unshift(modeloAtual);

  return useQuery({
    queryKey: [
      "fipe",
      "versoes",
      TIPO,
      marcaCod,
      grupo,
      ano,
      combustivel,
      irmaos.map((m) => m.codigo).join(","),
    ],
    enabled: !!marcaCod && irmaos.length > 0 && ano !== undefined,
    queryFn: async (): Promise<VersaoComparada[]> => {
      const resultados = await Promise.all(
        irmaos.map(async (modelo) => {
          try {
            const anos = await fetchAnos(TIPO, marcaCod!, modelo.codigo);
            const candidatos = anos
              .map((a) => ({ ...a, ...parseAno(a.nome) }))
              .filter((a) => a.ano === ano);
            const alvo =
              candidatos.find((a) => a.combustivel === combustivel) ?? candidatos[0];
            if (!alvo) return null;
            const valor = await fetchValorDetalhado(
              TIPO,
              marcaCod!,
              modelo.codigo,
              alvo.codigo
            );
            const slugs = slugsUnicos(
              anos.map((a) => {
                const p = parseAno(a.nome);
                return `${p.label} ${p.combustivel}`;
              })
            );
            const anoSlug = slugs[anos.findIndex((a) => a.codigo === alvo.codigo)];
            const versao = modelo.nome.slice(modelo.grupo.length).trim();
            return { modelo, versao: versao || modelo.nome, anoSlug, valor };
          } catch {
            return null;
          }
        })
      );
      return resultados.filter((r): r is VersaoComparada => r !== null);
    },
    ...cacheLongo,
  });
}

/* ── Histórico mensal ───────────────────────────────────── */

export { historicoDisponivel };

export function useHistorico(
  marcaCod: string | undefined,
  modeloCod: string | undefined,
  anoCod: string | undefined
) {
  return useQuery({
    queryKey: ["fipe", "historico", TIPO, marcaCod, modeloCod, anoCod],
    enabled: historicoDisponivel && !!marcaCod && !!modeloCod && !!anoCod,
    queryFn: () => fetchHistorico(TIPO, marcaCod!, modeloCod!, anoCod!),
    ...cacheLongo,
  });
}

/* ── Resolução slug → registro ──────────────────────────── */

export const acharPorSlug = <T extends { slug: string }>(
  itens: T[] | undefined,
  slug: string | undefined
): T | undefined => (slug ? itens?.find((i) => i.slug === slug) : undefined);

export const fipeUrl = {
  raiz: "/tabela-fipe",
  marca: (marca: string) => `/tabela-fipe/${marca}`,
  modelo: (marca: string, modelo: string) => `/tabela-fipe/${marca}/${modelo}`,
  valor: (marca: string, modelo: string, ano: string) =>
    `/tabela-fipe/${marca}/${modelo}/${ano}`,
};
