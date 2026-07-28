/**
 * Fonte única da identidade visual.
 *
 * O `tailwind.config.ts` lê deste arquivo para gerar as classes utilitárias
 * (`bg-brand`, `border-stroke`, `shadow-card`…), e os poucos pontos que
 * precisam da cor em JavaScript — gradientes inline e o `accent` dos cards de
 * KPI — importam daqui. Trocar a identidade é editar só este arquivo.
 *
 * Regra: nenhum hex de marca ou de superfície escrito direto em componente.
 */

/** Cores que mudam junto com a marca. */
export const brand = {
  DEFAULT: "#10b981",
  dark: "#059669",
  light: "#d1fae5",
  /** Barra inativa do gráfico de MRR (verde bem lavado). */
  tint: "#e6f6ef",
  /** Parada intermediária dos gradientes de destaque. */
  mid: "#0f9b73",
  /** Parada final do gradiente do CTA da landing. */
  deep: "#0b7a5a",
} as const;

/** Superfícies escuras: sidebar dos painéis, faixas de topo e banners. */
export const panel = {
  /** Topo do gradiente da sidebar. */
  top: "#0c1322",
  /** Base do gradiente da sidebar. */
  bottom: "#070b14",
  /** Realce azulado do banner das mini-lojas. */
  accent: "#1b2a44",
} as const;

/**
 * Neutros da interface clara. Não mudam com a marca, mas estavam repetidos
 * dezenas de vezes como hex solto — `line` aparecia 18x e `raised` 13x.
 */
export const neutral = {
  /** Preto da marca, usado em faixas escuras e no rodapé. */
  ink: "#08090c",
  /** Fundo geral do app, atrás dos cards. */
  cloud: "#f4f5f7",
  /** Fundo sutil de inputs, cabeçalho de tabela e faixas de filtro. */
  raised: "#fbfbfc",
  /** Fundo do hover das linhas de tabela. */
  row: "#fafbfc",
  /** Borda padrão dos cards. */
  hair: "#ecedf1",
  /** Divisor interno de tabelas e cards. */
  line: "#f1f3f5",
  /** Borda de controles: inputs, selects, botões neutros. */
  stroke: "#e3e5e9",
  /** Borda de botões secundários sobre fundo branco. */
  "stroke-soft": "#e6e8ec",
  /** Cor-base das sombras de elevação (nunca usada como fundo). */
  shade: "#101828",
  /** Texto de placeholder. */
  muted: "#b0b7c0",
} as const;

/**
 * Cores semânticas de status e de terceiros.
 *
 * NÃO fazem parte da identidade: `whatsapp` é a cor oficial do app e precisa
 * continuar sendo ela mesma depois do rebrand; as demais comunicam estado
 * (pendente, erro, categoria) e mudariam só numa revisão de semântica.
 */
export const status = {
  amber: "#f59e0b",
  "amber-dark": "#b45309",
  violet: "#8b5cf6",
  blue: "#3b82f6",
  red: "#ef4444",
  "red-dark": "#dc2626",
  whatsapp: "#25d366",
} as const;

/**
 * Sombra de elevação dos cards — a única repetida à risca (12x no código).
 * As demais variam na geometria e puxam só a cor do token, direto na classe:
 * `shadow-[0_6px_16px_theme(colors.brand.DEFAULT/0.28)]`.
 *
 * Atenção: `theme(colors.brand/…)` NÃO resolve, porque `brand` é um objeto —
 * o `.DEFAULT` é obrigatório.
 */
export const shadows = {
  card: "0 1px 2px rgba(16,24,40,.04)",
} as const;

/** Agrupamento para quem precisa das cores em JavaScript. */
export const palette = { brand, panel, neutral, status } as const;

/**
 * Cor do token com transparência, para gradientes e sombras escritos em
 * JavaScript — onde as classes do Tailwind não alcançam.
 * `withAlpha(brand.DEFAULT, 0.25)` → `"rgba(16,185,129,0.25)"`.
 */
export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
