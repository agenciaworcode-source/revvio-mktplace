export type BrandVariant = "wordmark" | "lockup" | "mark";

/**
 * Logo Revvender.
 *
 * O nome é uma imagem — antes o wordmark era montado em CSS ("REV" + "VIO"),
 * o que não reproduz a assinatura nova.
 *
 * `theme` diz sobre que fundo o logo vai: "light" é a versão para fundo escuro
 * (o "R" sai branco) e "dark" é a para fundo claro.
 *
 * `variant`:
 *  • `wordmark` (padrão) — só REVVENDER. É o certo para cabeçalhos: no lockup
 *    completo, a linha "powered by Revvio" fica ilegível abaixo de ~40px.
 *  • `lockup` — com o "powered by Revvio". Use onde há altura sobrando.
 *  • `mark` — só o ícone, para espaços apertados (barra mobile).
 */
export function BrandLogo({
  height = 28,
  theme = "light",
  variant = "wordmark",
}: {
  height?: number;
  theme?: "light" | "dark";
  variant?: BrandVariant;
}) {
  const tema = theme === "light" ? "light" : "dark";
  const src = `/brand/${variant}-${tema}.png`;

  return (
    <img
      src={src}
      alt="Revvender"
      style={{ height }}
      className="w-auto"
      // O logo abre toda página: carregar cedo evita o cabeçalho "pular".
      fetchPriority="high"
      decoding="async"
    />
  );
}
