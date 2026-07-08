import { useAuth } from "@/features/auth/AuthProvider";
import { PanelShell, type PanelNavItem } from "@/components/PanelShell";
import { useAffiliatesEnabled } from "./queries";
import { AFFILIATES_ENABLED } from "@/config/features";

export function PainelLayout() {
  const { seller, isGaragista, isAdmin } = useAuth();
  const manager = isGaragista || isAdmin;
  const { data: affiliatesOn } = useAffiliatesEnabled(seller?.pricing_plan_key);
  const showAffiliates =
    AFFILIATES_ENABLED && manager && (isAdmin || affiliatesOn === true);
  const nav: PanelNavItem[] = [
    { to: "/painel", label: "Dashboard", icon: "grid", end: true },
    ...(manager
      ? [{ to: "/painel/leads", label: "Leads", icon: "users" } as PanelNavItem]
      : []),
    { to: "/painel/veiculos", label: "Veículos", icon: "car" },
    ...(manager
      ? [{ to: "/painel/vendedores", label: "Vendedores", icon: "users" } as PanelNavItem]
      : []),
    ...(showAffiliates
      ? [{ to: "/painel/afiliados", label: "Afiliados", icon: "users" } as PanelNavItem]
      : []),
    { to: "/painel/vendas", label: "Vendas", icon: "dollar" },
    ...(manager
      ? [
          { to: "/painel/financeiro", label: "Financeiro", icon: "wallet" } as PanelNavItem,
          { to: "/painel/gerador-whatsapp", label: "Gerador WhatsApp", icon: "whatsapp" } as PanelNavItem,
          { to: "/painel/perfil", label: "Perfil / Mini-Loja", icon: "store" } as PanelNavItem,
        ]
      : []),
  ];
  return (
    <PanelShell nav={nav} badge={manager ? "Garagista" : seller ? "Vendedor" : "Painel"} />
  );
}
