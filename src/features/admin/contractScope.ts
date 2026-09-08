// ============================================================
// Escopo de contratos do superadmin.
//
// Emite os modelos do catálogo marcados para a Revvio, timbra com a marca
// Revvender e puxa o autopreenchimento do catálogo inteiro — veículos e lojas
// de todo mundo. Os modelos em si são mantidos por ele mesmo, na tela de
// Modelos de contrato.
// ============================================================

import { useMemo } from "react";
import { formatCurrency } from "@/lib/format";
import { useLeads } from "@/features/leads/queries";
import { INTERMEDIADORA } from "@/features/contracts/templates";
import {
  REVVENDER_LETTERHEAD,
  type AutofillSources,
  type ContractScope,
} from "@/features/contracts/scope";
import { useContractModels } from "@/features/contracts/models";
import { useAdminSellers, useAdminVehicles } from "./queries";

export function useAdminContractScope(): ContractScope {
  const modelsQ = useContractModels("admin");

  return useMemo(
    () => ({
      basePath: "/dashboard/contratos",
      sellerId: null,
      models: modelsQ.data ?? [],
      letterhead: {
        ...REVVENDER_LETTERHEAD,
        name: INTERMEDIADORA.name,
        cnpj: INTERMEDIADORA.cnpj,
        address: INTERMEDIADORA.address,
      },
      showSellerPicker: true,
      manageModelsPath: "/dashboard/contratos/modelos",
      subtitle: "Emissão digital de contratos e relatório contábil",
    }),
    [modelsQ.data]
  );
}

export function useAdminAutofill(): AutofillSources {
  const vehiclesQ = useAdminVehicles();
  const sellersQ = useAdminSellers();
  const leadsQ = useLeads();

  return useMemo(() => {
    // O admin (a própria Revvio) não é uma loja vendedora de contrato.
    const sellers = (sellersQ.data ?? []).filter((s) => s.role !== "admin");
    return {
      vehicles: (vehiclesQ.data ?? []).map((v) => ({
        id: String(v.id),
        label:
          `${v.make} ${v.model}${v.year ? ` (${v.year})` : ""} — ` +
          `${formatCurrency(v.price)}${v.seller?.name ? ` · ${v.seller.name}` : ""}`,
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
      sellers: sellers.map((s) => ({
        id: s.id,
        name: s.name,
        cpfCnpj: s.cpf_cnpj ?? "",
        address: [s.city, s.state].filter(Boolean).join("/"),
        label: `${s.name}${s.city ? ` · ${s.city}` : ""}`,
      })),
    };
  }, [vehiclesQ.data, sellersQ.data, leadsQ.data]);
}
