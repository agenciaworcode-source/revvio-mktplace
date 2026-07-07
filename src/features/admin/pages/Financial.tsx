import { Link } from "react-router-dom";
import { useAdminOverview, useSalesOps } from "../queries";
import { AdminActions } from "../components";
import {
  PanelHeader,
  KpiCard,
  BarsChart,
  PlanSplit,
  SectionCard,
  brlShort,
} from "@/components/panel";
import { formatCurrency, formatNumber } from "@/lib/format";
import { Spinner } from "@/components/ui";

/* ── Vendas intermediadas (operação do marketplace) ──────── */
function SalesOpsSection() {
  const ops = useSalesOps();

  const exportRows = ops.rows.map((r) => ({
    garagista: r.name,
    vendas: r.salesCount,
    volume: r.volume,
    comissao_a_receber: r.commissionPending,
    comissao_paga: r.commissionPaid,
  }));

  return (
    <div className="mt-12">
      <PanelHeader
        title="Vendas intermediadas"
        subtitle="Volume operado pelos garagistas no marketplace (não é receita da plataforma)"
        actions={<AdminActions rows={exportRows} filename="vendas-intermediadas" />}
      />

      {ops.loading ? (
        <div className="flex justify-center py-16 text-slate-400">
          <Spinner />
        </div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard
              label="Volume intermediado"
              value={brlShort(ops.gmv)}
              sub="soma das vendas"
              icon="dollar"
            />
            <KpiCard
              label="Vendas"
              value={formatNumber(ops.salesCount)}
              sub="registradas"
              icon="car"
              accent="#3b82f6"
            />
            <KpiCard
              label="Ticket médio"
              value={brlShort(ops.avgTicket)}
              sub="por venda"
              icon="wallet"
              accent="#8b5cf6"
            />
            <KpiCard
              label="Comissões dos garagistas"
              value={brlShort(ops.commissionPending + ops.commissionPaid)}
              sub={`${brlShort(ops.commissionPending)} a receber`}
              icon="trendUp"
              accent="#f59e0b"
            />
          </div>

          <SectionCard className="overflow-hidden">
            <div className="border-b border-[#f1f3f5] px-6 py-5">
              <div className="text-base font-bold text-slate-950">
                Breakdown por garagista
              </div>
              <div className="mt-0.5 text-[13px] text-slate-400">
                Volume e comissões por vendedor
              </div>
            </div>
            {ops.rows.length === 0 ? (
              <div className="px-6 py-16 text-center text-[14px] text-slate-400">
                Nenhuma venda registrada ainda.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      {["Garagista", "Vendas", "Volume", "A receber", "Pagas"].map(
                        (h, i) => (
                          <th
                            key={h}
                            className="border-b border-[#f1f3f5] bg-[#fbfbfc] px-6 py-3 text-[11.5px] font-bold uppercase tracking-[.6px] text-slate-400"
                            style={{ textAlign: i === 0 ? "left" : "right" }}
                          >
                            {h}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {ops.rows.map((r) => (
                      <tr key={r.sellerId} className="hover:bg-[#fafbfc]">
                        <td className="border-b border-cloud px-6 py-3.5">
                          <Link
                            to={`/dashboard/sellers/${r.sellerId}`}
                            className="font-bold text-slate-950 hover:text-brand"
                          >
                            {r.name}
                          </Link>
                        </td>
                        <td className="border-b border-cloud px-6 py-3.5 text-right text-slate-600">
                          {r.salesCount}
                        </td>
                        <td className="border-b border-cloud px-6 py-3.5 text-right font-bold text-slate-950">
                          {formatCurrency(r.volume)}
                        </td>
                        <td className="border-b border-cloud px-6 py-3.5 text-right text-amber-600">
                          {formatCurrency(r.commissionPending)}
                        </td>
                        <td className="border-b border-cloud px-6 py-3.5 text-right text-emerald-600">
                          {formatCurrency(r.commissionPaid)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}

export function Financial() {
  const o = useAdminOverview();

  return (
    <div>
      <PanelHeader
        title="Gestão Financeira"
        subtitle="Receita recorrente, MRR e faturamento do SaaS"
        actions={<AdminActions rows={o.sellers} filename="assinantes" />}
      />

      {o.loading ? (
        <div className="flex justify-center py-24 text-slate-400">
          <Spinner />
        </div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
            <KpiCard label="MRR" value={brlShort(o.mrr)} sub="recorrente" icon="wallet" />
            <KpiCard
              label="Receita acumulada"
              value={o.accumulated == null ? "—" : brlShort(o.accumulated)}
              sub="cobranças pagas"
              icon="dollar"
              accent="#3b82f6"
            />
            <KpiCard
              label="Assinantes ativos"
              value={o.activeSubs}
              sub="garagens"
              icon="users"
              accent="#8b5cf6"
            />
            <KpiCard
              label="Mini-lojas ativas"
              value={o.miniLojas}
              sub="vitrines públicas"
              icon="store"
              accent="#f59e0b"
            />
            <KpiCard
              label="Veículos"
              value={formatNumber(o.vehicleTotal)}
              sub="na plataforma"
              icon="car"
            />
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.55fr_1fr]">
            <BarsChart
              title="Receita recorrente (MRR)"
              subtitle="Cobranças pagas nos últimos 8 meses"
              headline={brlShort(o.mrr)}
              series={o.mrrSeries}
            />
            <PlanSplit total={o.activeSubs} rows={o.distribution} />
          </div>

          <SalesOpsSection />
        </>
      )}
    </div>
  );
}
