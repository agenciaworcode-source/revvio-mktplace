import { Navigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthProvider";
import { PageHeader } from "@/components/ui-light";
import { LeadsView } from "@/features/leads/components/LeadsView";
import { ClickTrackingPanel } from "@/features/tracking/components/ClickTrackingPanel";

export function Leads() {
  const { lojaId, isGaragista, isAdmin } = useAuth();
  if (!(isGaragista || isAdmin)) return <Navigate to="/painel" replace />;
  return (
    <div>
      <PageHeader title="Leads" subtitle="Gerencie os interessados nas suas ofertas." />
      <LeadsView sellerId={lojaId ?? undefined} />

      <div className="mt-8">
        <h2 className="mb-3 text-[15px] font-bold text-slate-950">Rastreamento de cliques</h2>
        <ClickTrackingPanel
          sellerId={lojaId ?? undefined}
          subtitle="Veja quem clicou em cada veículo e quem acessou seus canais."
        />
      </div>
    </div>
  );
}
