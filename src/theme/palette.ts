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

/**
 * Cores que mudam junto com a marca.
 *
 * `DEFAULT` e `panel.top` vêm direto dos arquivos de identidade; os demais
 * tons foram derivados por mistura com branco/preto até bater a mesma
 * luminosidade que o tom equivalente tinha na paleta anterior — assim a
 * hierarquia visual do sistema se manteve ao trocar o matiz.
 */
export const brand = {
  DEFAULT: "#36ae84",
  dark: "#257659",
  light: "#dbf0e9",
  /** Barra inativa do gráfico de MRR (verde bem lavado). */
  tint: "#e6f5f0",
  /** Parada intermediária dos gradientes de destaque. */
  mid: "#288262",
  /** Parada final do gradiente do CTA da landing. */
  deep: "#1f654d",
} as const;

/** Superfícies escuras: sidebar dos painéis, faixas de topo e banners. */
export const panel = {
  /** Topo do gradiente da sidebar. */
  top: "#062a2a",
  /** Base do gradiente da sidebar. */
  bottom: "#031818",
  /** Realce azulado do banner das mini-lojas. */
  accent: "#1f4040",
} as const;

/**
 * Neutros da interface clara. Não mudam com a marca, mas estavam repetidos
 * dezenas de vezes como hex solto — `line` aparecia 18x e `raised` 13x.
 */
export const neutral = {
  /** Preto da marca, usado em faixas escuras e no rodapé. */
  ink: "#021111",
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
 * Rampa verde 50–950, sobrepondo o `emerald` do Tailwind.
 *
 * O código usa `emerald-*` em ~46 pontos como verde da marca (botão de
 * WhatsApp do lead, Badge "green", Alert "success", valores positivos) — e não
 * por acaso: o `emerald-500` do Tailwind É o verde antigo, #10b981. Sem
 * sobrepor, esses pontos continuariam no verde velho ao lado do novo.
 *
 * Cada degrau foi derivado da marca nova mantendo a luminosidade do degrau
 * equivalente do Tailwind, então a rampa preserva os contrastes originais.
 */
export const green = {
  50: "#f0f9f6",
  100: "#dbf0e9",
  200: "#b7e2d3",
  300: "#87ceb5",
  400: "#4fb893",
  500: "#309974",
  600: "#257659",
  700: "#1d5e48",
  800: "#184d3a",
  900: "#144131",
  950: "#0b221a",
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
