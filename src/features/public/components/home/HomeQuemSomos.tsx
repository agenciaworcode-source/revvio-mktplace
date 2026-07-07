import { Icon } from "../icons";

const FEATURES = [
  { icon: "car", title: "Carros, motos e caminhões", desc: "Todas as categorias em um só lugar — fácil de filtrar e encontrar." },
  { icon: "whatsapp", title: "Contato direto pelo WhatsApp", desc: "Comprador fala direto com a loja, sem intermediários." },
  { icon: "trendUp", title: "Estatísticas de visualização", desc: "A loja acompanha o desempenho dos anúncios." },
];

export function HomeQuemSomos() {
  return (
    <section className="bg-cloud py-16">
      <div className="mx-auto grid max-w-[1100px] items-center gap-10 px-5 sm:px-7 lg:grid-cols-2">
        <div>
          <span className="inline-block rounded-full bg-brand/10 px-3.5 py-1.5 text-[11.5px] font-bold uppercase tracking-wider text-brand">
            Quem somos
          </span>
          <h2 className="mt-4 font-display text-[clamp(26px,3.5vw,38px)] font-extrabold leading-tight tracking-tight text-slate-900">
            A vitrine digital para <span className="text-brand">comprar e vender</span> veículos
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-slate-500">
            O REVVIO conecta compradores e lojas com procedência, contato direto e um catálogo
            fácil de usar em qualquer dispositivo.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex items-start gap-3 rounded-xl border border-hair bg-white p-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
                  <Icon name={f.icon} size={20} />
                </span>
                <div>
                  <p className="font-bold text-slate-900">{f.title}</p>
                  <p className="text-[13.5px] text-slate-500">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative">
          <img
            src="/home/quem-somos-placeholder.svg"
            alt=""
            className="w-full rounded-2xl"
          />
          <span className="absolute bottom-4 left-4 inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-sm font-bold text-white">
            <Icon name="star" size={15} /> Plataforma confiável
          </span>
        </div>
      </div>
    </section>
  );
}
