import { Link } from "react-router-dom";
import { Icon } from "../icons";

/** `busca` sobrescreve o termo enviado ao marketplace quando o nome exibido
 *  não bate com o fabricante cadastrado (ex.: "BMW Motorrad" → "BMW"). */
type Marca = { nome: string; arquivo: string; busca?: string };

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
  { nome: "BMW Motorrad", arquivo: "bmwmotor.png", busca: "BMW" },
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
    <div className="rounded-2xl border border-hair bg-white p-4 shadow-card sm:p-6">
      <h3 className="mb-4 flex items-center gap-2.5 text-sm font-bold text-slate-900 sm:mb-5">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-white">
          <Icon name={icone} size={18} />
        </span>
        {titulo}
      </h3>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {marcas.map((m) => (
          <Link
            key={m.nome}
            to={`/comprar?q=${encodeURIComponent(m.busca ?? m.nome)}`}
            className="group flex flex-col items-center gap-2.5 rounded-xl border border-hair bg-white px-3 py-4 transition-all hover:-translate-y-0.5 hover:border-brand hover:shadow-[0_10px_24px_theme(colors.shade/0.10)]"
          >
            {/* Faixa de altura fixa alinha marcas quadradas (Chevrolet) com
                assinaturas largas e baixas (Kawasaki, Suzuki). */}
            <span className="flex h-[52px] w-full items-center justify-center">
              <img
                src={`/marcas/${pasta}/${m.arquivo}`}
                alt=""
                loading="lazy"
                decoding="async"
                className="max-h-[42px] max-w-[110px] object-contain"
              />
            </span>
            {/* O nome vem do texto, não do alt — o leitor de tela não repete. */}
            <span className="text-center text-[13px] font-bold leading-tight text-slate-700 transition-colors group-hover:text-brand">
              {m.nome}
            </span>
          </Link>
        ))}
      </div>
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
          Marcas Mais Buscadas
        </h2>
        <p className="mt-2 text-slate-500">
          Toque em uma marca para ver os anúncios disponíveis
        </p>
        <div className="mt-8 flex flex-col gap-5 text-left sm:mt-10 sm:gap-6">
          <Grupo titulo="Carros" icone="car" pasta="carros" marcas={CARROS} />
          <Grupo titulo="Motos" icone="bike" pasta="motos" marcas={MOTOS} />
        </div>
      </div>
    </section>
  );
}
