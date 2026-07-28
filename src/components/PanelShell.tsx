import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "@/features/auth/AuthProvider";
import { BrandLogo } from "@/features/public/components/BrandLogo";
import { Icon } from "@/features/public/components/icons";
import { NotificationsBell } from "@/features/notifications/NotificationsBell";
import { ContextSwitcher } from "@/features/auth/ContextSwitcher";
import { LG_QUERY, useMediaQuery } from "@/lib/useMediaQuery";
import { panel } from "@/theme/palette";

export type PanelNavItem = {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
};

const SIDEBAR_BG = `linear-gradient(180deg,${panel.top} 0%,${panel.bottom} 100%)`;

/**
 * Casca compartilhada dos painéis (Admin e Garagista): sidebar escura
 * em gradiente + área de conteúdo clara. Segue o padrão do protótipo.
 *
 * Até `lg` a sidebar sai do fluxo e vira um drawer aberto pelo hambúrguer
 * da barra superior — no mobile os 248px fixos comiam quase toda a tela.
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
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  // O sino assina canais realtime: montamos só uma instância por vez —
  // na sidebar no desktop, na barra superior no mobile.
  const isDesktop = useMediaQuery(LG_QUERY);
  // Garagista vê a própria mini-loja; demais (admin) vão ao marketplace.
  const ownStore = isGaragista && seller?.slug ? `/loja/${seller.slug}` : null;

  // Trocar de rota fecha o drawer (senão ele cobre a página recém-aberta).
  useEffect(() => setMenuOpen(false), [pathname]);

  // Com o drawer aberto: trava o scroll do body e permite fechar no Esc.
  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  async function handleSignOut() {
    await signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex min-h-screen bg-cloud font-sans">
      {/* BACKDROP (só no mobile, quando o drawer está aberto) */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* SIDEBAR — drawer até lg, coluna fixa a partir de lg */}
      <aside
        id="panel-sidebar"
        className={[
          "fixed inset-y-0 left-0 z-50 flex h-[100dvh] w-[268px] flex-shrink-0 flex-col",
          "overflow-y-auto overscroll-contain px-4 py-[22px]",
          // `visibility` acompanha o transform: fora da tela o drawer sai da
          // ordem de tabulação em vez de ficar focável escondido.
          "transition-[transform,visibility] duration-200 ease-out",
          menuOpen ? "visible translate-x-0" : "invisible -translate-x-full",
          "lg:visible lg:sticky lg:inset-y-auto lg:top-0 lg:z-auto lg:h-screen lg:w-[248px] lg:translate-x-0",
        ].join(" ")}
        style={{ background: SIDEBAR_BG }}
      >
        <div className="flex items-center justify-between gap-2 px-1.5 pb-1.5">
          <BrandLogo height={20} theme="light" />
          <div className="flex items-center gap-1.5">
            {isDesktop && <NotificationsBell />}
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="grid h-[34px] w-[34px] place-items-center rounded-[9px] bg-white/[0.06] text-slate-300 lg:hidden"
              aria-label="Fechar menu"
            >
              <Icon name="x" size={18} />
            </button>
          </div>
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
                    ? "bg-brand font-bold text-white shadow-[0_6px_16px_theme(colors.brand.DEFAULT/0.32)]"
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
      <div className="flex min-w-0 flex-1 flex-col">
        {/* TOPBAR MOBILE — abre o drawer */}
        <header
          className="sticky top-0 z-30 flex h-14 items-center gap-3 px-4 lg:hidden"
          style={{ background: panel.top }}
        >
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="-ml-1.5 grid h-10 w-10 place-items-center rounded-[10px] text-slate-200 hover:bg-white/10"
            aria-label="Abrir menu"
            aria-expanded={menuOpen}
            aria-controls="panel-sidebar"
          >
            <Icon name="menu" size={22} />
          </button>
          <BrandLogo height={26} theme="light" variant="mark" />
          <span className="ml-auto truncate rounded-md bg-brand/[0.14] px-2 py-[3px] text-[10px] font-extrabold uppercase tracking-[1.2px] text-brand">
            {badge}
          </span>
          {!isDesktop && <NotificationsBell align="right" />}
        </header>

        <main className="min-w-0 flex-1 px-4 pb-16 pt-6 sm:px-6 lg:px-10 lg:pt-[34px]">
          {topRight}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
