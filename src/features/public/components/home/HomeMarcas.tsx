import { useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../icons";
import { CARROS, ELETRICOS, MOTOS, type Marca } from "./marcas";

/** Quantas marcas o grupo mostra antes de "ver todas" — as mais buscadas. */
const PREVIA = 18;

function Tile({ marca, pasta }: { marca: Marca; pasta: string }) {
  return (
    <Link
      to={`/comprar?q=${encodeURIComponent(marca.busca ?? marca.nome)}`}
      className="group flex flex-col items-center gap-2.5 rounded-xl border border-hair bg-white px-3 py-4 transition-all hover:-translate-y-0.5 hover:border-brand hover:shadow-[0_10px_24px_theme(colors.shade/0.10)]"
    >
      {/* Faixa de altura fixa alinha marcas quadradas (Chevrolet) com
          assinaturas largas e baixas (Kawasaki, Suzuki). */}
      <span className="flex h-[52px] w-full items-center justify-center">
        {marca.arquivo ? (
          <img
            src={`/marcas/${pasta}/${marca.arquivo}`}
            alt=""
            loading="lazy"
            decoding="async"
            className="max-h-[42px] max-w-[110px] object-contain"
          />
        ) : (
          /* Sem logo de fonte livre: o nome vira a própria marca visual. */
          <span className="px-1 text-center font-display text-[15px] font-extrabold uppercase leading-tight tracking-tight text-slate-300 transition-colors group-hover:text-brand">
            {marca.nome}
          </span>
        )}
      </span>
      {/* O nome vem do texto, não do alt — o leitor de tela não repete. */}
      <span className="text-center text-[13px] font-bold leading-tight text-slate-700 transition-colors group-hover:text-brand">
        {marca.nome}
      </span>
    </Link>
  );
}

function Grupo({
  titulo,
  icone,
  pasta,
  marcas,
}: {
  titulo: string;
  icone: string;
  pasta: "carros" | "eletricos" | "motos";
  marcas: Marca[];
}) {
  const [tudo, setTudo] = useState(false);
  const temMais = marcas.length > PREVIA;
  const visiveis = tudo || !temMais ? marcas : marcas.slice(0, PREVIA);

  return (
    <div className="rounded-2xl border border-hair bg-white p-4 shadow-card sm:p-6">
      <h3 className="mb-4 flex items-center gap-2.5 text-sm font-bold text-slate-900 sm:mb-5">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-white">
          <Icon name={icone} size={18} />
        </span>
        {titulo}
        <span className="ml-auto text-xs font-semibold text-slate-400">
          {marcas.length} marcas
        </span>
      </h3>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {visiveis.map((m) => (
          <Tile key={`${m.nome}-${m.arquivo ?? "sem-logo"}`} marca={m} pasta={pasta} />
        ))}
      </div>

      {temMais && (
        <button
          type="button"
          onClick={() => setTudo((v) => !v)}
          className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-hair py-2.5 text-[13px] font-bold text-slate-600 transition-colors hover:border-brand hover:text-brand"
        >
          {tudo ? "Mostrar menos" : `Ver todas as ${marcas.length} marcas`}
          <Icon name={tudo ? "chevronUp" : "chevronDown"} size={15} />
        </button>
      )}
    </div>
  );
}

export function HomeMarcas() {
  return (
    <section className="py-14 sm:py-16">
      <div className="mx-auto max-w-[1100px] px-5 text-center sm:px-7">
        <span className="inline-block rounded-full bg-brand/10 px-3.5 py-1.5 text-[11.5px] font-bold uppercase tracking-wider text-brand">
          Explore por marca
        </span>
        <h2 className="mt-4 font-display text-[clamp(26px,3.5vw,38px)] font-extrabold tracking-tight text-slate-900">
          Todas as Marcas do Brasil
        </h2>
        <p className="mt-2 text-slate-500">
          Toque em uma marca para ver os anúncios disponíveis
        </p>
        <div className="mt-8 flex flex-col gap-5 text-left sm:mt-10 sm:gap-6">
          <Grupo titulo="Carros" icone="car" pasta="carros" marcas={CARROS} />
          <Grupo
            titulo="Elétricos e híbridos"
            icone="bolt"
            pasta="eletricos"
            marcas={ELETRICOS}
          />
          <Grupo titulo="Motos" icone="bike" pasta="motos" marcas={MOTOS} />
        </div>
      </div>
    </section>
  );
}
