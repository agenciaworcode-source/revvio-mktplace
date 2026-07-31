import { useAuth } from "@/features/auth/AuthProvider";
import { useAcesso, podeAcessar } from "@/features/auth/acesso";
import { PanelShell, type PanelNavItem } from "@/components/PanelShell";
import { AFFILIATES_ENABLED } from "@/config/features";

export function PainelLayout() {
  const { seller, isGaragista, isAdmin } = useAuth();
  const manager = isGaragista || isAdmin;
  const { data: acesso } = useAcesso(!!seller);
  const mod = acesso?.modulos;

  // Um item aparece quando o plano libera o módulo E o papel tem permissão.
  // O admin não é limitado pelo plano (opera a plataforma, não uma assinatura).
  const temModulo = (m: keyof NonNullable<typeof mod>) => isAdmin || mod?.[m] === true;
  const pode = (p: Parameters<typeof podeAcessar>[1]) => podeAcessar(acesso, p);

  const nav: PanelNavItem[] = [
    { to: "/painel", label: "Dashboard", icon: "grid", end: true },
    ...(temModulo("leads") && pode("ver_leads")
      ? [{ to: "/painel/leads", label: "Leads", icon: "users" } as PanelNavItem]
      : []),
    { to: "/painel/veiculos", label: "Veículos", icon: "car" },
    ...(temModulo("equipe") && manager
      ? [{ to: "/painel/vendedores", label: "Vendedores", icon: "users" } as PanelNavItem]
      : []),
    ...(AFFILIATES_ENABLED && manager && temModulo("afiliados")
      ? [{ to: "/painel/afiliados", label: "Afiliados", icon: "users" } as PanelNavItem]
      : []),
    { to: "/painel/vendas", label: "Vendas", icon: "dollar" },
    ...(temModulo("financeiro") && pode("ver_financeiro")
      ? [{ to: "/painel/financeiro", label: "Financeiro", icon: "wallet" } as PanelNavItem]
      : []),
    ...(temModulo("whatsapp") && pode("gerador_whatsapp")
      ? [
          {
            to: "/painel/gerador-whatsapp",
            label: "Gerador WhatsApp",
            icon: "whatsapp",
          } as PanelNavItem,
        ]
      : []),
    ...(manager
      ? [
          {
            to: "/painel/perfil",
            label: "Configurações de Perfil",
            icon: "settings",
          } as PanelNavItem,
        ]
      : []),
  ];
  return (
    <PanelShell nav={nav} badge={manager ? "Lojista" : seller ? "Vendedor" : "Painel"} />
  );
}
