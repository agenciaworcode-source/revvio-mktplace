import { PanelShell, type PanelNavItem } from "@/components/PanelShell";

const ADMIN_NAV: PanelNavItem[] = [
  { to: "/dashboard", label: "Visão Geral", icon: "grid", end: true },
  { to: "/dashboard/sellers", label: "Assinantes", icon: "users" },
  { to: "/dashboard/leads", label: "Anúncios", icon: "eye" },
  { to: "/dashboard/financial", label: "Financeiro", icon: "wallet" },
  { to: "/dashboard/planos", label: "Planos", icon: "layers" },
  { to: "/dashboard/veiculos", label: "Veículos", icon: "car" },
  { to: "/dashboard/movimentacoes", label: "Movimentações", icon: "clock" },
  { to: "/dashboard/afiliados", label: "Afiliados", icon: "users" },
  { to: "/dashboard/mini-lojas", label: "Mini-Lojas", icon: "store" },
  { to: "/dashboard/aparencia", label: "Aparência", icon: "camera" },
];

export function AdminLayout() {
  return <PanelShell nav={ADMIN_NAV} badge="Super Admin" />;
}
