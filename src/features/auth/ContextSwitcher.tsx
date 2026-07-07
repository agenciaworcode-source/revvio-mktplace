import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthProvider";
import { Icon } from "@/features/public/components/icons";

/**
 * Seletor "Plataforma ↔ Minha loja" do gestor (admin). Aparece igual nos dois
 * painéis (Admin e Garagista) e alterna entre /dashboard e /painel sem relogin.
 * Para quem não é admin não renderiza nada (não muda a UI do painel).
 */
export function ContextSwitcher() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  if (!isAdmin) return null;

  const onLoja = pathname.startsWith("/painel");
  const items = [
    { label: "Plataforma", icon: "shield", to: "/dashboard", active: !onLoja },
    { label: "Minha loja", icon: "store", to: "/painel", active: onLoja },
  ];

  return (
    <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-white/[0.06] p-1">
      {items.map((it) => (
        <button
          key={it.to}
          type="button"
          onClick={() => navigate(it.to)}
          aria-pressed={it.active}
          className={[
            "flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[11px] font-bold transition-all",
            it.active
              ? "bg-brand text-white shadow-[0_4px_12px_rgba(16,185,129,.3)]"
              : "text-slate-400 hover:bg-white/5 hover:text-slate-200",
          ].join(" ")}
        >
          <Icon name={it.icon} size={15} /> {it.label}
        </button>
      ))}
    </div>
  );
}
