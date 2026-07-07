import { Link } from "react-router-dom";
import { Icon } from "@/features/public/components/icons";
import {
  GhostButton,
  PlanBadge,
  StatusPill,
  SectionCard,
  brlShort,
} from "@/components/panel";
import type { Seller, SellerStatus } from "@/lib/database.types";
import type { PricingPlan } from "@/features/public/queries";
import { useSetSellerStatus } from "./queries";

/* Transições de status do garagista disponíveis por situação atual.
   Compartilhado entre a lista (ação rápida) e a página de detalhe. */
export const SELLER_STATUS_ACTIONS: Record<
  SellerStatus,
  { label: string; to: SellerStatus; tone: "approve" | "danger" }[]
> = {
  pending: [
    { label: "Aprovar", to: "active", tone: "approve" },
    { label: "Rejeitar", to: "suspended", tone: "danger" },
  ],
  active: [{ label: "Suspender", to: "suspended", tone: "danger" }],
  suspended: [{ label: "Reativar", to: "active", tone: "approve" }],
};

/* Ações rápidas de status na lista de garagistas (aprovar/suspender/reativar). */
function StatusQuickActions({ seller }: { seller: Seller }) {
  const setStatus = useSetSellerStatus();
  const actions = SELLER_STATUS_ACTIONS[seller.status] ?? [];
  if (actions.length === 0) return null;
  return (
    <div className="mt-1.5 flex justify-center gap-1.5">
      {actions.map((a) => (
        <button
          key={a.to}
          onClick={() => setStatus.mutate({ id: seller.id, status: a.to })}
          disabled={setStatus.isPending}
          className={[
            "rounded-lg border px-2.5 py-1 text-[12px] font-bold transition-colors disabled:opacity-50",
            a.tone === "approve"
              ? "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
              : "border-red-200 text-red-500 hover:bg-red-50",
          ].join(" ")}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}

/* Ações padrão do header do admin (Exportar CSV). Novos assinantes entram
   pelo fluxo de assinatura (pagamento), não por criação manual. */
export function AdminActions({
  rows,
  filename,
}: {
  rows?: Record<string, unknown>[];
  filename?: string;
}) {

  function exportCsv() {
    if (!rows || rows.length === 0) return;
    const cols = Object.keys(rows[0]);
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [
      cols.join(","),
      ...rows.map((r) => cols.map((c) => esc(r[c])).join(",")),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename ?? "revvio-export"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <GhostButton onClick={exportCsv} style={!rows?.length ? { opacity: 0.5 } : undefined}>
        <Icon name="download" size={17} /> Exportar
      </GhostButton>
    </>
  );
}

/* Avatar do garagista (ou caixa com inicial quando não há foto). */
function SellerAvatar({ seller, size = 38 }: { seller: Seller; size?: number }) {
  if (seller.avatar_url)
    return (
      <img
        src={seller.avatar_url}
        alt=""
        className="rounded-[9px] object-cover"
        style={{ width: size, height: size }}
      />
    );
  return (
    <span
      className="grid place-items-center rounded-[9px] bg-slate-100 text-sm font-bold text-slate-400"
      style={{ width: size, height: size }}
    >
      {seller.name?.[0]?.toUpperCase() ?? "?"}
    </span>
  );
}

/* Tabela de Assinantes · Garagistas (reusada na Visão Geral e em Assinantes). */
export function SubscribersTable({
  sellers,
  plansByKey,
  vehicleCounts,
  compact = false,
}: {
  sellers: Seller[];
  plansByKey: Map<string, PricingPlan>;
  vehicleCounts: Map<string, number>;
  compact?: boolean;
}) {
  const rows = compact ? sellers.slice(0, 4) : sellers;
  const ths = ["Garagem", "Plano", "MRR", "Veículos", "Status", "Mini-loja"];

  return (
    <SectionCard className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-[#f1f3f5] px-6 py-5">
        <div>
          <div className="text-base font-bold text-slate-950">Assinantes · Garagistas</div>
          <div className="mt-0.5 text-[13px] text-slate-400">
            Lojistas com assinatura na plataforma
          </div>
        </div>
        {compact && (
          <Link
            to="/dashboard/sellers"
            className="inline-flex items-center gap-1.5 text-[13px] font-bold text-brand hover:opacity-75"
          >
            Ver todos <Icon name="arrowRight" size={15} />
          </Link>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="px-6 py-16 text-center text-[14px] text-slate-400">
          Nenhum garagista cadastrado ainda.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {ths.map((h, i) => (
                  <th
                    key={h}
                    className="border-b border-[#f1f3f5] bg-[#fbfbfc] px-6 py-3 text-[11.5px] font-bold uppercase tracking-[.6px] text-slate-400"
                    style={{ textAlign: i > 1 && i < 5 ? "center" : "left" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const plan = s.pricing_plan_key
                  ? plansByKey.get(s.pricing_plan_key)
                  : undefined;
                const loc = [s.city, s.state].filter(Boolean).join(", ");
                return (
                  <tr key={s.id} className="hover:bg-[#fafbfc]">
                    <td className="border-b border-cloud px-6 py-3.5">
                      <Link
                        to={`/dashboard/sellers/${s.id}`}
                        className="flex items-center gap-3"
                      >
                        <SellerAvatar seller={s} />
                        <div>
                          <div className="font-bold text-slate-950">{s.name}</div>
                          <div className="text-[12.5px] text-slate-400">{loc || "—"}</div>
                        </div>
                      </Link>
                    </td>
                    <td className="border-b border-cloud px-6 py-3.5">
                      <PlanBadge name={plan?.name} />
                    </td>
                    <td className="border-b border-cloud px-6 py-3.5 text-center font-bold text-slate-950">
                      {plan ? brlShort(plan.price_monthly) : "—"}
                    </td>
                    <td className="border-b border-cloud px-6 py-3.5 text-center text-slate-600">
                      {vehicleCounts.get(s.id) ?? 0}
                    </td>
                    <td className="border-b border-cloud px-6 py-3.5 text-center">
                      <StatusPill status={s.status} />
                      <StatusQuickActions seller={s} />
                    </td>
                    <td className="border-b border-cloud px-6 py-3.5">
                      <a
                        href={`/loja/${s.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#e6e8ec] px-3 py-1.5 text-[13px] font-bold text-brand hover:bg-slate-50"
                      >
                        <Icon name="eye" size={15} /> Ver loja
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}
