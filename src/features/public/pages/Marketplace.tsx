import { useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { usePublicVehicles } from "../queries";
import { PublicShell } from "../PublicShell";
import { MarketplaceCard } from "../components/MarketplaceCard";
import { Icon } from "../components/icons";
import { bodyLabels, fuelLabels, transmissionLabels } from "../vehicleLabels";
import { Spinner } from "@/components/ui";
import { Seo } from "@/components/Seo";

const inputCls =
  "w-full rounded-lg border border-[#e3e5e9] bg-[#fbfbfc] px-3 py-2.5 text-[13.5px] text-slate-900 outline-none placeholder:text-[#b0b7c0] focus:border-brand";

/* Toggle (estilo protótipo) */
function Toggle({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={`flex h-[22px] w-10 items-center rounded-full p-0.5 transition-colors ${
        on ? "justify-end bg-white" : "justify-start bg-white/35"
      }`}
    >
      <span
        className={`block h-[18px] w-[18px] rounded-full shadow ${
          on ? "bg-brand" : "bg-white"
        }`}
      />
    </button>
  );
}

/* Seção de filtro recolhível */
function FilterSection({
  icon,
  title,
  children,
  defaultOpen = true,
}: {
  icon: string;
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-[#f1f3f5]">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-3.5"
      >
        <span className="inline-flex items-center gap-2 text-sm font-bold text-slate-900">
          <Icon name={icon} size={16} className="text-brand" /> {title}
        </span>
        <Icon
          name={open ? "chevronUp" : "chevronDown"}
          size={16}
          className="text-slate-400"
        />
      </button>
      {open && <div className="pb-4">{children}</div>}
    </div>
  );
}

export function Marketplace() {
  const { data, isLoading } = usePublicVehicles();
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [brand, setBrand] = useState(params.get("marca") ?? "all");
  const [belowFipe, setBelowFipe] = useState(false);
  const [special, setSpecial] = useState(false);
  const [fuel, setFuel] = useState("all");
  const [transmission, setTransmission] = useState("all");
  const [body, setBody] = useState("all");
  const [armored, setArmored] = useState(false);
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [yearMin, setYearMin] = useState("");
  const [yearMax, setYearMax] = useState("");
  const [kmMax, setKmMax] = useState("");
  const [sort, setSort] = useState("relevancia");

  const brands = useMemo(
    () => Array.from(new Set((data ?? []).map((v) => v.make))).sort(),
    [data]
  );

  const list = useMemo(() => {
    let out = (data ?? []).filter((v) => {
      const term = q.trim().toLowerCase();
      if (term && !`${v.make} ${v.model} ${v.color ?? ""}`.toLowerCase().includes(term))
        return false;
      if (brand !== "all" && v.make !== brand) return false;
      if (belowFipe && !(v.fipe_price && v.price < v.fipe_price)) return false;
      if (special && !v.featured) return false;
      if (fuel !== "all" && v.fuel !== fuel) return false;
      if (transmission !== "all" && v.transmission !== transmission) return false;
      if (body !== "all" && v.body_type !== body) return false;
      if (armored && !v.armored) return false;
      if (priceMin && v.price < Number(priceMin)) return false;
      if (priceMax && v.price > Number(priceMax)) return false;
      if (yearMin && (v.year ?? 0) < Number(yearMin)) return false;
      if (yearMax && (v.year ?? 9999) > Number(yearMax)) return false;
      if (kmMax && (v.mileage ?? 0) > Number(kmMax)) return false;
      return true;
    });
    if (sort === "menor") out = [...out].sort((a, b) => a.price - b.price);
    if (sort === "maior") out = [...out].sort((a, b) => b.price - a.price);
    if (sort === "novo") out = [...out].sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
    return out;
  }, [
    data, q, brand, belowFipe, special, fuel, transmission, body, armored,
    priceMin, priceMax, yearMin, yearMax, kmMax, sort,
  ]);

  function clearFilters() {
    setQ("");
    setBrand("all");
    setBelowFipe(false);
    setSpecial(false);
    setFuel("all");
    setTransmission("all");
    setBody("all");
    setArmored(false);
    setPriceMin("");
    setPriceMax("");
    setYearMin("");
    setYearMax("");
    setKmMax("");
  }

  return (
    <PublicShell current="comprar">
      <Seo
        title="Comprar veículos"
        description="Encontre carros, motos e caminhões com procedência no marketplace da Revvio. Filtre por marca, modelo, ano e preço e fale direto com a loja."
        path="/comprar"
      />
      {/* Hero */}
      <div
        className="text-white"
        style={{
          background:
            "radial-gradient(ellipse 70% 120% at 75% 0%, rgba(16,185,129,.22), transparent 60%), #08090c",
        }}
      >
        <div className="mx-auto max-w-[1280px] px-5 py-11 sm:px-7">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/15 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-emerald-400">
            <Icon name="badge" size={14} /> Oportunidades verificadas
          </span>
          <h1 className="mt-4 max-w-2xl font-display text-[clamp(30px,4vw,46px)] font-extrabold leading-[1.05] tracking-tight">
            Veículos premium, <span className="text-brand">preço justo</span>.
          </h1>
          <p className="mt-2 max-w-xl text-base text-slate-400">
            Catálogo verificado das melhores garagens parceiras — com procedência e
            contato direto.
          </p>
          <div className="mt-6 flex max-w-2xl gap-2.5">
            <div className="flex flex-1 items-center gap-2.5 rounded-xl bg-white px-4">
              <Icon name="search" size={19} className="text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Busque por marca ou modelo…"
                className="flex-1 border-none bg-transparent py-4 text-[15px] text-slate-900 outline-none placeholder:text-slate-400"
              />
            </div>
            <button className="rounded-xl bg-brand px-6 font-bold text-white hover:bg-brand-dark">
              Buscar
            </button>
          </div>
        </div>
      </div>

      {/* Listagem */}
      <div className="mx-auto grid max-w-[1280px] grid-cols-1 items-start gap-7 px-5 py-7 sm:px-7 lg:grid-cols-[278px_1fr]">
        {/* Filtros */}
        <aside className="rounded-2xl border border-hair bg-white p-5 shadow-sm lg:sticky lg:top-[86px]">
          <div className="mb-4 flex items-center gap-2 text-[13px] font-extrabold uppercase tracking-wide text-slate-900">
            <Icon name="filter" size={16} className="text-brand" /> Filtros
          </div>

          <div className="mb-2 rounded-xl bg-gradient-to-br from-brand to-[#0f9b73] p-4 text-white">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 text-sm font-bold">
                <Icon name="badge" size={16} /> Abaixo da FIPE
              </span>
              <Toggle on={belowFipe} onChange={setBelowFipe} />
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-white/25 pt-3">
              <span className="text-[13.5px] font-semibold">Apenas ofertas</span>
              <Toggle on={special} onChange={setSpecial} />
            </div>
          </div>

          <FilterSection icon="search" title="Busca">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ex: Civic, 2.0, Corolla…"
              className={inputCls}
            />
          </FilterSection>

          <FilterSection icon="car" title="Marca">
            <select
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className={`${inputCls} cursor-pointer`}
            >
              <option value="all">Todas as marcas</option>
              {brands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </FilterSection>

          <FilterSection icon="dollar" title="Preço">
            <div className="flex gap-2">
              <input
                placeholder="De"
                type="number"
                value={priceMin}
                onChange={(e) => setPriceMin(e.target.value)}
                className={inputCls}
              />
              <input
                placeholder="Até"
                type="number"
                value={priceMax}
                onChange={(e) => setPriceMax(e.target.value)}
                className={inputCls}
              />
            </div>
          </FilterSection>

          <FilterSection icon="calendar" title="Ano" defaultOpen={false}>
            <div className="flex gap-2">
              <input
                placeholder="De"
                type="number"
                value={yearMin}
                onChange={(e) => setYearMin(e.target.value)}
                className={inputCls}
              />
              <input
                placeholder="Até"
                type="number"
                value={yearMax}
                onChange={(e) => setYearMax(e.target.value)}
                className={inputCls}
              />
            </div>
          </FilterSection>

          <FilterSection icon="gauge" title="Quilometragem" defaultOpen={false}>
            <input
              placeholder="Máx. km"
              type="number"
              value={kmMax}
              onChange={(e) => setKmMax(e.target.value)}
              className={inputCls}
            />
          </FilterSection>

          <FilterSection icon="car" title="Combustível" defaultOpen={false}>
            <select
              value={fuel}
              onChange={(e) => setFuel(e.target.value)}
              className={`${inputCls} cursor-pointer`}
            >
              <option value="all">Todos</option>
              {Object.entries(fuelLabels).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </FilterSection>

          <FilterSection icon="car" title="Câmbio" defaultOpen={false}>
            <select
              value={transmission}
              onChange={(e) => setTransmission(e.target.value)}
              className={`${inputCls} cursor-pointer`}
            >
              <option value="all">Todos</option>
              {Object.entries(transmissionLabels).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </FilterSection>

          <FilterSection icon="car" title="Carroceria" defaultOpen={false}>
            <select
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className={`${inputCls} cursor-pointer`}
            >
              <option value="all">Todas</option>
              {Object.entries(bodyLabels).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </FilterSection>

          <FilterSection icon="badge" title="Blindado" defaultOpen={false}>
            <label className="flex cursor-pointer items-center gap-2 text-[13.5px] text-slate-600">
              <input
                type="checkbox"
                className="h-4 w-4 accent-brand"
                checked={armored}
                onChange={(e) => setArmored(e.target.checked)}
              />
              Somente blindados
            </label>
          </FilterSection>

          <button
            onClick={clearFilters}
            className="mt-4 w-full rounded-lg border border-[#e3e5e9] bg-white py-2.5 text-[13px] font-bold uppercase tracking-wide text-slate-500 hover:bg-slate-50"
          >
            Limpar filtros
          </button>
        </aside>

        {/* Resultados */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-slate-500">
              <b className="text-[15px] text-slate-900">{list.length} carros</b> encontrados
            </p>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className={`${inputCls} w-auto cursor-pointer bg-white`}
            >
              <option value="relevancia">Relevância</option>
              <option value="menor">Menor preço</option>
              <option value="maior">Maior preço</option>
              <option value="novo">Ano mais novo</option>
            </select>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-20 text-slate-400">
              <Spinner />
            </div>
          ) : list.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-hair py-20 text-center text-slate-400">
              Nenhum veículo encontrado com os filtros atuais.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {list.map((v) => (
                <MarketplaceCard key={v.id} vehicle={v} />
              ))}
            </div>
          )}
        </div>
      </div>
    </PublicShell>
  );
}
