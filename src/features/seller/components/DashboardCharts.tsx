import { Card } from "@/components/ui-light";
import { formatCurrency } from "@/lib/format";

/* Gráficos do painel do garagista — SVG/HTML à mão, sem dependência de lib.
   Recebe formas mínimas para não acoplar aos tipos do banco. */
type SaleLike = { sale_date: string; sale_price: number | string };
type VehicleLike = { status: string };

const MONTHS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

function parseSaleDate(s: string): Date {
  return new Date(s.length <= 10 ? `${s}T00:00:00` : s);
}

/** Soma de faturamento por mês nos últimos 6 meses (inclui o atual). */
function lastSixMonths(sales: SaleLike[]) {
  const now = new Date();
  const buckets = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return { key: `${d.getFullYear()}-${d.getMonth()}`, label: MONTHS[d.getMonth()], total: 0 };
  });
  const index = new Map(buckets.map((b, i) => [b.key, i]));
  for (const s of sales) {
    const d = parseSaleDate(s.sale_date);
    const i = index.get(`${d.getFullYear()}-${d.getMonth()}`);
    if (i != null) buckets[i].total += Number(s.sale_price);
  }
  return buckets;
}

/* ── Faturamento por mês (barras em SVG) ─────────────────── */
function RevenueBarChart({ sales }: { sales: SaleLike[] }) {
  const data = lastSixMonths(sales);
  const max = Math.max(1, ...data.map((d) => d.total));
  const hasAny = data.some((d) => d.total > 0);

  // viewBox: 6 slots de 60 (largura 360), altura útil 120.
  const SLOT = 60;
  const CHART_H = 120;
  const BAR_W = 34;

  return (
    <Card className="p-0">
      <div className="border-b border-hair px-5 py-4">
        <h3 className="text-sm font-bold text-slate-900">Faturamento por mês</h3>
        <p className="mt-0.5 text-xs text-slate-400">Últimos 6 meses</p>
      </div>
      <div className="px-5 py-4">
        {hasAny ? (
          <>
            <svg
              viewBox={`0 0 ${SLOT * 6} ${CHART_H}`}
              preserveAspectRatio="none"
              className="h-32 w-full"
              role="img"
              aria-label="Gráfico de faturamento dos últimos 6 meses"
            >
              {data.map((d, i) => {
                const barH = Math.round((d.total / max) * (CHART_H - 10));
                const x = i * SLOT + (SLOT - BAR_W) / 2;
                const y = CHART_H - barH;
                return (
                  <g key={d.key}>
                    <title>{`${d.label}: ${formatCurrency(d.total)}`}</title>
                    <rect
                      x={x}
                      y={CHART_H - (CHART_H - 10)}
                      width={BAR_W}
                      height={CHART_H - 10}
                      rx={5}
                      className="fill-slate-100"
                    />
                    <rect
                      x={x}
                      y={y}
                      width={BAR_W}
                      height={Math.max(barH, 2)}
                      rx={5}
                      className="fill-brand"
                    />
                  </g>
                );
              })}
            </svg>
            <div className="mt-2 flex">
              {data.map((d) => (
                <span
                  key={d.key}
                  className="flex-1 text-center text-[11px] font-semibold text-slate-400"
                >
                  {d.label}
                </span>
              ))}
            </div>
          </>
        ) : (
          <p className="py-10 text-center text-sm text-slate-400">
            Sem vendas nos últimos 6 meses.
          </p>
        )}
      </div>
    </Card>
  );
}

/* ── Status do estoque (barra empilhada) ─────────────────── */
const STOCK_META: { key: string; label: string; cls: string; dot: string }[] = [
  { key: "available", label: "Ativos", cls: "bg-brand", dot: "bg-brand" },
  { key: "reserved", label: "Reservados", cls: "bg-amber-400", dot: "bg-amber-400" },
  { key: "sold", label: "Vendidos", cls: "bg-slate-400", dot: "bg-slate-400" },
];

function StockChart({ vehicles }: { vehicles: VehicleLike[] }) {
  const counts = STOCK_META.map((m) => ({
    ...m,
    n: vehicles.filter((v) => v.status === m.key).length,
  }));
  const total = counts.reduce((acc, c) => acc + c.n, 0);

  return (
    <Card className="p-0">
      <div className="border-b border-hair px-5 py-4">
        <h3 className="text-sm font-bold text-slate-900">Status do estoque</h3>
        <p className="mt-0.5 text-xs text-slate-400">{total} veículos no total</p>
      </div>
      <div className="px-5 py-4">
        {total > 0 ? (
          <>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
              {counts.map((c) =>
                c.n > 0 ? (
                  <div
                    key={c.key}
                    className={c.cls}
                    style={{ width: `${(c.n / total) * 100}%` }}
                    title={`${c.label}: ${c.n}`}
                  />
                ) : null
              )}
            </div>
            <div className="mt-4 flex flex-col gap-2">
              {counts.map((c) => (
                <div key={c.key} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-slate-500">
                    <span className={`h-2.5 w-2.5 rounded-full ${c.dot}`} />
                    {c.label}
                  </span>
                  <span className="font-bold text-slate-900">{c.n}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="py-10 text-center text-sm text-slate-400">
            Nenhum veículo no estoque ainda.
          </p>
        )}
      </div>
    </Card>
  );
}

export function DashboardCharts({
  sales,
  vehicles,
}: {
  sales: SaleLike[];
  vehicles: VehicleLike[];
}) {
  return (
    <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
      <RevenueBarChart sales={sales} />
      <StockChart vehicles={vehicles} />
    </div>
  );
}
