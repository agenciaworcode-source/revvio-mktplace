import { useMemo, useState, type ReactNode } from "react";
import { Alert, Button, Modal, Spinner } from "@/components/ui-light";
import { Icon } from "@/features/public/components/icons";
import { useDeleteLead, useLeads } from "../queries";
import { LeadFilters, filterLeads, EMPTY_FILTERS } from "./LeadFilters";
import { LeadCard } from "./LeadCard";
import { LeadEditModal } from "./LeadEditModal";
import { LeadKanban } from "./LeadKanban";
import { TopClickedCards } from "./TopClickedCards";
import type { LeadWithVehicle } from "../types";

export function LeadsView({
  sellerId,
  extraHeader,
}: {
  sellerId?: string;
  extraHeader?: ReactNode;
}) {
  const { data, isLoading } = useLeads(sellerId);
  const leads = useMemo(() => data ?? [], [data]);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [view, setView] = useState<"cards" | "kanban">("cards");
  const [editing, setEditing] = useState<LeadWithVehicle | null>(null);
  const [deleting, setDeleting] = useState<LeadWithVehicle | null>(null);
  const removeLead = useDeleteLead();

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await removeLead.mutateAsync({ id: deleting.id, sellerId });
      setDeleting(null);
    } catch {
      /* erro exibido no modal via removeLead.isError */
    }
  }

  const cities = useMemo(
    () => Array.from(new Set(leads.map((l) => l.city).filter(Boolean) as string[])).sort(),
    [leads]
  );
  const filtered = useMemo(() => filterLeads(leads, filters), [leads, filters]);

  function exportCsv() {
    const rows = filtered.map((l) => ({
      nome: l.name,
      email: l.email ?? "",
      telefone: l.phone ?? "",
      cidade: l.city ?? "",
      veiculo: l.vehicle ? `${l.vehicle.make} ${l.vehicle.model}` : "",
      estagio: l.stage,
      data: l.created_at,
    }));
    const head = Object.keys(rows[0] ?? { nome: "" });
    const csv = [
      head.join(","),
      ...rows.map((r) =>
        head
          .map((h) => `"${String((r as Record<string, string>)[h] ?? "").replace(/"/g, '""')}"`)
          .join(",")
      ),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "leads.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      {extraHeader}
      <TopClickedCards sellerId={sellerId} />

      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex rounded-lg border border-slate-200 p-0.5">
          <button
            onClick={() => setView("cards")}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
              view === "cards" ? "bg-brand text-white" : "text-slate-500"
            }`}
          >
            Cards
          </button>
          <button
            onClick={() => setView("kanban")}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
              view === "kanban" ? "bg-brand text-white" : "text-slate-500"
            }`}
          >
            Funil
          </button>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={!filtered.length}>
          <Icon name="download" size={16} /> Exportar CSV
        </Button>
      </div>

      <LeadFilters value={filters} onChange={setFilters} cities={cities} />

      {isLoading ? (
        <div className="flex justify-center py-16 text-slate-400">
          <Spinner />
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-16 text-center text-sm text-slate-400">Nenhum lead encontrado.</p>
      ) : view === "cards" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((l) => (
            <LeadCard key={l.id} lead={l} onEdit={setEditing} onDelete={setDeleting} />
          ))}
        </div>
      ) : (
        <LeadKanban
          leads={filtered}
          sellerId={sellerId}
          onEdit={setEditing}
          onDelete={setDeleting}
        />
      )}

      {editing && (
        <LeadEditModal
          lead={editing}
          sellerId={sellerId}
          onClose={() => setEditing(null)}
        />
      )}

      {deleting && (
        <Modal open onClose={() => setDeleting(null)} title="Excluir lead">
          <div className="flex flex-col gap-4">
            <p className="text-sm text-slate-600">
              Tem certeza que deseja excluir o lead{" "}
              <strong className="text-slate-900">{deleting.name}</strong>? Essa ação não pode
              ser desfeita.
            </p>
            {removeLead.isError && (
              <Alert variant="error">Não foi possível excluir o lead. Tente novamente.</Alert>
            )}
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setDeleting(null)}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={confirmDelete} loading={removeLead.isPending}>
                Excluir
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
