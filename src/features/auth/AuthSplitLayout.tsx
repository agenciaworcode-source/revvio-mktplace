import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Icon } from "@/features/public/components/icons";
import { BrandLogo } from "@/features/public/components/BrandLogo";

/** Estilos de campo compartilhados (mesmo visual do Login). */
export const authFieldWrap =
  "flex items-center gap-2.5 rounded-xl border border-[#e3e5e9] bg-[#fbfbfc] px-3.5 " +
  "focus-within:border-brand focus-within:ring-1 focus-within:ring-brand";
export const authFieldInput =
  "flex-1 border-none bg-transparent py-3 text-sm text-slate-900 outline-none placeholder:text-[#b0b7c0]";

const features = [
  { icon: "shield", label: "Procedência verificada" },
  { icon: "badge", label: "Abaixo da FIPE" },
  { icon: "whatsapp", label: "Contato direto" },
];

/**
 * Casca de duas colunas das páginas de autenticação: painel de marca escuro
 * à esquerda (fixo) e a coluna do formulário à direita (varia por página).
 */
export function AuthSplitLayout({
  title,
  subtitle,
  footer,
  children,
}: {
  title: string;
  subtitle?: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-2">
      {/* ── Painel esquerdo (marca + frase) ── */}
      <div
        className="relative hidden flex-col justify-between overflow-hidden p-12 text-white lg:flex"
        style={{
          background:
            "radial-gradient(ellipse 80% 80% at 25% 15%, rgba(16,185,129,.25), transparent 60%), #08090c",
        }}
      >
        {/* círculos decorativos */}
        <div className="pointer-events-none absolute -right-24 top-24 h-80 w-80 rounded-full border border-white/5" />
        <div className="pointer-events-none absolute -left-16 bottom-10 h-72 w-72 rounded-full border border-white/5" />

        <Link to="/" className="inline-block">
          <BrandLogo height={32} theme="light" />
        </Link>

        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/15 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-emerald-400">
            <Icon name="badge" size={14} /> Oportunidades verificadas
          </span>
          <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.1] tracking-tight">
            Veículos premium, <span className="text-brand">preço justo</span>.
          </h1>
          <p className="mt-3 max-w-md text-base text-slate-400">
            Catálogo verificado das melhores garagens parceiras — com procedência e
            contato direto.
          </p>

          <div className="mt-8 grid grid-cols-3 gap-3">
            {features.map((f) => (
              <div key={f.label} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <Icon name={f.icon} size={18} className="text-brand" />
                <p className="mt-2 text-[13px] font-medium text-slate-200">{f.label}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-slate-600">© 2026 REVVIO · Marketplace Multi-Vendedores</p>
      </div>

      {/* ── Painel direito (formulário) ── */}
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* logo no mobile */}
          <Link to="/" className="mb-8 inline-block lg:hidden">
            <BrandLogo height={26} theme="dark" />
          </Link>

          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}

          <div className="mt-7">{children}</div>

          {footer && <p className="mt-6 text-center text-sm text-slate-500">{footer}</p>}
        </div>
      </div>
    </div>
  );
}
