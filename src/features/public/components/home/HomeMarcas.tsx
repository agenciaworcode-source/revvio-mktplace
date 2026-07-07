import { Link } from "react-router-dom";
import { Icon } from "../icons";

type Marca = { nome: string; arquivo: string };

const CARROS: Marca[] = [
  { nome: "Chevrolet", arquivo: "chevrolet.png" },
  { nome: "Fiat", arquivo: "fiat.png" },
  { nome: "Volkswagen", arquivo: "volkswagem.png" },
  { nome: "Toyota", arquivo: "toyota.png" },
  { nome: "Honda", arquivo: "honda.png" },
  { nome: "Hyundai", arquivo: "hyundai.png" },
];

const MOTOS: Marca[] = [
  { nome: "Honda", arquivo: "honda.png" },
  { nome: "Yamaha", arquivo: "yamaha.png" },
  { nome: "Dafra", arquivo: "dafra.png" },
  { nome: "Suzuki", arquivo: "suzuki.png" },
  { nome: "Kawasaki", arquivo: "kawasaki.png" },
  { nome: "BMW Motorrad", arquivo: "bmwmotor.png" },
];

function Grupo({
  titulo,
  icone,
  pasta,
  marcas,
}: {
  titulo: string;
  icone: string;
  pasta: "carros" | "motos";
  marcas: Marca[];
}) {
  return (
    <div className="rounded-2xl border border-hair bg-white p-6">
      <h3 className="mb-5 flex items-center gap-2.5 text-sm font-bold text-slate-900">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-white">
          <Icon name={icone} size={18} />
        </span>
        {titulo}
      </h3>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {marcas.map((m) => (
          <Link
            key={m.nome}
            to={`/comprar?q=${encodeURIComponent(m.nome)}`}
            className="flex h-20 items-center justify-center rounded-xl border border-hair p-3 transition-shadow hover:shadow-[0_8px_20px_rgba(16,24,40,.08)]"
            title={m.nome}
          >
            <img
              src={`/marcas/${pasta}/${m.arquivo}`}
              alt={m.nome}
              className="max-h-12 max-w-full object-contain"
            />
          </Link>
        ))}
      </div>
    </div>
  );
}

export function HomeMarcas() {
  return (
    <section className="py-16">
      <div className="mx-auto max-w-[1100px] px-5 text-center sm:px-7">
        <span className="inline-block rounded-full bg-brand/10 px-3.5 py-1.5 text-[11.5px] font-bold uppercase tracking-wider text-brand">
          Explore por marca
        </span>
        <h2 className="mt-4 font-display text-[clamp(26px,3.5vw,38px)] font-extrabold tracking-tight text-slate-900">
          Marcas Mais Buscadas
        </h2>
        <p className="mt-2 text-slate-500">Clique em uma marca para ver os anúncios disponíveis</p>
        <div className="mt-10 flex flex-col gap-6 text-left">
          <Grupo titulo="Carros" icone="car" pasta="carros" marcas={CARROS} />
          <Grupo titulo="Motos" icone="car" pasta="motos" marcas={MOTOS} />
        </div>
      </div>
    </section>
  );
}
