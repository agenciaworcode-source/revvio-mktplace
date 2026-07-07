import { useMemo, useState } from "react";
import { PanelHeader, SectionCard } from "@/components/panel";
import { useAdminVehicles, useAdminSellers, type AdminVehicle } from "../queries";
import { formatCurrency, formatNumber } from "@/lib/format";
import { Spinner } from "@/components/ui";
import { ClickTrackingPanel } from "@/features/tracking/components/ClickTrackingPanel";

const STATUS_META: Record<string, { label: string; cls: string }> = {
  available: { label: "Disponível", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  reserved: { label: "Reservado", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
  sold: { label: "Vendido", cls: "bg-slate-100 text-slate-500 ring-slate-200" },
};
function statusMeta(s: string) {
  return STATUS_META[s] ?? { label: s, cls: "bg-slate-100 text-slate-500 ring-slate-200" };
}

const selectCls =
  "rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-700 outline-none focus:border-brand";

function RastreamentoCliques() {
  const sellers = useAdminSellers();
  const garagistas = useMemo(
    () => (sellers.data ?? []).filter((s) => s.role === "garagista"),
    [sellers.data]
  );
  const [sellerId, setSellerId] = useState("");

  return (
    <ClickTrackingPanel
      sellerId={sellerId || undefined}
      subtitle="Selecione um garagista para ver quem clicou em cada veículo."
      headerExtra={
        <select
          value={sellerId}
          onChange={(e) => setSellerId(e.target.value)}
          className={selectCls}
        >
          <option value="">Selecione um garagista…</option>
          {garagistas.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      }
    />
  );
}
const inputCls =
  "w-28 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-700 outline-none focus:border-brand";

function Thumb({ v }: { v: AdminVehicle }) {
  return v.images?.[0] ? (
    <img src={v.images[0]} alt="" className="h-10 w-14 shrink-0 rounded-lg object-cover" />
  ) : (
    <span className="h-10 w-14 shrink-0 rounded-lg bg-slate-100" />
  );
}

/* Card de anúncio com garagista + cliques (bloco dos mais clicados). */
function TopCard({ v }: { v: AdminVehicle }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#eef0f2] bg-white p-3">
      <Thumb v={v} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-bold text-slate-950">
          {v.make} {v.model}
        </div>
        <div className="truncate text-[12px] text-slate-400">{v.seller?.name ?? "—"}</div>
      </div>
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand/10 px-2.5 py-1 text-[12px] font-bold text-brand-dark">
        👁 {formatNumber(v.clicks ?? 0)}
      </span>
    </div>
  );
}

export function Leads() {
  const { data, isLoading } = useAdminVehicles();
  const vehicles = useMemo(() => data ?? [], [data]);

  const [seller, setSeller] = useState("all");
  const [minClicks, setMinClicks] = useState("");

  const sellers = useMemo(
    () =>
      Array.from(new Set(vehicles.map((v) => v.seller?.name).filter(Boolean) as string[])).sort(),
    [vehicles]
  );

  const top10 = useMemo(
    () =>
      [...vehicles]
        .filter((v) => (v.clicks ?? 0) > 0)
        .sort((a, b) => (b.clicks ?? 0) - (a.clicks ?? 0))
        .slice(0, 10),
    [vehicles]
  );

  const filtered = useMemo(() => {
    const min = minClicks ? Number(minClicks) : 0;
    return vehicles
      .filter(
        (v) =>
          (seller === "all" || (v.seller?.name ?? "") === seller) && (v.clicks ?? 0) >= min
      )
      .sort((a, b) => (b.clicks ?? 0) - (a.clicks ?? 0));
  }, [vehicles, seller, minClicks]);

  const hasFilter = seller !== "all" || !!minClicks;

  return (
    <div>
      <PanelHeader
        title="Anúncios · Cliques"
        subtitle="Cliques nos anúncios de todas as garagens"
      />

      {isLoading ? (
        <div className="flex justify-center py-24 text-slate-400">
          <Spinner />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Bloco fixo: 10 mais clicados */}
          <SectionCard className="p-6">
            <h2 className="mb-1 text-base font-bold text-slate-950">10 anúncios mais clicados</h2>
            <p className="mb-4 text-[13px] text-slate-400">
              Ranking por cliques no botão “Quero ver o carro”.
            </p>
            {top10.length === 0 ? (
              <div className="py-8 text-center text-[14px] text-slate-400">
                Nenhum anúncio recebeu cliques ainda.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {top10.map((v) => (
                  <TopCard key={v.id} v={v} />
                ))}
              </div>
            )}
          </SectionCard>

          {/* Listagem completa em tabela */}
          <SectionCard className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f1f3f5] px-6 py-5">
              <div className="text-base font-bold text-slate-950">
                Todos os anúncios ·{" "}
                {hasFilter
                  ? `${formatNumber(filtered.length)} de ${formatNumber(vehicles.length)}`
                  : formatNumber(vehicles.length)}
              </div>
              {hasFilter && (
                <button
                  onClick={() => {
                    setSeller("all");
                    setMinClicks("");
                  }}
                  className="text-[13px] font-semibold text-brand hover:underline"
                >
                  Limpar filtros
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-end gap-3 border-b border-[#f1f3f5] bg-[#fbfbfc] px-6 py-4">
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
                  Mínimo de cliques
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  placeholder="0"
                  value={minClicks}
                  onChange={(e) => setMinClicks(e.target.value)}
                  className={inputCls}
                />
              </label>
            </div>

            {filtered.length === 0 ? (
              <div className="px-6 py-16 text-center text-[14px] text-slate-400">
                Nenhum anúncio corresponde aos filtros.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      {["Anúncio", "Garagista", "Status", "Preço", "Cliques"].map((h, i) => (
                        <th
                          key={h}
                          className="border-b border-[#f1f3f5] bg-[#fbfbfc] px-6 py-3 text-[11.5px] font-bold uppercase tracking-[.6px] text-slate-400"
                          style={{ textAlign: i > 1 ? "center" : "left" }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((v) => (
                      <tr key={v.id} className="hover:bg-[#fafbfc]">
                        <td className="border-b border-cloud px-6 py-3">
                          <div className="flex items-center gap-3">
                            <Thumb v={v} />
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
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11.5px] font-semibold ring-1 ring-inset ${
                              statusMeta(v.status).cls
                            }`}
                          >
                            {statusMeta(v.status).label}
                          </span>
                        </td>
                        <td className="border-b border-cloud px-6 py-3 text-center font-extrabold text-brand-dark">
                          {formatCurrency(v.price)}
                        </td>
                        <td className="border-b border-cloud px-6 py-3 text-center font-bold text-slate-900">
                          {formatNumber(v.clicks ?? 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          <RastreamentoCliques />
        </div>
      )}
    </div>
  );
}
