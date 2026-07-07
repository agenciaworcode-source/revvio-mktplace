/** Logo REVVIO: ícone (marca) + wordmark. A marca tem branco, então fica
 * ótima sobre fundos escuros; em fundo claro use theme="dark" no texto. */
export function BrandLogo({
  height = 28,
  theme = "light",
}: {
  height?: number;
  /** "light" = REV branco (fundo escuro); "dark" = REV escuro (fundo claro). */
  theme?: "light" | "dark";
}) {
  return (
    <span className="flex items-center gap-2">
      <img
        src="/revvio-mark.png"
        alt="REVVIO"
        style={{ height }}
        className="w-auto"
      />
      <span
        className="font-display font-extrabold tracking-tight"
        style={{ fontSize: height * 0.72, lineHeight: 1 }}
      >
        <span className={theme === "light" ? "text-white" : "text-slate-900"}>
          REV
        </span>
        <span className="text-brand">VIO</span>
      </span>
    </span>
  );
}
