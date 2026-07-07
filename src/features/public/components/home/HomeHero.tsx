import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../icons";

const POPULAR = ["Volkswagen", "Chevrolet", "Fiat", "Toyota", "Honda", "Motos"];

export function HomeHero({ bannerUrl }: { bannerUrl?: string | null }) {
  const navigate = useNavigate();
  const [cat, setCat] = useState("Carros");
  const [term, setTerm] = useState("");

  function buscar() {
    const t = term.trim();
    navigate(t ? `/comprar?q=${encodeURIComponent(t)}` : "/comprar");
  }

  return (
    <section className="relative z-20">
      {/* banner placeholder — altura cheia (vai até o fim da busca) */}
      <img
        src={bannerUrl || "/home/banner-placeholder.svg"}
        alt="Banner REVVIO"
        className="h-[460px] w-full object-cover sm:h-[548px]"
      />

      {/* Busca Rápida — centralizada no fim do banner (metade sobre o banner, metade sobre a seção de baixo) */}
      <div className="absolute bottom-0 left-1/2 z-30 w-full max-w-[1100px] -translate-x-1/2 translate-y-1/2 px-5 sm:px-7">
        <div className="rounded-2xl border border-hair bg-white p-6 shadow-[0_20px_50px_rgba(16,24,40,.10)]">
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-900">
            <Icon name="search" size={20} className="text-brand" /> Busca Rápida
          </h2>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <select
              value={cat}
              onChange={(e) => setCat(e.target.value)}
              className="rounded-xl border border-hair bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 sm:w-44"
            >
              <option>Carros</option>
              <option>Motos</option>
              <option>Caminhões</option>
            </select>
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-hair bg-slate-50 px-4">
              <Icon name="search" size={18} className="text-slate-400" />
              <input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && buscar()}
                placeholder="Digite a marca ou modelo…"
                className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-slate-400"
              />
            </div>
            <button
              onClick={buscar}
              className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white hover:bg-brand-dark"
            >
              Buscar
            </button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-[12px] font-bold uppercase tracking-wider text-slate-400">
              Popular:
            </span>
            {POPULAR.map((p) => (
              <button
                key={p}
                onClick={() => navigate(`/comprar?q=${encodeURIComponent(p)}`)}
                className="rounded-full border border-hair px-3 py-1.5 text-[13px] font-semibold text-slate-600 hover:border-brand hover:text-brand"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
