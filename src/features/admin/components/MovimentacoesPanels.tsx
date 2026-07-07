import { Badge, Card } from "@/components/ui-light";
import { formatCurrency, formatDate } from "@/lib/format";
import type { AdminRemovalRow, AdminSaleRow } from "../queries";

const PAYMENT_LABELS: Record<string, string> = {
  pix: "Pix",
  financiamento: "Financiamento",
  a_vista: "À vista",
};

/** Chips "motivo: contagem" do conjunto recebido (já filtrado). Omite zeros. */
export function ReasonSummary({
  rows,
  reasons,
}: {
  rows: { reason: string | null }[];
  reasons: readonly string[];
}) {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const key = r.reason ?? "—";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  // ordem: motivos conhecidos primeiro (na ordem da lista), depois extras/—
  const ordered = [
    ...reasons.filter((r) => counts.has(r)),
    ...[...counts.keys()].filter((k) => !reasons.includes(k)),
  ];
  if (ordered.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {ordered.map((r) => (
        <span
          key={r}
          className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700"
        >
          <span>{r}</span>
          <span className="font-semibold text-slate-900">{counts.get(r)}</span>
        </span>
      ))}
    </div>
  );
}

export function SalesReasonTable({
  rows,
  showSeller,
}: {
  rows: AdminSaleRow[];
  showSeller: boolean;
}) {
  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">Nenhuma venda no período/filtro.</p>;
  }
  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
          <tr>
            <th className="px-5 py-3 font-medium">Data</th>
            <th className="px-5 py-3 font-medium">Veículo</th>
            {showSeller && <th className="px-5 py-3 font-medium">Garagista</th>}
            <th className="px-5 py-3 font-medium">Comprador</th>
            <th className="px-5 py-3 font-medium">Pagamento</th>
            <th className="px-5 py-3 font-medium">Motivo</th>
            <th className="px-5 py-3 text-right font-medium">Valor</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((s) => (
            <tr key={s.id}>
              <td className="px-5 py-3 text-slate-600">{formatDate(s.sale_date)}</td>
              <td className="px-5 py-3 font-medium text-slate-900">{s.vehicle_label}</td>
              {showSeller && <td className="px-5 py-3 text-slate-600">{s.seller_name}</td>}
              <td className="px-5 py-3 text-slate-600">{s.buyer_name}</td>
              <td className="px-5 py-3">
                <Badge tone="sky">{PAYMENT_LABELS[s.payment_method] ?? s.payment_method}</Badge>
              </td>
              <td className="px-5 py-3 text-slate-600">{s.sale_reason ?? "—"}</td>
              <td className="px-5 py-3 text-right font-semibold text-slate-900">
                {formatCurrency(s.sale_price)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

export function RemovalsReasonTable({
  rows,
  showSeller,
}: {
  rows: AdminRemovalRow[];
  showSeller: boolean;
}) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-500">
        Nenhuma remoção no período/filtro.
      </p>
    );
  }
  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
          <tr>
            <th className="px-5 py-3 font-medium">Removido em</th>
            <th className="px-5 py-3 font-medium">Veículo</th>
            {showSeller && <th className="px-5 py-3 font-medium">Garagista</th>}
            <th className="px-5 py-3 font-medium">Motivo</th>
            <th className="px-5 py-3 text-right font-medium">Valor</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((v) => (
            <tr key={v.id}>
              <td className="px-5 py-3 text-slate-600">
                {v.removed_at ? formatDate(v.removed_at) : "—"}
              </td>
              <td className="px-5 py-3 font-medium text-slate-900">{v.vehicle_label}</td>
              {showSeller && <td className="px-5 py-3 text-slate-600">{v.seller_name}</td>}
              <td className="px-5 py-3 text-slate-600">{v.removal_reason ?? "—"}</td>
              <td className="px-5 py-3 text-right font-semibold text-slate-900">
                {formatCurrency(v.price)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
