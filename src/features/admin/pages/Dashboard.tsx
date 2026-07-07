import { useAdminOverview } from "../queries";
import { AdminActions, SubscribersTable } from "../components";
import {
  PanelHeader,
  KpiCard,
  BarsChart,
  PlanSplit,
  brlShort,
} from "@/components/panel";
import { formatNumber } from "@/lib/format";
import { Spinner } from "@/components/ui";

export function Dashboard() {
  const o = useAdminOverview();

  return (
    <div>
      <PanelHeader
        title="Visão Geral"
        subtitle="Controle global da plataforma REVVIO SaaS"
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

          <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-[1.55fr_1fr]">
            <BarsChart
              title="Receita recorrente (MRR)"
              subtitle="Cobranças pagas nos últimos 8 meses"
              headline={brlShort(o.mrr)}
              series={o.mrrSeries}
            />
            <PlanSplit total={o.activeSubs} rows={o.distribution} />
          </div>

          <SubscribersTable
            sellers={o.sellers}
            plansByKey={o.plansByKey}
            vehicleCounts={o.vehicleCounts}
            compact
          />
        </>
      )}
    </div>
  );
}
