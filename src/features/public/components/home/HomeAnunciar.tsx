import { useState } from "react";
import { usePricingPlans } from "../../queries";
import { HomePlanCard } from "./HomePlanCard";
import { Spinner } from "@/components/ui-light";

export function HomeAnunciar() {
  const { data: plans = [], isLoading } = usePricingPlans();
  const [cycle, setCycle] = useState<"monthly" | "annual">("monthly");

  return (
    <section className="bg-cloud py-16">
      <div className="mx-auto max-w-[1100px] px-5 text-center sm:px-7">
        <span className="inline-block rounded-full bg-brand/10 px-3.5 py-1.5 text-[11.5px] font-bold uppercase tracking-wider text-brand">
          Por que anunciar no Revvio?
        </span>
        <h2 className="mt-4 font-display text-[clamp(26px,3.5vw,38px)] font-extrabold tracking-tight text-slate-900">
          A plataforma certa para sua loja <span className="text-brand">vender mais</span>
        </h2>
        <p className="mt-2 text-slate-500">
          Escolha um plano e ganhe vitrine digital, equipe de vendedores e painel de gestão.
        </p>

        <div className="mt-6 inline-flex rounded-full border border-slate-200 bg-white p-1 text-sm font-semibold">
          <button
            type="button"
            onClick={() => setCycle("monthly")}
            className={`rounded-full px-4 py-1.5 ${cycle === "monthly" ? "bg-brand text-white" : "text-slate-600"}`}
          >
            Mensal
          </button>
          <button
            type="button"
            onClick={() => setCycle("annual")}
            className={`rounded-full px-4 py-1.5 ${cycle === "annual" ? "bg-brand text-white" : "text-slate-600"}`}
          >
            Anual
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12 text-slate-400">
            <Spinner />
          </div>
        ) : plans.length === 0 ? (
          <p className="py-12 text-slate-400">Nenhum plano disponível no momento.</p>
        ) : (
          <div className="mt-10 grid gap-6 text-left md:grid-cols-2 lg:grid-cols-3">
            {plans.map((p) => (
              <HomePlanCard key={p.key} p={p} cycle={cycle} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
