import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { PublicTopBar } from "../components/PublicTopBar";
import { Icon } from "../components/icons";
import { usePricingPlans, type PricingPlan } from "../queries";
import { Spinner } from "@/components/ui";
import { Seo } from "@/components/Seo";

/* ============================================================
   REVVIO — Página "Vender" (captação de garagistas + planos)
   Os planos vêm do banco (rv_pricing_plans, migration 0009) via
   usePricingPlans(). Steps/benefícios/comparativo/FAQ são estáticos.
   ============================================================ */

const STEPS = [
  { icon: "edit", t: "Crie sua conta", d: "Cadastro em 2 minutos com CNPJ. Aprovação no mesmo dia." },
  { icon: "store", t: "Monte sua mini-loja", d: "Banner, logo, bio e endereço. Sua vitrine em revvio.com.br/loja/sua-marca." },
  { icon: "car", t: "Publique seus veículos", d: "Cadastre com fotos, preço e comparação automática com a FIPE." },
  { icon: "whatsapp", t: "Receba leads no WhatsApp", d: "Cada interessado cai direto no seu WhatsApp, pronto pra fechar." },
];

const BENEFITS = [
  { icon: "store", t: "Mini-loja profissional", d: "Sua vitrine pública com link próprio para compartilhar nas redes e no status." },
  { icon: "badge", t: "Selo abaixo da FIPE", d: "O sistema compara seu preço com a tabela FIPE e destaca as oportunidades." },
  { icon: "whatsapp", t: "Leads direto no WhatsApp", d: "Gerador de mensagem automática com os dados do veículo. Zero fricção." },
  { icon: "trendUp", t: "Relatórios de desempenho", d: "Veja visitas, leads e veículos mais procurados para vender mais rápido." },
  { icon: "eye", t: "Vitrine no marketplace", d: "Seus carros aparecem para milhares de compradores que já buscam na REVVIO." },
  { icon: "shield", t: "Procedência e confiança", d: "Laudo, histórico e selo de loja verificada que aumentam sua conversão." },
];

const FAQ: [string, string][] = [
  ["Preciso de CNPJ para vender?", "Sim. A REVVIO é uma plataforma para garagens e revendas, então o cadastro é feito com CNPJ ativo. A aprovação costuma sair no mesmo dia útil."],
  ["Posso mudar de plano depois?", "A qualquer momento. O upgrade é imediato e o downgrade vale a partir do próximo ciclo. Você só paga a diferença proporcional."],
  ["Existe taxa por venda ou comissão?", "Não. Você paga apenas a mensalidade do plano. As vendas e negociações acontecem direto entre você e o comprador, sem intermediação de valores."],
  ['Como funciona o selo "Abaixo da FIPE"?', "Ao cadastrar o preço, o sistema consulta a tabela FIPE e calcula o percentual de desconto. Veículos abaixo da tabela ganham destaque automático no marketplace."],
  ["Tem fidelidade ou multa de cancelamento?", "Não há fidelidade. Você pode cancelar quando quiser e mantém o acesso até o fim do período já pago."],
];

const scrollTo = (id: string) =>
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

function PlanCard({
  p,
  annual,
  onChoose,
}: {
  p: PricingPlan;
  annual: boolean;
  onChoose: () => void;
}) {
  const price = annual ? p.price_annual : p.price_monthly;
  return (
    <div
      className="relative rounded-[18px] bg-white px-[26px] py-7 transition-shadow"
      style={{
        border: p.popular ? "2px solid #10b981" : "1px solid #e7e9ee",
        boxShadow: p.popular
          ? "0 20px 50px rgba(16,185,129,.16)"
          : "0 2px 8px rgba(16,24,40,.05)",
        transform: p.popular ? "translateY(-8px)" : "none",
      }}
    >
      {p.popular && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand px-3.5 py-[5px] text-[11.5px] font-extrabold tracking-wide text-white shadow-[0_6px_16px_rgba(16,185,129,.4)]">
          MAIS ESCOLHIDO
        </span>
      )}
      <div className="text-[17px] font-extrabold" style={{ color: p.color }}>
        {p.name}
      </div>
      <div className="mt-1 min-h-[38px] text-[13.5px] text-slate-400">{p.tagline}</div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className="text-base font-bold text-slate-950">R$</span>
        <span className="text-[44px] font-extrabold leading-none tracking-[-2px] text-slate-950">
          {price}
        </span>
        <span className="text-sm text-slate-400">/mês</span>
      </div>
      <div
        className="mt-1.5 min-h-[18px] text-[12.5px]"
        style={{ color: annual ? "#059669" : "#9aa3af", fontWeight: annual ? 700 : 400 }}
      >
        {annual
          ? `Cobrado anualmente · economize R$ ${(p.price_monthly - p.price_annual) * 12}/ano`
          : "Cobrado mensalmente"}
      </div>
      <button
        onClick={onChoose}
        className="mt-[18px] flex w-full items-center justify-center gap-2 rounded-[11px] py-[13px] text-[14.5px] font-bold"
        style={{
          border: p.popular ? "none" : `1.5px solid ${p.color}`,
          background: p.popular ? "#10b981" : "#fff",
          color: p.popular ? "#fff" : p.color,
          boxShadow: p.popular ? `0 8px 20px ${p.color}40` : "none",
        }}
      >
        {p.cta_label}
      </button>
      <div className="mt-[22px] flex flex-col gap-3">
        {p.highlights.map((h) => (
          <div key={h} className="flex items-start gap-2.5 text-[13.5px] text-slate-700">
            <Icon name="check" size={16} stroke={2.6} style={{ color: p.color, marginTop: 1 }} />
            {h}
          </div>
        ))}
      </div>
    </div>
  );
}

/* Linhas da tabela comparativa derivadas dos planos reais (rv_pricing_plans). */
function buildCompareRows(plans: PricingPlan[], annual: boolean) {
  return [
    {
      label: annual ? "Preço (anual)" : "Preço (mensal)",
      values: plans.map((p) => `R$ ${annual ? p.price_annual : p.price_monthly}/mês`),
    },
    {
      label: "Limite de veículos",
      values: plans.map((p) => (p.vehicle_limit == null ? "Ilimitado" : String(p.vehicle_limit))),
    },
    { label: "Teste grátis", values: plans.map((p) => `${p.trial_days} dias`) },
    { label: "Mais escolhido", values: plans.map((p) => p.popular) },
    { label: "Recursos inclusos", values: plans.map((p) => p.highlights) },
  ];
}

function CompareValueCell({
  value,
  color,
}: {
  value: string | boolean | string[];
  color: string;
}) {
  if (typeof value === "boolean")
    return value ? (
      <Icon name="check" size={18} stroke={2.6} style={{ color }} />
    ) : (
      <span className="text-lg text-slate-300">–</span>
    );
  if (Array.isArray(value))
    return (
      <ul className="flex flex-col gap-2 text-left">
        {value.map((h) => (
          <li key={h} className="flex items-start gap-2 text-[13px] text-slate-700">
            <Icon name="check" size={15} stroke={2.6} style={{ color, marginTop: 1 }} /> {h}
          </li>
        ))}
      </ul>
    );
  return <span className="text-[13.5px] font-semibold text-slate-700">{value}</span>;
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-[#ecedf1]">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-4 px-1 py-5 text-left"
      >
        <span className="text-base font-bold text-slate-950">{q}</span>
        <span
          className={`grid h-7 w-7 flex-shrink-0 place-items-center rounded-lg transition-all ${
            open ? "bg-brand text-white" : "bg-[#f1f3f5] text-slate-500"
          }`}
        >
          <Icon name={open ? "chevronUp" : "chevronDown"} size={16} stroke={2.4} />
        </span>
      </button>
      {open && (
        <p className="m-0 max-w-[720px] px-1 pb-[22px] text-[14.5px] leading-[1.7] text-slate-500">
          {a}
        </p>
      )}
    </div>
  );
}

function SectionHead({
  eyebrow,
  title,
  centered = false,
  children,
}: {
  eyebrow: string;
  title: string;
  centered?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className={`${centered ? "text-center" : "max-w-[600px]"} mb-10`}>
      <div className="text-[13px] font-extrabold uppercase tracking-wide text-brand">
        {eyebrow}
      </div>
      <h2 className="mt-2 text-[34px] font-extrabold tracking-[-1.2px] text-slate-950">
        {title}
      </h2>
      {children}
    </div>
  );
}

export function Vender() {
  const navigate = useNavigate();
  const { data: plans = [], isLoading: plansLoading } = usePricingPlans();
  const [annual, setAnnual] = useState(true);

  // CTA do plano leva direto ao cadastro (Enterprise → contato).
  const choose = (p: PricingPlan) => {
    if (p.key === "enterprise" || /falar com vendas/i.test(p.cta_label)) {
      window.location.href = `mailto:contato@revvio.com.br?subject=${encodeURIComponent(
        "Interesse no plano Enterprise — Revvio"
      )}`;
      return;
    }
    navigate(`/cadastro-vendedor?plan=${p.key}&cycle=${annual ? "annual" : "monthly"}`);
  };

  return (
    <div className="min-h-screen bg-white font-sans">
      <Seo
        title="Anuncie e venda seu veículo"
        description="Crie a sua mini-loja na Revvio e anuncie carros, motos e caminhões. Sem comissão por venda, contato direto com o comprador pelo WhatsApp."
        path="/vender"
      />
      <PublicTopBar current="vender" />

      {/* HERO */}
      <div
        className="text-white"
        style={{
          background:
            "radial-gradient(ellipse 60% 100% at 80% 0%, rgba(16,185,129,.22), transparent 55%), #08090c",
        }}
      >
        <div className="mx-auto grid max-w-[1180px] grid-cols-1 items-center gap-[50px] px-7 pb-[70px] pt-16 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/15 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-emerald-400">
              <Icon name="store" size={14} /> Para garagens e revendas
            </span>
            <h1 className="my-4 mt-5 font-display text-[clamp(34px,4.4vw,56px)] font-extrabold leading-[1.02] tracking-[-2px]">
              Sua garagem online,
              <br />
              <span className="text-brand">vendendo todo dia.</span>
            </h1>
            <p className="m-0 max-w-[500px] text-[17.5px] leading-[1.6] text-slate-400">
              Monte sua mini-loja, publique seu estoque e receba leads qualificados no
              WhatsApp. Sem comissão por venda — só a mensalidade do seu plano.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                onClick={() => scrollTo("rv-pricing")}
                className="rounded-xl bg-brand px-7 py-[15px] text-[15.5px] font-bold text-white shadow-[0_10px_28px_rgba(16,185,129,.35)] hover:bg-brand-dark"
              >
                Ver planos e preços
              </button>
              <button
                onClick={() => navigate("/loja/auto-prime")}
                className="rounded-xl border border-white/15 bg-white/[0.07] px-7 py-[15px] text-[15.5px] font-semibold text-slate-200 hover:bg-white/10"
              >
                Ver loja de exemplo
              </button>
            </div>
            <div className="mt-10 flex gap-7">
              {[
                ["47", "garagens ativas"],
                ["1.284", "veículos anunciados"],
                ["7 dias", "grátis para testar"],
              ].map(([n, l]) => (
                <div key={l}>
                  <div className="text-[26px] font-extrabold tracking-[-1px] text-white">{n}</div>
                  <div className="text-[13px] text-slate-400">{l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Mockup mini-loja */}
          <div className="relative">
            <div className="overflow-hidden rounded-[20px] border border-white/10 shadow-[0_30px_60px_rgba(0,0,0,.5)]">
              <div className="relative h-[110px] bg-[#0c1322]">
                <img
                  src="https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=640&h=220&q=70"
                  alt=""
                  className="h-full w-full object-cover opacity-70"
                />
                <img
                  src="https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=120&h=120&q=70"
                  alt=""
                  className="absolute -bottom-5 left-[18px] h-[50px] w-[50px] rounded-xl border-[3px] border-slate-950 object-cover"
                />
              </div>
              <div className="bg-slate-950 px-[18px] pb-[18px] pt-7">
                <div className="text-[15px] font-bold text-white">Auto Prime Veículos</div>
                <div className="mb-3.5 text-[12.5px] text-slate-400">
                  revvio.com.br/loja/auto-prime
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    "1568605117036-5fe5e7bab0b7",
                    "1583121274602-3e2820c69888",
                  ].map((id) => (
                    <div key={id} className="overflow-hidden rounded-[10px] bg-slate-800">
                      <img
                        src={`https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=320&h=200&q=70`}
                        alt=""
                        className="h-[72px] w-full object-cover"
                      />
                      <div className="px-[9px] py-[7px]">
                        <div className="h-1.5 w-[70%] rounded bg-slate-700" />
                        <div className="mt-1.5 h-2 w-1/2 rounded bg-brand" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="absolute -right-3.5 top-6 flex items-center gap-2.5 rounded-xl bg-white px-3.5 py-2.5 shadow-[0_12px_30px_rgba(0,0,0,.25)]">
              <span className="grid h-[30px] w-[30px] place-items-center rounded-lg bg-[#25D366] text-white">
                <Icon name="whatsapp" size={17} />
              </span>
              <div>
                <div className="text-xs font-extrabold text-slate-950">Novo lead!</div>
                <div className="text-[11px] text-slate-400">Tiguan 2019</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* HOW IT WORKS */}
      <section className="mx-auto max-w-[1180px] px-7 py-[70px]">
        <SectionHead eyebrow="Como funciona" title="Comece a vender em 4 passos" centered />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <div
              key={s.t}
              className="relative rounded-2xl border border-hair bg-white p-6"
            >
              <div className="absolute right-5 top-[18px] text-[38px] font-extrabold text-[#f1f3f5]">
                {i + 1}
              </div>
              <div className="mb-4 grid h-[46px] w-[46px] place-items-center rounded-xl bg-brand/10 text-brand">
                <Icon name={s.icon} size={22} />
              </div>
              <div className="text-[16.5px] font-bold text-slate-950">{s.t}</div>
              <div className="mt-1.5 text-[13.5px] leading-[1.6] text-slate-500">{s.d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* BENEFITS */}
      <section className="bg-cloud">
        <div className="mx-auto max-w-[1180px] px-7 py-[70px]">
          <SectionHead
            eyebrow="Por que a REVVIO"
            title="Tudo que sua revenda precisa para vender mais"
          />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map((b) => (
              <div
                key={b.t}
                className="rounded-2xl border border-hair bg-white p-[26px] shadow-[0_1px_2px_rgba(16,24,40,.04)]"
              >
                <div className="mb-4 grid h-[46px] w-[46px] place-items-center rounded-xl bg-brand/10 text-brand">
                  <Icon name={b.icon} size={22} />
                </div>
                <div className="text-[17px] font-bold text-slate-950">{b.t}</div>
                <div className="mt-2 text-sm leading-[1.6] text-slate-500">{b.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="rv-pricing" className="mx-auto max-w-[1180px] px-7 pb-[30px] pt-[76px]">
        <div className="mb-3 text-center">
          <div className="text-[13px] font-extrabold uppercase tracking-wide text-brand">
            Planos
          </div>
          <h2 className="mt-2 text-[36px] font-extrabold tracking-[-1.4px] text-slate-950">
            Escolha o plano da sua garagem
          </h2>
          <p className="mx-auto mt-3 max-w-[540px] text-base text-slate-500">
            Sem comissão por venda. Sem fidelidade. 7 dias grátis para testar.
          </p>
        </div>

        {/* Billing toggle */}
        <div className="mb-10 flex justify-center">
          <div className="inline-flex items-center gap-1 rounded-full bg-[#f1f3f5] p-1">
            {([
              ["mensal", false],
              ["anual", true],
            ] as const).map(([l, val]) => (
              <button
                key={l}
                onClick={() => setAnnual(val)}
                className="inline-flex items-center gap-2 rounded-full px-5 py-[9px] text-sm font-bold capitalize"
                style={{
                  background: annual === val ? "#fff" : "transparent",
                  color: annual === val ? "#0f172a" : "#94a3b8",
                  boxShadow: annual === val ? "0 2px 6px rgba(16,24,40,.1)" : "none",
                }}
              >
                {l}
                {val && (
                  <span className="rounded-full bg-brand/15 px-[7px] py-0.5 text-[11px] font-extrabold text-brand-dark">
                    -20%
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {plansLoading ? (
          <div className="flex justify-center py-20 text-slate-400">
            <Spinner />
          </div>
        ) : (
          <div className="grid grid-cols-1 items-start gap-[22px] md:grid-cols-3">
            {plans.map((p) => (
              <PlanCard
                key={p.key}
                p={p}
                annual={annual}
                onChoose={() => choose(p)}
              />
            ))}
          </div>
        )}
      </section>

      {/* COMPARE TABLE */}
      <section className="mx-auto max-w-[1180px] px-7 pb-[70px] pt-10">
        <h3 className="mb-5 text-center text-[22px] font-extrabold tracking-[-.6px] text-slate-950">
          Compare os planos em detalhe
        </h3>
        <div className="overflow-x-auto rounded-2xl border border-hair bg-white shadow-[0_1px_3px_rgba(16,24,40,.05)]">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#fbfbfc]">
                <th className="px-[22px] py-[18px] text-left text-[13px] font-bold text-slate-500">
                  Recursos
                </th>
                {plans.map((p) => (
                  <th key={p.key} className="min-w-[130px] px-3.5 py-[18px] text-center">
                    <div className="text-[15px] font-extrabold" style={{ color: p.color }}>
                      {p.name}
                    </div>
                    <div className="text-[12.5px] font-semibold text-slate-400">
                      R$ {annual ? p.price_annual : p.price_monthly}/mês
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {buildCompareRows(plans, annual).map((row) => (
                <tr key={row.label} className="hover:bg-[#fafbfc]">
                  <td className="border-t border-cloud px-[22px] py-[13px] align-top font-medium text-slate-700">
                    {row.label}
                  </td>
                  {row.values.map((val, i) => (
                    <td
                      key={plans[i].key}
                      className={`border-t border-cloud px-3.5 py-[13px] text-center align-top ${
                        plans[i].popular ? "bg-brand/[0.035]" : ""
                      }`}
                    >
                      <CompareValueCell value={val} color={plans[i].color} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* TESTIMONIAL */}
      <section className="bg-ink text-white">
        <div className="mx-auto max-w-[860px] px-7 py-[70px] text-center">
          <div className="mb-[22px] flex justify-center gap-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <Icon key={i} name="star" size={22} style={{ color: "#f59e0b" }} />
            ))}
          </div>
          <p className="m-0 text-[clamp(20px,2.4vw,28px)] font-semibold leading-[1.5] tracking-[-.5px]">
            "Em 3 meses na REVVIO a gente dobrou os leads e parou de depender só do balcão. A
            mini-loja virou nosso cartão de visita no WhatsApp."
          </p>
          <div className="mt-7 flex items-center justify-center gap-3.5">
            <img
              src="https://images.unsplash.com/photo-1542362567-b07e54358753?auto=format&fit=crop&w=120&h=120&q=70"
              alt=""
              className="h-[52px] w-[52px] rounded-[13px] object-cover"
            />
            <div className="text-left">
              <div className="font-bold">Rafael Lima</div>
              <div className="text-[13.5px] text-slate-400">
                Garage SP Multimarcas · Guarulhos, SP
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-[860px] px-7 py-[70px]">
        <h2 className="mb-[30px] text-center text-[32px] font-extrabold tracking-[-1px] text-slate-950">
          Perguntas frequentes
        </h2>
        <div>
          {FAQ.map(([q, a]) => (
            <FaqItem key={q} q={q} a={a} />
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section id="rv-cta" className="px-7 pb-[90px]">
        <div
          className="relative mx-auto max-w-[1000px] overflow-hidden rounded-3xl px-10 py-14 text-center text-white"
          style={{
            background:
              "radial-gradient(ellipse 80% 140% at 50% 0%, rgba(255,255,255,.12), transparent 60%), linear-gradient(135deg,#10b981,#0b7a5a)",
          }}
        >
          <h2 className="m-0 text-[clamp(28px,3.4vw,40px)] font-extrabold tracking-[-1.4px]">
            Pronto para colocar sua garagem online?
          </h2>
          <p className="mx-auto mt-3.5 max-w-[540px] text-[17px] text-white/85">
            Escolha um plano e crie sua conta. Sem comissão por venda, sem fidelidade.
          </p>
          <div className="mt-[30px] flex flex-wrap justify-center gap-3">
            <button
              onClick={() => scrollTo("rv-pricing")}
              className="rounded-xl bg-white px-8 py-[15px] text-[15.5px] font-extrabold text-slate-950 shadow-[0_12px_30px_rgba(0,0,0,.2)] hover:bg-slate-100"
            >
              Escolher meu plano
            </button>
            <a
              href="https://wa.me/5514981800854?text=Ol%C3%A1!%20Quero%20anunciar%20na%20Revvio."
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-white/30 bg-white/15 px-8 py-[15px] text-[15.5px] font-bold text-white hover:bg-white/25"
            >
              Falar no WhatsApp
            </a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-ink py-9 text-center text-[13px] text-slate-500">
        <div className="mb-2.5 font-display text-xl font-extrabold tracking-tight text-white">
          REVV<span className="text-brand">IO</span>
        </div>
        Av. Ipiranga, 207 — Centro, Marília — SP · (14) 98180-0854 · contato@revvio.com.br
        <div className="mt-1.5">REVVIO Marketplace · Gestão e venda de veículos · © 2026</div>
      </footer>
    </div>
  );
}
