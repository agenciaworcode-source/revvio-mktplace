// ============================================================
// Tipos do banco — camada estável de aliases.
//
// `database.generated.ts` é GERADO por `npm run types:gen`
// (não editar à mão). Este arquivo re-exporta o tipo `Database`
// e expõe aliases convenientes (Seller, Vehicle, …) usados pelo
// app, de modo que regenerar os tipos nunca apaga os aliases.
// ============================================================

export type { Database, Json } from "./database.generated";
export { Constants } from "./database.generated";

import type { Database } from "./database.generated";

type Tables = Database["public"]["Tables"];
type Enums = Database["public"]["Enums"];

/* ── Linhas de tabela ───────────────────────────────────── */
export type Seller = Tables["rv_sellers"]["Row"];
export type Vehicle = Tables["rv_vehicles"]["Row"] & {
  /** Soft-delete: preenchidos quando status = 'removed' (ainda não nos tipos gerados). */
  removal_reason: string | null;
  removed_at: string | null;
  removed_by: string | null;
};
export type VehicleOwner = Tables["rv_vehicle_owners"]["Row"];
export type Sale = Tables["rv_sales"]["Row"] & {
  /** Motivo da venda (ainda não nos tipos gerados). */
  sale_reason: string | null;
};
export type Commission = Tables["rv_commissions"]["Row"];
export type Charge = Tables["rv_charges"]["Row"];
export type PlanItem = Tables["rv_plan_items"]["Row"];
export type Buyer = Tables["rv_buyers"]["Row"];

/* ── Enums ──────────────────────────────────────────────── */
export type AppRole = Enums["app_role"];
export type SellerStatus = Enums["seller_status"];
export type VehicleStatus = Enums["vehicle_status"] | "removed";
export type VehicleBodyType = Enums["vehicle_body_type"];
export type CommissionStatus = Enums["commission_status"];
export type PaymentMethod = Enums["payment_method"];
export type PlanBillingType = Enums["plan_billing_type"];
export type FuelType = Enums["fuel_type"];
export type TransmissionType = Enums["transmission_type"];
