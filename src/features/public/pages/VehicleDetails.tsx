import { useEffect, useState, type ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { PublicShell } from "../PublicShell";
import { useLogAffiliateVisit, usePublicVehicle, type PublicVehicle } from "../queries";
import { useCreateLead, useTrackVehicleClick } from "@/features/leads/queries";
import { useAuth } from "@/features/auth/AuthProvider";
import { BuyerAuthModal } from "@/features/auth/components/BuyerAuthModal";
import { useLogClickEvent } from "@/features/tracking/queries";
import { bodyLabels, fuelLabels, transmissionLabels } from "../vehicleLabels";
import { formatCurrency, formatNumber } from "@/lib/format";
import { AFFILIATES_ENABLED } from "@/config/features";
import { whatsappLink } from "@/lib/whatsapp";
import { maskPhone } from "@/lib/masks";
import { Icon } from "../components/icons";
import { ImageLightbox } from "../components/ImageLightbox";
import { Input, Textarea, Spinner } from "@/components/ui-light";
import { Seo } from "@/components/Seo";

/* ── Galeria (faixa de até 3 fotos, com navegação) ────────── */
function VehicleGallery({ images }: { images: string[] }) {
  const [start, setStart] = useState(0);
  const [lightbox, setLightbox] = useState<number | null>(null);

  if (!images.length) {
    return (
      <div className="flex h-[260px] items-center justify-center bg-slate-100 text-slate-400 sm:h-[420px]">
        Sem fotos
      </div>
    );
  }

  const total = images.length;
  const cols = Math.min(3, total);
  const colsClass =
    total === 1 ? "sm:grid-cols-1" : total === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3";
  const shown = Array.from({ length: cols }, (_, o) => images[(start + o) % total]);
  const move = (d: number) => setStart((s) => (s + d + total) % total);

  return (
    <div className="relative bg-slate-900">
      <div className={`grid grid-cols-1 ${colsClass}`}>
        {shown.map((src, i) => (
          <img
            key={`${start}-${i}`}
            src={src}
            alt=""
            onClick={() => setLightbox((start + i) % total)}
            className={`h-[260px] w-full cursor-zoom-in object-cover sm:h-[420px] ${
              i > 0 ? "hidden sm:block" : ""
            }`}
          />
        ))}
      </div>

      {total > 1 && (
        <>
          <button
            onClick={() => move(-1)}
            aria-label="Anterior"
            className="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-slate-700 shadow hover:bg-white"
          >
            <Icon name="chevronLeft" size={20} />
          </button>
          <button
            onClick={() => move(1)}
            aria-label="Próxima"
            className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-slate-700 shadow hover:bg-white"
          >
            <Icon name="chevronRight" size={20} />
          </button>
          <span className="absolute bottom-3 right-3 rounded-md bg-black/60 px-2.5 py-1 text-xs font-semibold text-white">
            {start + 1}/{total}
          </span>
        </>
      )}

      {lightbox !== null && (
        <ImageLightbox
          images={images}
          index={lightbox}
          onClose={() => setLightbox(null)}
          onIndex={setLightbox}
        />
      )}
    </div>
  );
}

/* ── Item da barra de specs ───────────────────────────────── */
function SpecItem({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 px-3 py-2 text-center">
      <Icon name={icon} size={22} className="text-brand" />
      <span className="text-[14.5px] font-bold text-slate-900">{value}</span>
      <span className="text-[11px] uppercase tracking-wider text-slate-400">{label}</span>
    </div>
  );
}

/* ── Item de Procedência ──────────────────────────────────── */
function ProcItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 flex items-center gap-1.5 text-[14.5px] font-semibold text-slate-700">
        {value}
      </p>
    </div>
  );
}

function Sim() {
  return (
    <>
      <Icon name="check" size={16} className="text-brand" /> Sim
    </>
  );
}
function Nao() {
  return (
    <>
      <Icon name="shield" size={16} className="text-slate-400" /> Não
    </>
  );
}

/* ── Formulário de contato (abre o WhatsApp do vendedor) ──── */
function LeadForm({ v }: { v: PublicVehicle }) {
  const [nome, setNome] = useState("");
  const [celular, setCelular] = useState("");
  const [email, setEmail] = useState("");
  const [cidade, setCidade] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [financiamento, setFinanciamento] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const createLead = useCreateLead();
  const track = useTrackVehicleClick();
  const { user, buyer } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [pendingSend, setPendingSend] = useState(false);
  const logClick = useLogClickEvent();

  // pré-preenche a partir do perfil do comprador logado
  useEffect(() => {
    if (buyer) {
      setNome((x) => x || buyer.name || "");
      setCelular((x) => x || buyer.phone || "");
      setEmail((x) => x || buyer.email || "");
      setCidade((x) => x || buyer.city || "");
    }
  }, [buyer]);

  // Após autenticar pelo modal, conclui o envio com o estado já atualizado
  // (closure fresco) — evita o gate de login reabrir o modal com user obsoleto.
  useEffect(() => {
    if (pendingSend && user) {
      setPendingSend(false);
      doSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSend, user]);

  const seller = v.seller;
  const sellerWhats = seller?.whatsapp || seller?.phone;
  const carro = `${v.make} ${v.model}${v.year ? ` ${v.year}` : ""}`;

  function validate() {
    const e: Record<string, string> = {};
    if (!nome.trim()) e.nome = "Informe seu nome.";
    if (celular.replace(/\D/g, "").length < 10) e.celular = "Telefone inválido.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = "E-mail inválido.";
    if (!cidade.trim()) e.cidade = "Informe sua cidade.";
    if (!mensagem.trim()) e.mensagem = "Escreva uma mensagem.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // Gate de login: valida, e se não logado abre o modal (que já vem pré-preenchido).
  function enviar() {
    if (!validate()) return;
    if (!user) {
      setAuthOpen(true);
      return;
    }
    doSubmit();
  }

  // Conclui o envio (já validado e logado): registra clique/lead e abre o WhatsApp.
  function doSubmit() {
    // Conta o clique no anúncio (botão "Quero ver o carro") — best-effort.
    track(v.id);
    if (seller?.id) logClick("vehicle_interest", seller.id, v.id);
    // Captura o lead (best-effort: não bloqueia abrir o WhatsApp se falhar).
    if (seller?.id) {
      createLead.mutate({
        seller_id: seller.id,
        vehicle_id: v.id,
        name: nome.trim(),
        phone: celular || null,
        email: email.trim() || null,
        city: cidade.trim() || null,
        message: mensagem.trim() || null,
        financing: financiamento,
        buyer_id: buyer?.id ?? null,
      });
    }
    const linhas = [
      `Olá! Tenho interesse no ${carro} (${formatCurrency(v.price)}) anunciado na REVVIO.`,
      nome && `Nome: ${nome}`,
      celular && `Celular: ${celular}`,
      email && `E-mail: ${email}`,
      mensagem && `Mensagem: ${mensagem}`,
      financiamento && "Gostaria de simular financiamento online.",
    ].filter(Boolean);
    const wa = whatsappLink(sellerWhats, linhas.join("\n"));
    if (wa) window.open(wa, "_blank", "noopener");
  }

  const semWhats = !sellerWhats;

  return (
    <div className="rounded-2xl border border-hair bg-white p-6 shadow-[0_10px_30px_rgba(16,24,40,.06)]">
      {v.fipe_price && v.fipe_price > v.price && (
        <p className="text-sm text-slate-400 line-through">FIPE {formatCurrency(v.fipe_price)}</p>
      )}
      <p className="text-[34px] font-extrabold leading-none tracking-[-1px] text-slate-950">
        {formatCurrency(v.price)}
      </p>

      <div className="mt-5 flex flex-col gap-3">
        <div>
          <Input
            placeholder="Nome *"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className={errors.nome ? "!border-red-400 focus:!border-red-400 focus:!ring-red-400" : ""}
          />
          {errors.nome && <p className="mt-1 text-[12px] text-red-500">{errors.nome}</p>}
        </div>
        <div>
          <Input
            placeholder="Celular *"
            inputMode="tel"
            value={celular}
            onChange={(e) => setCelular(maskPhone(e.target.value))}
            className={errors.celular ? "!border-red-400 focus:!border-red-400 focus:!ring-red-400" : ""}
          />
          {errors.celular && <p className="mt-1 text-[12px] text-red-500">{errors.celular}</p>}
        </div>
        <div>
          <Input
            type="email"
            placeholder="E-mail *"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={errors.email ? "!border-red-400 focus:!border-red-400 focus:!ring-red-400" : ""}
          />
          {errors.email && <p className="mt-1 text-[12px] text-red-500">{errors.email}</p>}
        </div>
        <div>
          <Input
            placeholder="Cidade *"
            value={cidade}
            onChange={(e) => setCidade(e.target.value)}
            className={errors.cidade ? "!border-red-400 focus:!border-red-400 focus:!ring-red-400" : ""}
          />
          {errors.cidade && <p className="mt-1 text-[12px] text-red-500">{errors.cidade}</p>}
        </div>
        <div>
          <Textarea
            rows={3}
            placeholder="Digite a sua mensagem *"
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            className={errors.mensagem ? "!border-red-400 focus:!border-red-400 focus:!ring-red-400" : ""}
          />
          {errors.mensagem && <p className="mt-1 text-[12px] text-red-500">{errors.mensagem}</p>}
        </div>
      </div>

      <label className="mt-3 flex items-center gap-2 text-[13.5px] text-slate-600">
        <input
          type="checkbox"
          className="h-4 w-4 accent-brand"
          checked={financiamento}
          onChange={(e) => setFinanciamento(e.target.checked)}
        />
        Simular financiamento online
      </label>

      <button
        onClick={enviar}
        disabled={semWhats}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3.5 text-[15px] font-bold uppercase tracking-wide text-white hover:bg-brand-dark disabled:opacity-60"
      >
        <Icon name="whatsapp" size={18} /> Quero ver o carro
      </button>
      {semWhats && (
        <p className="mt-2 text-center text-[12px] text-slate-400">
          Vendedor sem WhatsApp cadastrado.
        </p>
      )}

      {seller && (
        <div className="mt-5 border-t border-hair pt-4 text-center">
          <Link
            to={`/loja/${seller.slug}`}
            className="font-bold text-slate-900 hover:text-brand"
          >
            {seller.name}
          </Link>
          {(seller.city || seller.state) && (
            <p className="text-[13.5px] text-slate-500">
              {[seller.city, seller.state].filter(Boolean).join(" - ")}
            </p>
          )}
          <Link
            to={`/loja/${seller.slug}`}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-brand bg-white py-3 text-[14px] font-bold uppercase tracking-wide text-brand transition hover:bg-brand hover:text-white"
          >
            <Icon name="store" size={18} /> Visitar mini-loja
          </Link>
          <p className="mt-3 text-[12px] text-slate-400">
            Ao enviar você aceita nossos{" "}
            <Link to="/termos-e-condicoes" className="text-brand hover:underline">
              termos e condições
            </Link>
            .
          </p>
        </div>
      )}

      <BuyerAuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        initial={{ name: nome, email, phone: celular, city: cidade }}
        onAuthed={() => {
          setAuthOpen(false);
          // dispara o envio quando o `user` já estiver atualizado no contexto
          setPendingSend(true);
        }}
      />
    </div>
  );
}

export function VehicleDetails() {
  const { id } = useParams();
  const { data, isLoading } = usePublicVehicle(id);
  const [searchParams] = useSearchParams();
  const logVisit = useLogAffiliateVisit();

  // Captura o ?ref= do afiliado: guarda no localStorage (sobrevive à navegação
  // até um eventual login) e loga a visita uma vez por carga, quando o carro
  // já estiver carregado.
  useEffect(() => {
    if (!AFFILIATES_ENABLED) return;
    const ref = searchParams.get("ref");
    if (ref) {
      try {
        localStorage.setItem("rv_ref", ref);
      } catch {
        /* storage pode falhar em modo privado; ignora */
      }
      if (data?.id) logVisit(ref, data.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.id, searchParams]);

  if (isLoading) {
    return (
      <PublicShell>
        <div className="flex justify-center py-24 text-slate-400">
          <Spinner />
        </div>
      </PublicShell>
    );
  }

  if (!data) {
    return (
      <PublicShell>
        <div className="mx-auto max-w-[600px] px-5 py-24 text-center">
          <h1 className="text-2xl font-extrabold text-slate-900">Veículo não encontrado</h1>
          <p className="mt-2 text-slate-500">Este anúncio pode ter sido removido ou vendido.</p>
          <Link
            to="/comprar"
            className="mt-6 inline-block rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white hover:bg-brand-dark"
          >
            Voltar ao catálogo
          </Link>
        </div>
      </PublicShell>
    );
  }

  const v = data;

  const specs = [
    { icon: "calendar", value: v.year ? String(v.year) : "—", label: "Ano" },
    v.transmission && {
      icon: "settings",
      value: transmissionLabels[v.transmission] ?? v.transmission,
      label: "Câmbio",
    },
    { icon: "gauge", value: v.mileage != null ? `${formatNumber(v.mileage)} km` : "—", label: "KM" },
    v.fuel && { icon: "fuel", value: fuelLabels[v.fuel] ?? v.fuel, label: "Combustível" },
    v.color && { icon: "palette", value: v.color, label: "Cor" },
    v.body_type && { icon: "car", value: bodyLabels[v.body_type] ?? v.body_type, label: "Carroceria" },
  ].filter(Boolean) as { icon: string; value: string; label: string }[];

  // Procedência: só renderiza se houver ao menos um campo preenchido.
  const proc: { label: string; value: ReactNode }[] = [];
  if (v.origem) proc.push({ label: "Origem", value: v.origem === "importado" ? "Importado" : "Nacional" });
  if (v.primeiro_dono != null)
    proc.push({ label: "Primeiro dono", value: v.primeiro_dono ? <Sim /> : <Nao /> });
  if (v.documentacao) proc.push({ label: "Documentação", value: v.documentacao });
  if (v.ipva) proc.push({ label: "IPVA", value: v.ipva });
  if (v.garantia) proc.push({ label: "Garantia", value: v.garantia });
  if (v.leilao != null)
    proc.push({
      label: "Leilão",
      value: v.leilao ? "Sim (com passagem por leilão)" : "Não (sem passagem por leilão)",
    });

  const seoTitle = `${v.make} ${v.model}${v.year ? ` ${v.year}` : ""} — ${formatCurrency(v.price)}`;
  const seoDesc = [
    `${v.make} ${v.model}${v.year ? ` ${v.year}` : ""}`,
    v.mileage != null ? `${formatNumber(v.mileage)} km` : null,
    v.fuel ? fuelLabels[v.fuel] ?? v.fuel : null,
    v.transmission ? transmissionLabels[v.transmission] ?? v.transmission : null,
  ]
    .filter(Boolean)
    .join(" · ") + ` — à venda na Revvio por ${formatCurrency(v.price)}.`;

  return (
    <PublicShell current="comprar">
      <Seo
        title={seoTitle}
        description={seoDesc}
        path={`/veiculo/${v.id}`}
        image={v.images?.[0]}
        type="product"
      />
      <VehicleGallery images={v.images} />

      <div className="mx-auto max-w-[1180px] px-5 py-8 sm:px-7">
        {/* breadcrumb */}
        <nav className="flex flex-wrap items-center gap-2 text-[13px] text-slate-400">
          <Link to="/" className="hover:text-brand">Home</Link>
          <span>›</span>
          <Link to="/comprar" className="hover:text-brand">Comprar</Link>
          <span>›</span>
          <span className="text-slate-600">{v.make}</span>
          {v.year && (
            <>
              <span>›</span>
              <span className="text-slate-600">{v.year}</span>
            </>
          )}
        </nav>

        {/* título */}
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link
              to="/comprar"
              className="inline-flex items-center gap-2 text-[26px] font-extrabold uppercase tracking-tight text-slate-900 hover:text-brand"
            >
              <Icon name="chevronLeft" size={24} /> {v.make}
            </Link>
            <p className="mt-0.5 text-[16px] text-slate-500">{v.model}</p>
          </div>
          {v.year && <span className="text-[22px] font-bold text-slate-400">{v.year}</span>}
        </div>

        {/* barra de specs */}
        <div className="mt-5 rounded-2xl border border-hair bg-white px-2 py-4 shadow-sm">
          <div className="grid grid-cols-2 divide-x divide-hair sm:grid-cols-3 lg:grid-cols-6">
            {specs.map((s) => (
              <SpecItem key={s.label} icon={s.icon} value={s.value} label={s.label} />
            ))}
          </div>
        </div>

        {/* conteúdo + formulário */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="flex flex-col gap-6">
            {v.options && v.options.length > 0 && (
              <section className="rounded-2xl border border-hair bg-white p-6">
                <h2 className="text-lg font-extrabold text-slate-900">Opcionais</h2>
                <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {v.options.map((opt) => (
                    <span key={opt} className="flex items-center gap-2 text-[14.5px] text-slate-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-brand" /> {opt}
                    </span>
                  ))}
                </div>
              </section>
            )}

            <section className="rounded-2xl border border-hair bg-white p-6">
              <h2 className="text-lg font-extrabold text-slate-900">Observações</h2>
              <p className="mt-3 whitespace-pre-line text-[14.5px] leading-relaxed text-slate-600">
                {v.description || "Nenhuma observação adicional."}
              </p>
            </section>

            {proc.length > 0 && (
              <section className="rounded-2xl border border-hair bg-white p-6">
                <h2 className="text-lg font-extrabold text-slate-900">Procedência e Histórico</h2>
                <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-3">
                  {proc.map((p) => (
                    <ProcItem key={p.label} label={p.label} value={p.value} />
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* formulário (sticky no desktop) */}
          <div className="lg:sticky lg:top-28 lg:self-start">
            <LeadForm v={v} />
          </div>
        </div>
      </div>
    </PublicShell>
  );
}
