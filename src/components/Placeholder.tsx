import { Link } from "react-router-dom";

/** Stub temporário das páginas — substituído nas fases 3–5. */
export function Placeholder({ title }: { title: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="text-xs font-bold uppercase tracking-[2px] text-brand">
        REVVIO 2.0
      </span>
      <h1 className="text-3xl font-black">{title}</h1>
      <p className="max-w-md text-sm text-slate-400">
        Tela placeholder — será implementada nas próximas fases do roadmap.
      </p>
      <Link to="/" className="text-sm font-semibold text-brand hover:underline">
        ← Voltar ao marketplace
      </Link>
    </div>
  );
}
