import { Fragment, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Icon } from "./icons";
import { brand, withAlpha } from "@/theme/palette";
import { slugify, type FipeHistoricoPonto } from "@/lib/fipe";

/* ============================================================
   Peças compartilhadas pelas quatro telas de /tabela-fipe
   ============================================================ */

export type Trilha = { label: string; to?: string };

export function Breadcrumb({ itens }: { itens: Trilha[] }) {
  return (
    <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-slate-500">
      {itens.map((item, i) => (
        <Fragment key={`${item.label}-${i}`}>
          {i > 0 && <span className="text-slate-300">/</span>}
          {item.to ? (
            <Link to={item.to} className="hover:text-slate-900">
              {item.label}
            </Link>
          ) : (
            <span className="font-semibold text-slate-900">{item.label}</span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}

/** Container padrão das telas da consulta. */
export function FipeContainer({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-[1280px] px-5 py-10 sm:px-7">{children}</div>;
}

/**
 * Âncora de um grupo. Passa pelo slug porque letra ("#") e família
 * ("80 2.0") têm caracteres que não valem como fragmento de URL.
 */
export const ancoraId = (grupo: string) => `fipe-${slugify(grupo) || "outros"}`;

/** Índice de atalhos (A–Z das marcas, famílias dos modelos). */
export function JumpLinks({ itens }: { itens: string[] }) {
  if (itens.length < 2) return null;
  return (
    <div className="mb-8 flex flex-wrap gap-1.5">
      {itens.map((item) => (
        <a
          key={item}
          href={`#${ancoraId(item)}`}
          className="flex h-8 min-w-8 items-center justify-center rounded-lg border border-hair bg-white px-2.5 text-xs font-bold text-slate-600 shadow-card transition-colors hover:border-brand hover:bg-brand hover:text-white"
        >
          {item}
        </a>
      ))}
    </div>
  );
}

/** Cabeçalho de grupo: selo (inicial das marcas) ou texto (família). */
export function GrupoHeader({
  titulo,
  estilo = "selo",
  contador,
}: {
  titulo: string;
  estilo?: "selo" | "texto";
  contador?: number;
}) {
  return (
    <div className="mb-3 flex items-center gap-3">
      {estilo === "selo" ? (
        <span className="grid h-9 min-w-9 place-items-center rounded-xl bg-brand px-2 text-sm font-bold text-white shadow-card">
          {titulo}
        </span>
      ) : (
        <span className="text-base font-bold text-slate-900">{titulo}</span>
      )}
      <span className="h-px flex-1 bg-hair" />
      {contador != null && (
        <span className="text-xs font-medium text-slate-400">{contador}</span>
      )}
    </div>
  );
}

/** Card clicável usado nas grades de marca e de ano. */
export function TileLink({
  to,
  children,
  className = "",
}: {
  to: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      to={to}
      className={`group rounded-xl border border-hair bg-white px-4 py-3.5 text-center shadow-card transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md ${className}`}
    >
      {children}
    </Link>
  );
}

/** Estado vazio/erro das telas da consulta. */
export function FipeAviso({
  titulo,
  descricao,
  acao = "Voltar para a Tabela FIPE",
  to = "/tabela-fipe",
}: {
  titulo: string;
  descricao: string;
  acao?: string;
  to?: string;
}) {
  return (
    <div className="rounded-2xl border border-hair bg-white px-6 py-14 text-center shadow-card">
      <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl bg-brand/10 text-brand">
        <Icon name="search" size={22} />
      </div>
      <p className="text-lg font-bold text-slate-900">{titulo}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-500">
        {descricao}
      </p>
      <Link
        to={to}
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-brand px-6 py-2.5 text-sm font-bold text-white hover:bg-brand-dark"
      >
        <Icon name="search" size={15} /> {acao}
      </Link>
    </div>
  );
}

/* ── Gráfico do histórico ───────────────────────────────── */

const W = 760;
const H = 260;
const PAD = { top: 16, right: 16, bottom: 28, left: 62 };

const moeda = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/** "junho de 2026" -> "jun/26", que é o que cabe no eixo. */
function rotuloCurto(mes: string): string {
  const [nome, ano] = mes.split(" de ");
  return `${nome.slice(0, 3)}/${(ano ?? "").slice(-2)}`;
}

/**
 * Linha do valor mês a mês, em SVG puro — o projeto não tem biblioteca de
 * gráfico e um chart de 13 pontos não justifica trazer uma.
 */
export function HistoricoChart({ pontos }: { pontos: FipeHistoricoPonto[] }) {
  if (pontos.length < 2) return null;

  const valores = pontos.map((p) => p.preco);
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const folga = (max - min) * 0.15 || Math.max(max * 0.05, 1000);
  const yMin = min - folga;
  const yMax = max + folga;

  const x = (i: number) =>
    PAD.left + (i * (W - PAD.left - PAD.right)) / (pontos.length - 1);
  const y = (v: number) =>
    PAD.top + ((yMax - v) / (yMax - yMin)) * (H - PAD.top - PAD.bottom);

  const linha = pontos.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.preco)}`).join(" ");
  const area = `${linha} L${x(pontos.length - 1)},${H - PAD.bottom} L${x(0)},${H - PAD.bottom} Z`;
  const grades = [0, 0.25, 0.5, 0.75, 1].map((t) => yMax - t * (yMax - yMin));
  // Em telas estreitas 13 rótulos viram borrão: mostra 1 a cada 2.
  const passo = pontos.length > 8 ? 2 : 1;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-[280px] w-full"
      role="img"
      aria-label="Evolução do valor FIPE nos últimos meses"
    >
      <defs>
        <linearGradient id="fipe-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={withAlpha(brand.DEFAULT, 0.2)} />
          <stop offset="100%" stopColor={withAlpha(brand.DEFAULT, 0.01)} />
        </linearGradient>
      </defs>

      {grades.map((v) => (
        <g key={v}>
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={y(v)}
            y2={y(v)}
            stroke="rgba(16,24,40,.06)"
            strokeWidth={1}
          />
          <text
            x={PAD.left - 10}
            y={y(v) + 4}
            textAnchor="end"
            className="fill-slate-400 text-[11px]"
          >
            {moeda(v)}
          </text>
        </g>
      ))}

      <path d={area} fill="url(#fipe-area)" />
      <path
        d={linha}
        fill="none"
        stroke={brand.DEFAULT}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {pontos.map((p, i) => (
        <g key={p.mes}>
          <circle
            cx={x(i)}
            cy={y(p.preco)}
            r={4}
            fill={brand.DEFAULT}
            stroke="#fff"
            strokeWidth={2}
          >
            <title>{`${p.mes}: ${moeda(p.preco)}`}</title>
          </circle>
          {i % passo === 0 && (
            <text
              x={x(i)}
              y={H - 8}
              textAnchor="middle"
              className="fill-slate-400 text-[11px]"
            >
              {rotuloCurto(p.mes)}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
