import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAdminVehicles,
  useAdminVehicleForEdit,
  useAdminSetVehicleBlocked,
  useAdminDeleteVehicle,
  type AdminVehicle,
} from "../queries";
import { AdminActions } from "../components";
import { VehicleForm } from "@/features/seller/pages/Vehicles";
import { PanelHeader, SectionCard } from "@/components/panel";
import { formatCurrency, formatNumber } from "@/lib/format";
import { Spinner } from "@/components/ui";
import { Alert, Button, Modal, Spinner as LightSpinner } from "@/components/ui-light";
import { ReasonField, REMOVAL_REASONS } from "@/components/ReasonField";

/* Modal de edição: carrega o veículo completo e reusa o VehicleForm do garagista. */
function AdminEditVehicleModal({
  vehicle,
  onClose,
}: {
  vehicle: AdminVehicle;
  onClose: () => void;
}) {
  const { data, isLoading } = useAdminVehicleForEdit(vehicle.id);
  const qc = useQueryClient();
  const close = () => {
    qc.invalidateQueries({ queryKey: ["admin-vehicles"] });
    onClose();
  };
  return (
    <Modal open wide closeOnBackdrop={false} onClose={close} title="Editar veículo">
      {isLoading || !data ? (
        <div className="flex justify-center py-12 text-slate-400">
          <LightSpinner />
        </div>
      ) : (
        <VehicleForm vehicle={data} lojaId={vehicle.seller_id} onClose={close} />
      )}
    </Modal>
  );
}

/* Rótulo PT + estilo do badge por status do veículo. */
const STATUS_META: Record<string, { label: string; cls: string }> = {
  available: { label: "Disponível", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  reserved: { label: "Reservado", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
  sold: { label: "Vendido", cls: "bg-slate-100 text-slate-500 ring-slate-200" },
};

function statusMeta(status: string) {
  return STATUS_META[status] ?? { label: status, cls: "bg-slate-100 text-slate-500 ring-slate-200" };
}

const selectCls =
  "rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-700 outline-none focus:border-brand";
const inputCls =
  "w-28 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-700 outline-none focus:border-brand";

export function Vehicles() {
  const { data, isLoading } = useAdminVehicles();
  const vehicles = useMemo(() => data ?? [], [data]);

  const [status, setStatus] = useState("all");
  const [make, setMake] = useState("all");
  const [seller, setSeller] = useState("all");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");

  const [editing, setEditing] = useState<AdminVehicle | null>(null);
  const [deleting, setDeleting] = useState<AdminVehicle | null>(null);
  const [removalReason, setRemovalReason] = useState("");
  const setBlocked = useAdminSetVehicleBlocked();
  const removeVehicle = useAdminDeleteVehicle();

  async function confirmDelete() {
    if (!deleting || !removalReason.trim()) return;
    try {
      await removeVehicle.mutateAsync({ id: deleting.id, reason: removalReason.trim() });
      setDeleting(null);
      setRemovalReason("");
    } catch {
      /* erro exibido no modal via removeVehicle.isError */
    }
  }

  const makes = useMemo(
    () => Array.from(new Set(vehicles.map((v) => v.make).filter(Boolean))).sort(),
    [vehicles]
  );
  const sellers = useMemo(
    () =>
      Array.from(new Set(vehicles.map((v) => v.seller?.name).filter(Boolean) as string[])).sort(),
    [vehicles]
  );

  const filtered = useMemo(() => {
    const min = priceMin ? Number(priceMin) : null;
    const max = priceMax ? Number(priceMax) : null;
    return vehicles.filter((v) => {
      if (status !== "all" && v.status !== status) return false;
      if (make !== "all" && v.make !== make) return false;
      if (seller !== "all" && (v.seller?.name ?? "") !== seller) return false;
      if (min !== null && v.price < min) return false;
      if (max !== null && v.price > max) return false;
      return true;
    });
  }, [vehicles, status, make, seller, priceMin, priceMax]);

  const hasFilter =
    status !== "all" || make !== "all" || seller !== "all" || !!priceMin || !!priceMax;

  const clearFilters = () => {
    setStatus("all");
    setMake("all");
    setSeller("all");
    setPriceMin("");
    setPriceMax("");
  };

  const exportRows = filtered.map((v) => ({
    veiculo: `${v.make} ${v.model}`,
    garagem: v.seller?.name ?? "",
    status: statusMeta(v.status).label,
    ano: v.year ?? "",
    preco: v.price,
    fipe: v.fipe_price ?? "",
    cliques: v.clicks ?? 0,
  }));

  return (
    <div>
      <PanelHeader
        title="Veículos na Plataforma"
        subtitle="Inventário consolidado de todas as garagens"
        actions={<AdminActions rows={exportRows} filename="veiculos" />}
      />

      {isLoading ? (
        <div className="flex justify-center py-24 text-slate-400">
          <Spinner />
        </div>
      ) : (
        <SectionCard className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f1f3f5] px-6 py-5">
            <div className="text-base font-bold text-slate-950">
              Inventário consolidado ·{" "}
              {hasFilter
                ? `${formatNumber(filtered.length)} de ${formatNumber(vehicles.length)} veículos`
                : `${formatNumber(vehicles.length)} veículos`}
            </div>
            {hasFilter && (
              <button
                onClick={clearFilters}
                className="text-[13px] font-semibold text-brand hover:underline"
              >
                Limpar filtros
              </button>
            )}
          </div>

          {vehicles.length > 0 && (
            <div className="flex flex-wrap items-end gap-3 border-b border-[#f1f3f5] bg-[#fbfbfc] px-6 py-4">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-bold uppercase tracking-[.5px] text-slate-400">
                  Status
                </span>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectCls}>
                  <option value="all">Todos</option>
                  <option value="available">Disponível</option>
                  <option value="reserved">Reservado</option>
                  <option value="sold">Vendido</option>
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-bold uppercase tracking-[.5px] text-slate-400">
                  Marca
                </span>
                <select value={make} onChange={(e) => setMake(e.target.value)} className={selectCls}>
                  <option value="all">Todas</option>
                  {makes.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-bold uppercase tracking-[.5px] text-slate-400">
                  Garagista
                </span>
                <select value={seller} onChange={(e) => setSeller(e.target.value)} className={selectCls}>
                  <option value="all">Todos</option>
                  {sellers.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-bold uppercase tracking-[.5px] text-slate-400">
                  Preço (R$)
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="Mín."
                    value={priceMin}
                    onChange={(e) => setPriceMin(e.target.value)}
                    className={inputCls}
                  />
                  <span className="text-slate-300">–</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="Máx."
                    value={priceMax}
                    onChange={(e) => setPriceMax(e.target.value)}
                    className={inputCls}
                  />
                </div>
              </label>
            </div>
          )}

          {vehicles.length === 0 ? (
            <div className="px-6 py-16 text-center text-[14px] text-slate-400">
              Nenhum veículo cadastrado na plataforma.
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-16 text-center text-[14px] text-slate-400">
              Nenhum veículo corresponde aos filtros.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    {["Veículo", "Garagem", "Status", "Ano", "Preço", "FIPE", "Cliques", "Ações"].map(
                      (h, i) => (
                        <th
                          key={h}
                          className="border-b border-[#f1f3f5] bg-[#fbfbfc] px-6 py-3 text-[11.5px] font-bold uppercase tracking-[.6px] text-slate-400"
                          style={{ textAlign: i > 1 ? "center" : "left" }}
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((v) => (
                    <tr key={v.id} className="hover:bg-[#fafbfc]">
                      <td className="border-b border-cloud px-6 py-3">
                        <div className="flex items-center gap-3">
                          {v.images?.[0] ? (
                            <img
                              src={v.images[0]}
                              alt=""
                              className="h-10 w-14 rounded-lg object-cover"
                            />
                          ) : (
                            <span className="h-10 w-14 rounded-lg bg-slate-100" />
                          )}
                          <div>
                            <div className="text-[13.5px] font-bold uppercase text-slate-950">
                              {v.make}
                            </div>
                            <div className="text-[12.5px] text-slate-400">{v.model}</div>
                          </div>
                        </div>
                      </td>
                      <td className="border-b border-cloud px-6 py-3 text-slate-600">
                        {v.seller?.name ?? "—"}
                      </td>
                      <td className="border-b border-cloud px-6 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11.5px] font-semibold ring-1 ring-inset ${
                              statusMeta(v.status).cls
                            }`}
                          >
                            {statusMeta(v.status).label}
                          </span>
                          {v.blocked && (
                            <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-600 ring-1 ring-inset ring-red-200">
                              Bloqueado
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="border-b border-cloud px-6 py-3 text-center text-slate-600">
                        {v.year ?? "—"}
                      </td>
                      <td className="border-b border-cloud px-6 py-3 text-center font-extrabold text-brand-dark">
                        {formatCurrency(v.price)}
                      </td>
                      <td className="border-b border-cloud px-6 py-3 text-center text-slate-400">
                        {v.fipe_price ? (
                          <span className="line-through">{formatCurrency(v.fipe_price)}</span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="border-b border-cloud px-6 py-3 text-center font-semibold text-slate-700">
                        {formatNumber(v.clicks ?? 0)}
                      </td>
                      <td className="border-b border-cloud px-6 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            className="px-2.5 py-1 text-xs"
                            onClick={() => setEditing(v)}
                          >
                            Editar
                          </Button>
                          <Button
                            variant="ghost"
                            className="px-2.5 py-1 text-xs"
                            loading={setBlocked.isPending && setBlocked.variables?.id === v.id}
                            onClick={() =>
                              setBlocked.mutate({ id: v.id, blocked: !v.blocked })
                            }
                          >
                            {v.blocked ? "Desbloquear" : "Bloquear"}
                          </Button>
                          <Button
                            variant="ghost"
                            className="px-2.5 py-1 text-xs text-red-500 hover:bg-red-50"
                            onClick={() => setDeleting(v)}
                          >
                            Excluir
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      )}

      {editing && (
        <AdminEditVehicleModal vehicle={editing} onClose={() => setEditing(null)} />
      )}

      {deleting && (
        <Modal
          open
          closeOnBackdrop={false}
          onClose={() => {
            setDeleting(null);
            setRemovalReason("");
          }}
          title="Excluir veículo"
        >
          <div className="flex flex-col gap-4">
            <p className="text-sm text-slate-600">
              Excluir{" "}
              <strong className="text-slate-900">
                {deleting.make} {deleting.model}
              </strong>{" "}
              da garagem {deleting.seller?.name ?? "—"}? O veículo sai das listagens, mas o
              registro é mantido para histórico.
            </p>
            <ReasonField
              label="Motivo da remoção"
              options={REMOVAL_REASONS}
              onResolved={setRemovalReason}
            />
            {removeVehicle.isError && (
              <Alert variant="error">Não foi possível excluir o veículo. Tente novamente.</Alert>
            )}
            <div className="flex justify-end gap-3">
              <Button
                variant="ghost"
                onClick={() => {
                  setDeleting(null);
                  setRemovalReason("");
                }}
              >
                Cancelar
              </Button>
              <Button
                variant="danger"
                loading={removeVehicle.isPending}
                disabled={!removalReason.trim()}
                onClick={confirmDelete}
              >
                Excluir
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
