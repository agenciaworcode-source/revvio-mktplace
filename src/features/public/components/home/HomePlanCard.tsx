import { Link } from "react-router-dom";
import type { PricingPlan } from "../../queries";
import { Icon } from "../icons";

const CONTATO_ENTERPRISE =
  "mailto:contato@revvio.com.br?subject=" +
  encodeURIComponent("Interesse no plano Enterprise — Revvio");

function isEnterprise(p: PricingPlan): boolean {
  return p.key === "enterprise" || /falar com vendas/i.test(p.cta_label);
}

export function HomePlanCard({
  p,
  cycle,
}: {
  p: PricingPlan;
  cycle: "monthly" | "annual";
}) {
  const price = cycle === "annual" ? p.price_annual : p.price_monthly;
  const enterprise = isEnterprise(p);
  const to = `/cadastro-vendedor?plan=${p.key}&cycle=${cycle}`;

  return (
    <div
      className="relative flex flex-col rounded-[18px] bg-white px-7 py-7"
      style={{
        border: p.popular ? "2px solid #10b981" : "1px solid #e7e9ee",
        boxShadow: p.popular
          ? "0 20px 50px rgba(16,185,129,.16)"
          : "0 2px 8px rgba(16,24,40,.05)",
      }}
    >
      {p.popular && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand px-3.5 py-[5px] text-[11.5px] font-extrabold tracking-wide text-white">
          MAIS ESCOLHIDO
        </span>
      )}
      <div className="text-[17px] font-extrabold" style={{ color: p.color }}>
        {p.name}
      </div>
      <div className="mt-1 min-h-[38px] text-[13.5px] text-slate-400">{p.tagline}</div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-base font-bold text-slate-950">R$</span>
        <span className="text-[40px] font-extrabold leading-none tracking-[-2px] text-slate-950">
          {price}
        </span>
        <span className="text-sm text-slate-400">/mês</span>
      </div>
      {cycle === "annual" && (
        <div className="mt-1 text-[12px] font-semibold text-brand">
          Cobrado anualmente (R$ {p.price_annual * 12}/ano)
        </div>
      )}
      <ul className="mt-5 flex flex-1 flex-col gap-2.5">
        {p.highlights.map((h) => (
          <li key={h} className="flex items-start gap-2 text-[13.5px] text-slate-600">
            <Icon name="check" size={16} className="mt-0.5 shrink-0 text-brand" /> {h}
          </li>
        ))}
      </ul>
      {enterprise ? (
        <a
          href={CONTATO_ENTERPRISE}
          className="mt-6 flex items-center justify-center gap-2 rounded-[11px] py-[13px] text-[14.5px] font-bold text-white"
          style={{ background: p.color }}
        >
          {p.cta_label}
        </a>
      ) : (
        <Link
          to={to}
          className="mt-6 flex items-center justify-center gap-2 rounded-[11px] py-[13px] text-[14.5px] font-bold text-white"
          style={{ background: p.popular ? "#10b981" : p.color }}
        >
          {p.cta_label}
        </Link>
      )}
    </div>
  );
}
