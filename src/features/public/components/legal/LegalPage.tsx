import type { ReactNode } from "react";
import { PublicShell } from "../../PublicShell";
import { Icon } from "../icons";

export type LegalSection = {
  id: string;
  heading: string;
  body: ReactNode;
};

/**
 * Layout das páginas legais (Política de Privacidade, Termos e Condições):
 * cabeçalho com título + data, índice clicável e seções numeradas.
 */
export function LegalPage({
  title,
  updatedAt,
  intro,
  sections,
}: {
  title: string;
  updatedAt: string;
  intro: string;
  sections: LegalSection[];
}) {
  return (
    <PublicShell>
      {/* cabeçalho */}
      <section className="border-b border-hair bg-cloud">
        <div className="mx-auto max-w-[980px] px-5 py-12 sm:px-7">
          <span className="inline-block rounded-full bg-brand/10 px-3.5 py-1.5 text-[11.5px] font-bold uppercase tracking-wider text-brand">
            Revvio
          </span>
          <h1 className="mt-4 font-display text-[clamp(28px,4vw,40px)] font-extrabold tracking-tight text-slate-900">
            {title}
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-slate-500">{intro}</p>
          <p className="mt-4 text-[13px] text-slate-400">Última atualização: {updatedAt}</p>
        </div>
      </section>

      {/* conteúdo */}
      <div className="mx-auto grid max-w-[980px] gap-10 px-5 py-12 sm:px-7 lg:grid-cols-[240px_1fr]">
        {/* índice */}
        <nav className="hidden lg:block">
          <div className="sticky top-28">
            <p className="text-[11.5px] font-bold uppercase tracking-wider text-slate-400">
              Nesta página
            </p>
            <ul className="mt-4 flex flex-col gap-2">
              {sections.map((s, i) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="flex items-start gap-2 text-[13.5px] text-slate-600 hover:text-brand"
                  >
                    <span className="font-bold text-brand">{i + 1}.</span>
                    {s.heading}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        {/* seções */}
        <div className="flex flex-col gap-10">
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} className="scroll-mt-28">
              <h2 className="flex items-center gap-2.5 text-[19px] font-extrabold text-slate-900">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand/10 text-[13px] font-extrabold text-brand">
                  {i + 1}
                </span>
                {s.heading}
              </h2>
              <div className="mt-3 space-y-3 text-[14.5px] leading-relaxed text-slate-600">
                {s.body}
              </div>
            </section>
          ))}

          <div className="mt-2 flex items-center gap-2 rounded-xl border border-hair bg-cloud px-4 py-3.5 text-[13.5px] text-slate-500">
            <Icon name="mail" size={16} className="text-brand" />
            Dúvidas? Fale com a gente em{" "}
            <a href="mailto:contato@revvio.com.br" className="font-semibold text-brand">
              contato@revvio.com.br
            </a>
          </div>
        </div>
      </div>
    </PublicShell>
  );
}

/** Lista com marcadores em verde, reutilizada no corpo das seções. */
export function LegalList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((it, i) => (
        <li key={i} className="flex items-start gap-2">
          <Icon name="check" size={16} className="mt-0.5 shrink-0 text-brand" />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}
