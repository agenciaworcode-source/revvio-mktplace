import { PanelShell, type PanelNavItem } from "@/components/PanelShell";

export function AffiliateLayout() {
  const nav: PanelNavItem[] = [
    { to: "/afiliado", label: "Carros", icon: "car", end: true },
    { to: "/afiliado/desempenho", label: "Desempenho", icon: "grid" },
    { to: "/afiliado/perfil", label: "Meu perfil", icon: "store" },
  ];
  return <PanelShell nav={nav} badge="Afiliado" />;
}
