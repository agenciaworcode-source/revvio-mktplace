import { NavLink, Outlet, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "@/features/auth/AuthProvider";
import { BrandLogo } from "@/features/public/components/BrandLogo";
import { Icon } from "@/features/public/components/icons";
import { NotificationsBell } from "@/features/notifications/NotificationsBell";
import { ContextSwitcher } from "@/features/auth/ContextSwitcher";

export type PanelNavItem = {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
};

/**
 * Casca compartilhada dos painéis (Admin e Garagista): sidebar escura
 * em gradiente + área de conteúdo clara. Segue o padrão do protótipo.
 */
export function PanelShell({
  nav,
  badge,
  topRight,
}: {
  nav: PanelNavItem[];
  badge: string;
  /** Conteúdo opcional ao lado do logo (ex.: link da mini-loja). */
  topRight?: ReactNode;
}) {
  const { signOut, seller, isGaragista } = useAuth();
  const navigate = useNavigate();
  // Garagista vê a própria mini-loja; demais (admin) vão ao marketplace.
  const ownStore = isGaragista && seller?.slug ? `/loja/${seller.slug}` : null;

  async function handleSignOut() {
    await signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex min-h-screen bg-cloud font-sans">
      {/* SIDEBAR */}
      <aside
        className="sticky top-0 flex h-screen w-[248px] flex-shrink-0 flex-col px-4 py-[22px]"
        style={{ background: "linear-gradient(180deg,#0c1322 0%,#070b14 100%)" }}
      >
        <div className="flex items-center justify-between px-1.5 pb-1.5">
          <BrandLogo height={24} theme="light" />
          <NotificationsBell />
        </div>

        <ContextSwitcher />

        <span className="my-[18px] mt-1 self-start rounded-md bg-brand/[0.12] px-2 py-[3px] text-[10px] font-extrabold uppercase tracking-[1.5px] text-brand">
          {badge}
        </span>

        <div className="px-2 pb-2.5 text-[11px] font-bold uppercase tracking-[1px] text-slate-600">
          Menu
        </div>
        <nav className="flex flex-col gap-1">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                [
                  "flex items-center gap-3 rounded-[11px] px-3.5 py-[11px] text-sm transition-all",
                  isActive
                    ? "bg-brand font-bold text-white shadow-[0_6px_16px_rgba(16,185,129,.32)]"
                    : "font-semibold text-slate-400 hover:bg-white/5 hover:text-slate-200",
                ].join(" ")
              }
            >
              <Icon name={n.icon} size={19} /> {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-1 border-t border-white/[0.07] pt-4">
          <NavLink
            to={ownStore ?? "/"}
            className="flex items-center gap-3 rounded-[11px] px-3.5 py-[11px] text-sm font-semibold text-slate-400 hover:bg-white/5 hover:text-slate-200"
          >
            <Icon name="eye" size={19} /> {ownStore ? "Ver minha loja" : "Ver Marketplace"}
          </NavLink>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 rounded-[11px] px-3.5 py-[11px] text-left text-sm font-semibold text-red-400 hover:bg-white/5"
          >
            <Icon name="logout" size={19} /> Sair
          </button>
        </div>
      </aside>

      {/* CONTENT */}
      <main className="min-w-0 flex-1 px-10 pb-16 pt-[34px]">
        {topRight}
        <Outlet />
      </main>
    </div>
  );
}
