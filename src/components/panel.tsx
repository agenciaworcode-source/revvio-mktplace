import type { CSSProperties, ReactNode } from "react";
import { Icon } from "@/features/public/components/icons";
import type { SellerStatus } from "@/lib/database.types";
import { brand, status as statusColor, withAlpha } from "@/theme/palette";

/* ============================================================
   Kit de UI do Painel (tema claro) — usado pelo Admin e pelo
   painel do garagista. Segue o padrão do protótipo REVVIO.
   ============================================================ */

/** 78400 → "R$ 78,4k" · 1060000 → "R$ 1,06M" */
export function brlShort(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(2).replace(".", ",")}M`;
  if (n >= 1_000) return `R$ ${(n / 1_000).toFixed(1).replace(".", ",")}k`;
  return `R$ ${n.toLocaleString("pt-BR")}`;
}

/* ── Cabeçalho de página ─────────────────────────────────── */
export function PanelHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3 sm:mb-7 sm:gap-4">
      <div className="min-w-0">
        <h1 className="text-[22px] font-extrabold tracking-[-.6px] text-slate-950 sm:text-[28px] sm:tracking-[-1px]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1.5 text-[13.5px] text-slate-400 sm:text-[14.5px]">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2.5">{actions}</div>}
    </div>
  );
}

/* ── Card branco genérico ────────────────────────────────── */
export function SectionCard({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border border-hair bg-white shadow-card ${className}`}
    >
      {children}
    </div>
  );
}

/* ── KPI ─────────────────────────────────────────────────── */
export function KpiCard({
  label,
  value,
  sub,
  icon,
  accent = brand.DEFAULT,
  trend,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  icon: string;
  accent?: string;
  trend?: number | null;
}) {
  return (
    <div className="rounded-2xl border border-hair bg-white px-4 py-4 shadow-card sm:px-[22px] sm:py-5">
      <div className="mb-3 flex items-start justify-between gap-2 sm:mb-3.5">
        <span className="min-w-0 text-[12px] font-semibold text-slate-500 sm:text-[13px]">
          {label}
        </span>
        <span
          className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[9px] sm:h-[34px] sm:w-[34px]"
          style={{ background: `${accent}17`, color: accent }}
        >
          <Icon name={icon} size={18} />
        </span>
      </div>
      <div className="break-words text-[22px] font-extrabold leading-none tracking-[-.6px] text-slate-950 sm:text-[30px] sm:tracking-[-1px]">
        {value}
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {trend != null && (
          <span
            className="inline-flex items-center gap-1 text-[12.5px] font-bold"
            style={{ color: trend >= 0 ? brand.dark : statusColor["red-dark"] }}
          >
            <Icon name={trend >= 0 ? "trendUp" : "trendDown"} size={14} />
            {trend >= 0 ? "+" : ""}
            {trend}%
          </span>
        )}
        {sub && <span className="text-[12.5px] text-slate-400">{sub}</span>}
      </div>
    </div>
  );
}

/* ── Pílula de status (seller_status) ────────────────────── */
const STATUS_MAP: Record<
  SellerStatus,
  { t: string; bg: string; c: string; dot: string }
> = {
  active: {
    t: "Ativo",
    bg: withAlpha(brand.DEFAULT, 0.12),
    c: brand.dark,
    dot: brand.DEFAULT,
  },
  pending: {
    t: "Pendente",
    bg: withAlpha(statusColor.amber, 0.14),
    c: statusColor["amber-dark"],
    dot: statusColor.amber,
  },
  suspended: {
    t: "Suspenso",
    bg: withAlpha(statusColor.red, 0.12),
    c: statusColor["red-dark"],
    dot: statusColor.red,
  },
};

export function StatusPill({ status }: { status: SellerStatus }) {
  const s = STATUS_MAP[status] ?? STATUS_MAP.active;
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold"
      style={{ background: s.bg, color: s.c }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.dot }} />
      {s.t}
    </span>
  );
}

/* ── Badge de plano (por nome) ───────────────────────────── */
/* Tom neutro dos planos sem cor própria (slate-500). Não é cor de marca:
   serve justamente para NÃO competir com o verde do plano em destaque. */
const PLAN_NEUTRAL = "#64748b";

export function planColor(name?: string | null): string {
  if (name === "Enterprise") return statusColor.violet;
  if (name === "Profissional") return brand.DEFAULT;
  if (name === "Essencial") return PLAN_NEUTRAL;
  return PLAN_NEUTRAL;
}

export function PlanBadge({ name }: { name?: string | null }) {
  if (!name) return <span className="text-slate-300">—</span>;
  const c = planColor(name);
  return (
    <span
      className="rounded-[7px] px-2.5 py-[3px] text-xs font-bold"
      style={{ color: c, background: `${c}1f` }}
    >
      {name}
    </span>
  );
}

/* ── Gráfico de barras (MRR) ─────────────────────────────── */
export function BarsChart({
  title,
  subtitle,
  headline,
  delta,
  series,
}: {
  title: string;
  subtitle?: string;
  headline?: string;
  delta?: string;
  series: { label: string; value: number }[];
}) {
  const max = Math.max(1, ...series.map((d) => d.value));
  const hasData = series.some((d) => d.value > 0);
  return (
    <SectionCard className="p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-base font-bold text-slate-950">{title}</div>
          {subtitle && <div className="mt-0.5 text-[13px] text-slate-400">{subtitle}</div>}
        </div>
        {headline && (
          <div className="text-right">
            <div className="text-[22px] font-extrabold tracking-[-.5px] text-slate-950">
              {headline}
            </div>
            {delta && <div className="text-[12.5px] font-bold text-brand-dark">{delta}</div>}
          </div>
        )}
      </div>
      {hasData ? (
        <div className="mt-6 flex h-[170px] items-end gap-2.5">
          {series.map((d, i) => {
            const last = i === series.length - 1;
            return (
              <div key={d.label} className="flex flex-1 flex-col items-center gap-2">
                <div
                  className="relative w-full max-w-[34px] rounded-t-[7px]"
                  style={{
                    height: `${(d.value / max) * 140}px`,
                    background: last
                      ? `linear-gradient(180deg,${brand.DEFAULT},${brand.dark})`
                      : brand.tint,
                  }}
                />
                <span className="text-[11.5px] font-semibold text-slate-400">{d.label}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-6 flex h-[170px] items-center justify-center rounded-xl border border-dashed border-hair text-[13.5px] text-slate-400">
          Sem histórico de receita ainda.
        </div>
      )}
    </SectionCard>
  );
}

/* ── Distribuição por plano (barras horizontais) ─────────── */
export function PlanSplit({
  total,
  rows,
}: {
  total: number;
  rows: { name: string; count: number; price: number; color: string }[];
}) {
  return (
    <SectionCard className="p-4 sm:p-6">
      <div className="text-base font-bold text-slate-950">Distribuição por plano</div>
      <div className="mb-5 mt-0.5 text-[13px] text-slate-400">
        {total} {total === 1 ? "assinante ativo" : "assinantes ativos"}
      </div>
      <div className="flex flex-col gap-[18px]">
        {rows.map((p) => (
          <div key={p.name}>
            <div className="mb-1.5 flex justify-between text-[13.5px]">
              <span className="font-bold text-slate-950">{p.name}</span>
              <span className="text-slate-500">
                <b className="text-slate-950">{p.count}</b> · {brlShort(p.price)}/mês
              </span>
            </div>
            <div className="h-[9px] overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${total ? (p.count / total) * 100 : 0}%`,
                  background: p.color,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

/* ── Botões de ação do header (estilo claro) ─────────────── */
export function GhostButton({
  children,
  onClick,
  style,
}: {
  children: ReactNode;
  onClick?: () => void;
  style?: CSSProperties;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-[10px] border border-stroke bg-white px-[18px] py-[11px] text-sm font-bold text-slate-700 hover:bg-slate-50"
      style={style}
    >
      {children}
    </button>
  );
}

export function PrimaryButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-[10px] bg-brand px-[18px] py-[11px] text-sm font-bold text-white shadow-[0_6px_16px_theme(colors.brand.DEFAULT/0.28)] hover:bg-brand-dark"
    >
      {children}
    </button>
  );
}
