// ============================================================
// Escopo de contratos do garagista.
//
// Diferenças para o superadmin: emite só o contrato de compra e venda (a
// intermediação e a procuração são atos da Revvio, não da loja), enxerga
// apenas os próprios documentos e timbra a folha com a logo do perfil dele —
// caindo na marca Revvender quando a loja ainda não subiu uma.
// ============================================================

import { useMemo } from "react";
import { formatCurrency } from "@/lib/format";
import { useAuth } from "@/features/auth/AuthProvider";
import { useLeads } from "@/features/leads/queries";
import { INTERMEDIADORA } from "@/features/contracts/templates";
import {
  REVVENDER_LETTERHEAD,
  type AutofillSources,
  type ContractScope,
} from "@/features/contracts/scope";
import { useVehicles } from "./queries";

export function useSellerContractScope(): ContractScope {
  const { seller, lojaId } = useAuth();

  return useMemo(() => {
    // Sem logo própria o contrato sai com a marca da plataforma — melhor um
    // timbre genérico do que um documento com o cabeçalho vazio.
    const temLogo = !!seller?.avatar_url;
    return {
      basePath: "/painel/contratos",
      sellerId: lojaId,
      types: ["compra_venda"],
      letterhead: temLogo
        ? {
            markUrl: seller!.avatar_url!,
            name: seller?.name ?? "",
            cnpj: seller?.cpf_cnpj ?? "",
            address: [seller?.city, seller?.state].filter(Boolean).join("/"),
          }
        : {
            ...REVVENDER_LETTERHEAD,
            name: seller?.name || INTERMEDIADORA.name,
            cnpj: seller?.cpf_cnpj ?? "",
            address: [seller?.city, seller?.state].filter(Boolean).join("/"),
          },
      showSellerPicker: false,
      savedTemplate: seller?.contract_template ?? null,
      subtitle: "Contratos de compra e venda da sua loja",
    };
  }, [seller, lojaId]);
}

export function useSellerAutofill(): AutofillSources {
  const { seller, lojaId } = useAuth();
  const vehiclesQ = useVehicles(lojaId ?? undefined);
  const leadsQ = useLeads(lojaId ?? undefined);

  return useMemo(() => {
    // A loja é sempre a vendedora; a lista existe só para o autopreenchimento
    // por veículo encontrar o dono (o combo de loja não aparece neste escopo).
    const sellers = seller
      ? [
          {
            id: seller.id,
            name: seller.name,
            cpfCnpj: seller.cpf_cnpj ?? "",
            address: [seller.city, seller.state].filter(Boolean).join("/"),
            label: seller.name,
          },
        ]
      : [];
    return {
      vehicles: (vehiclesQ.data ?? []).map((v) => ({
        id: String(v.id),
        label: `${v.make} ${v.model}${v.year ? ` (${v.year})` : ""} — ${formatCurrency(v.price)}`,
        brandModel: `${v.make} ${v.model}`.trim(),
        yearModel: v.year ? String(v.year) : "",
        price: Number(v.price),
        sellerId: v.seller_id,
      })),
      leads: (leadsQ.data ?? []).map((l) => ({
        id: l.id,
        name: l.name,
        label: l.vehicle ? `${l.name} — ${l.vehicle.make} ${l.vehicle.model}` : l.name,
        city: l.city ?? "",
        vehicleId: l.vehicle_id != null ? String(l.vehicle_id) : null,
      })),
      sellers,
    };
  }, [seller, vehiclesQ.data, leadsQ.data]);
}
