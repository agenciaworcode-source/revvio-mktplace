import { useAdminOverview } from "../queries";
import { AdminActions, SubscribersTable } from "../components";
import { PanelHeader } from "@/components/panel";
import { Spinner } from "@/components/ui";

export function Sellers() {
  const o = useAdminOverview();

  return (
    <div>
      <PanelHeader
        title="Assinantes · Garagistas"
        subtitle="Gerencie os lojistas assinantes da plataforma"
        actions={<AdminActions rows={o.sellers} filename="assinantes" />}
      />

      {o.loading ? (
        <div className="flex justify-center py-24 text-slate-400">
          <Spinner />
        </div>
      ) : (
        <SubscribersTable
          sellers={o.sellers}
          plansByKey={o.plansByKey}
          vehicleCounts={o.vehicleCounts}
        />
      )}
    </div>
  );
}
