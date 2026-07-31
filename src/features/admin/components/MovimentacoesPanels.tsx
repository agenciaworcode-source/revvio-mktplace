import type { ReactNode } from "react";
import { Badge, Card } from "@/components/ui-light";
import { formatCurrency, formatDate } from "@/lib/format";
import type { AdminRemovalRow, AdminSaleRow } from "../queries";

const PAYMENT_LABELS: Record<string, string> = {
  pix: "Pix",
  financiamento: "Financiamento",
  a_vista: "À vista",
};

/* Linha rótulo/valor dos cards de celular. */
function DataRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="shrink-0 text-[11.5px] font-semibold uppercase tracking-[.4px] text-slate-400">
        {label}
      </span>
      <span className="min-w-0 truncate text-right text-[13px] text-slate-700">{children}</span>
    </div>
  );
}

/* Cabeçalho comum dos cards: veículo à esquerda, valor à direita. */
function MobileCard({
  title,
  value,
  children,
}: {
  title: string;
  value: number;
  children: ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 flex-1 font-semibold text-slate-900">{title}</p>
        <span className="shrink-0 font-bold text-slate-900">{formatCurrency(value)}</span>
      </div>
      <div className="mt-2 divide-y divide-slate-100 border-t border-slate-100 pt-1">
        {children}
      </div>
    </Card>
  );
}

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
    <>
      {/* Celular/tablet: cards. A tabela só cabe a partir de `lg`. */}
      <div className="flex flex-col gap-3 lg:hidden">
        {rows.map((s) => (
          <MobileCard key={s.id} title={s.vehicle_label} value={s.sale_price}>
            <DataRow label="Data">{formatDate(s.sale_date)}</DataRow>
            {showSeller && <DataRow label="Garagista">{s.seller_name}</DataRow>}
            <DataRow label="Comprador">{s.buyer_name}</DataRow>
            <DataRow label="Pagamento">
              <Badge tone="sky">{PAYMENT_LABELS[s.payment_method] ?? s.payment_method}</Badge>
            </DataRow>
            <DataRow label="Motivo">{s.sale_reason ?? "—"}</DataRow>
          </MobileCard>
        ))}
      </div>

      <Card className="hidden overflow-x-auto p-0 lg:block">
      <table className="w-full min-w-[780px] text-sm">
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
    </>
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
    <>
      {/* Celular/tablet: cards. A tabela só cabe a partir de `lg`. */}
      <div className="flex flex-col gap-3 lg:hidden">
        {rows.map((v) => (
          <MobileCard key={v.id} title={v.vehicle_label} value={v.price}>
            <DataRow label="Removido em">
              {v.removed_at ? formatDate(v.removed_at) : "—"}
            </DataRow>
            {showSeller && <DataRow label="Garagista">{v.seller_name}</DataRow>}
            <DataRow label="Motivo">{v.removal_reason ?? "—"}</DataRow>
          </MobileCard>
        ))}
      </div>

      <Card className="hidden overflow-x-auto p-0 lg:block">
      <table className="w-full min-w-[780px] text-sm">
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
    </>
  );
}
