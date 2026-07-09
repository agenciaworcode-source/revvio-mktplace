import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { uploadMedia, removeMedia } from "@/lib/storage";
import { usePricingPlans, type PricingPlan } from "@/features/public/queries";
import type { VehicleWithOwner } from "@/features/seller/queries";
import { planColor } from "@/components/panel";
import {
  buildAffiliateMetrics,
  emptyMetrics,
  type AffiliateMetrics,
  type AggInput,
} from "@/features/affiliate/report";
import type {
  Charge,
  Commission,
  PlanBillingType,
  PlanItem,
  Sale,
  Seller,
  SellerStatus,
} from "@/lib/database.types";

// limite superior exclusivo p/ colunas timestamptz: soma 1 dia a um yyyy-mm-dd
function nextDay(isoDate: string): string {
  const d = new Date(isoDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

const MONTHS_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const PAID = new Set(["received", "confirmed", "paid", "received_in_cash"]);

/* ── Vendedores ─────────────────────────────────────────── */
export function useAdminSellers(): UseQueryResult<Seller[]> {
  return useQuery({
    queryKey: ["admin-sellers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rv_sellers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Seller[];
    },
  });
}

export function useAdminSeller(id?: string): UseQueryResult<Seller | null> {
  return useQuery({
    queryKey: ["admin-seller", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rv_sellers")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return (data as Seller | null) ?? null;
    },
  });
}

export function useSetSellerStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; status: SellerStatus }) => {
      const { error } = await supabase
        .from("rv_sellers")
        .update({ status: input.status })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["admin-sellers"] });
      qc.invalidateQueries({ queryKey: ["admin-seller", v.id] });
    },
  });
}

/** Exclui a mini-loja e todo o histórico (RPC atômica admin_delete_store). */
export function useDeleteStore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sellerId: string) => {
      const { error } = await supabase.rpc("admin_delete_store", {
        p_seller_id: sellerId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-sellers"] });
      qc.invalidateQueries({ queryKey: ["admin-vehicles"] });
      qc.invalidateQueries({ queryKey: ["admin-finance"] });
      qc.invalidateQueries({ queryKey: ["charges"] });
    },
  });
}

/** Campos cadastrais que o admin pode editar em qualquer pessoa. */
export type AdminSellerEdit = Partial<
  Pick<Seller, "name" | "phone" | "whatsapp" | "city" | "state" | "commission_rate" | "bio" | "instagram">
>;

export function useAdminUpdateSeller() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string } & AdminSellerEdit) => {
      const { id, ...fields } = input;
      const { error } = await supabase.from("rv_sellers").update(fields).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["admin-sellers"] });
      qc.invalidateQueries({ queryKey: ["admin-seller", v.id] });
      qc.invalidateQueries({ queryKey: ["admin-affiliate-report"] });
    },
  });
}

/** Exclui vendedor/afiliado individual (RPC admin_delete_seller).
 *  Bloqueada no servidor se a pessoa tiver vendas registradas. */
export function useAdminDeleteSeller() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sellerId: string) => {
      const { error } = await supabase.rpc("admin_delete_seller" as never, {
        p_seller_id: sellerId,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-sellers"] });
      qc.invalidateQueries({ queryKey: ["admin-affiliate-report"] });
    },
  });
}

export function useSetCommission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; rate: number }) => {
      const { error } = await supabase
        .from("rv_sellers")
        .update({ commission_rate: input.rate })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) =>
      qc.invalidateQueries({ queryKey: ["admin-seller", v.id] }),
  });
}

/* ── Comissões de venda (ciclo de vida) ─────────────────── */
export type SaleCommission = Commission & {
  sale: { buyer_name: string; sale_price: number; sale_date: string } | null;
};

export function useSellerCommissions(
  sellerId?: string
): UseQueryResult<SaleCommission[]> {
  return useQuery({
    queryKey: ["seller-commissions", sellerId],
    enabled: !!sellerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rv_commissions")
        .select("*, sale:rv_sales(buyer_name, sale_price, sale_date)")
        .eq("seller_id", sellerId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as SaleCommission[];
    },
  });
}

export function useSetCommissionPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; paid: boolean; sellerId: string }) => {
      const rpc = input.paid ? "mark_commission_paid" : "mark_commission_pending";
      const { error } = await supabase.rpc(rpc, { p_commission_id: input.id });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["seller-commissions", v.sellerId] });
      qc.invalidateQueries({ queryKey: ["commissions", v.sellerId] });
      qc.invalidateQueries({ queryKey: ["admin-finance"] });
    },
  });
}

/* ── Planos ─────────────────────────────────────────────── */
export type PlanWithItems = {
  id: string;
  seller_id: string;
  name: string;
  active: boolean;
  asaas_subscription_id: string | null;
  rv_plan_items: PlanItem[];
} | null;

export function usePlan(sellerId?: string): UseQueryResult<PlanWithItems> {
  return useQuery({
    queryKey: ["plan", sellerId],
    enabled: !!sellerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rv_plans")
        .select("id, seller_id, name, active, asaas_subscription_id, rv_plan_items(*)")
        .eq("seller_id", sellerId!)
        .maybeSingle();
      if (error) throw error;
      return (data as PlanWithItems) ?? null;
    },
  });
}

export type PlanItemInput = {
  label: string;
  value: number;
  billing_type: PlanBillingType;
};

export function useSavePlan(sellerId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; items: PlanItemInput[] }) => {
      if (!sellerId) throw new Error("Vendedor não definido.");
      // 1. upsert do plano (um por garagista)
      const { data: plan, error } = await supabase
        .from("rv_plans")
        .upsert({ seller_id: sellerId, name: input.name }, { onConflict: "seller_id" })
        .select("id")
        .single();
      if (error) throw error;
      const planId = (plan as { id: string }).id;

      // 2. substitui os itens
      const { error: delErr } = await supabase
        .from("rv_plan_items")
        .delete()
        .eq("plan_id", planId);
      if (delErr) throw delErr;

      if (input.items.length) {
        const { error: insErr } = await supabase
          .from("rv_plan_items")
          .insert(input.items.map((i) => ({ ...i, plan_id: planId })));
        if (insErr) throw insErr;
      }
      return planId;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plan", sellerId] }),
  });
}

/* ── ASAAS (Edge Functions) ─────────────────────────────── */
export function useAsaasAction(sellerId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (action: "activate-plan" | "cancel-plan") => {
      const { data, error } = await supabase.functions.invoke("asaas-billing", {
        body: { action, sellerId },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error)
        throw new Error((data as { error: string }).error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plan", sellerId] });
      qc.invalidateQueries({ queryKey: ["charges"] });
      qc.invalidateQueries({ queryKey: ["admin-seller", sellerId] });
    },
  });
}

/* ── Cobranças / financeiro ─────────────────────────────── */
export function useCharges(sellerId?: string): UseQueryResult<Charge[]> {
  return useQuery({
    queryKey: ["charges", sellerId ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("rv_charges")
        .select("*")
        .order("created_at", { ascending: false });
      if (sellerId) q = q.eq("seller_id", sellerId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Charge[];
    },
  });
}

export type AdminFinance = {
  sales: Pick<Sale, "seller_id" | "sale_price">[];
  commissions: Pick<Commission, "seller_id" | "amount" | "status">[];
};

export function useAdminFinance(): UseQueryResult<AdminFinance> {
  return useQuery({
    queryKey: ["admin-finance"],
    queryFn: async () => {
      const [sales, commissions] = await Promise.all([
        supabase.from("rv_sales").select("seller_id, sale_price"),
        supabase.from("rv_commissions").select("seller_id, amount, status"),
      ]);
      if (sales.error) throw sales.error;
      if (commissions.error) throw commissions.error;
      return {
        sales: (sales.data ?? []) as AdminFinance["sales"],
        commissions: (commissions.data ?? []) as AdminFinance["commissions"],
      };
    },
  });
}

/* ── Operação consolidada (vendas intermediadas) ────────── */
// Visão analítica do admin: volume intermediado na plataforma + comissões
// (ganho) dos garagistas por venda. NÃO é receita da plataforma (essa vem
// dos planos/ASAAS); é acompanhamento operacional do marketplace.
export type SalesBreakdownRow = {
  sellerId: string;
  name: string;
  salesCount: number;
  volume: number;
  commissionPending: number;
  commissionPaid: number;
};

export type SalesOps = {
  loading: boolean;
  gmv: number;
  salesCount: number;
  avgTicket: number;
  commissionPending: number;
  commissionPaid: number;
  rows: SalesBreakdownRow[];
};

export function useSalesOps(): SalesOps {
  const financeQ = useAdminFinance();
  const sellersQ = useAdminSellers();

  const finance = financeQ.data ?? { sales: [], commissions: [] };
  const sellers = sellersQ.data ?? [];
  const nameById = new Map(sellers.map((s) => [s.id, s.name]));

  const byId = new Map<string, SalesBreakdownRow>();
  const row = (id: string) => {
    let r = byId.get(id);
    if (!r) {
      r = {
        sellerId: id,
        name: nameById.get(id) ?? "—",
        salesCount: 0,
        volume: 0,
        commissionPending: 0,
        commissionPaid: 0,
      };
      byId.set(id, r);
    }
    return r;
  };

  for (const s of finance.sales) {
    const r = row(s.seller_id);
    r.salesCount += 1;
    r.volume += Number(s.sale_price);
  }
  for (const c of finance.commissions) {
    const r = row(c.seller_id);
    if (c.status === "paid") r.commissionPaid += Number(c.amount);
    else r.commissionPending += Number(c.amount); // pending + overdue
  }

  const rows = [...byId.values()].sort((a, b) => b.volume - a.volume);
  const gmv = rows.reduce((acc, r) => acc + r.volume, 0);
  const salesCount = rows.reduce((acc, r) => acc + r.salesCount, 0);
  const commissionPending = rows.reduce((acc, r) => acc + r.commissionPending, 0);
  const commissionPaid = rows.reduce((acc, r) => acc + r.commissionPaid, 0);

  return {
    loading: financeQ.isLoading || sellersQ.isLoading,
    gmv,
    salesCount,
    avgTicket: salesCount ? gmv / salesCount : 0,
    commissionPending,
    commissionPaid,
    rows,
  };
}

/* ── Veículos consolidados (admin) ──────────────────────── */
export type AdminVehicle = {
  id: number;
  make: string;
  model: string;
  year: number | null;
  price: number;
  fipe_price: number | null;
  images: string[];
  status: string;
  seller_id: string;
  clicks: number;
  blocked: boolean;
  seller: { name: string } | null;
};

export function useAdminVehicles(): UseQueryResult<AdminVehicle[]> {
  return useQuery({
    queryKey: ["admin-vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rv_vehicles")
        .select(
          "id, make, model, year, price, fipe_price, images, status, seller_id, clicks, blocked, seller:rv_sellers!rv_vehicles_seller_id_fkey(name)"
        )
        .neq("status", "removed" as never)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AdminVehicle[];
    },
  });
}

/** Veículo completo (+ proprietário) para o admin editar pelo VehicleForm. */
export function useAdminVehicleForEdit(id?: number): UseQueryResult<VehicleWithOwner | null> {
  return useQuery({
    queryKey: ["admin-vehicle-edit", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rv_vehicles")
        .select("*, owner:rv_vehicle_owners(owner_name, owner_phone)")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return (data as VehicleWithOwner | null) ?? null;
    },
  });
}

export function useAdminSetVehicleBlocked() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, blocked }: { id: number; blocked: boolean }) => {
      const { error } = await supabase.from("rv_vehicles").update({ blocked }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-vehicles"] }),
  });
}

export function useAdminDeleteVehicle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      const { error } = await supabase
        .from("rv_vehicles")
        .update({
          status: "removed",
          removal_reason: reason,
          removed_at: new Date().toISOString(),
        } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-vehicles"] }),
  });
}

/* ── Planos de assinatura (CRUD admin) ──────────────────── */
export type AdminPricingPlan = PricingPlan & { active: boolean; affiliates_enabled: boolean };

export function useAdminPricingPlans(): UseQueryResult<AdminPricingPlan[]> {
  return useQuery({
    queryKey: ["admin-pricing-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rv_pricing_plans")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as AdminPricingPlan[];
    },
  });
}

export type PricingPlanInput = {
  key: string;
  name: string;
  tagline: string | null;
  price_monthly: number;
  price_annual: number;
  color: string;
  popular: boolean;
  cta_label: string;
  highlights: string[];
  vehicle_limit: number | null;
  trial_days: number;
  sort_order: number;
  active: boolean;
  affiliates_enabled: boolean;
};

export function useSavePricingPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...fields }: { id?: string } & PricingPlanInput) => {
      const res = id
        ? await supabase.from("rv_pricing_plans").update(fields).eq("id", id)
        : await supabase.from("rv_pricing_plans").insert(fields);
      if (res.error) throw res.error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-pricing-plans"] });
      qc.invalidateQueries({ queryKey: ["pricing-plans"] });
    },
  });
}

export function useDeletePricingPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rv_pricing_plans").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-pricing-plans"] });
      qc.invalidateQueries({ queryKey: ["pricing-plans"] });
    },
  });
}

/* ── Agregados reais p/ Visão Geral / Financeiro ────────── */
export type AdminOverview = {
  loading: boolean;
  sellers: Seller[]; // apenas role = garagista
  stores: Seller[]; // vitrines públicas: garagista + a loja do próprio admin
  plans: PricingPlan[];
  plansByKey: Map<string, PricingPlan>;
  vehicleCounts: Map<string, number>;
  distribution: { name: string; count: number; price: number; color: string }[];
  mrr: number;
  accumulated: number | null;
  activeSubs: number;
  miniLojas: number;
  vehicleTotal: number;
  mrrSeries: { label: string; value: number }[];
};

export function useAdminOverview(): AdminOverview {
  const sellersQ = useAdminSellers();
  const plansQ = usePricingPlans();
  const vehiclesQ = useAdminVehicles();
  const chargesQ = useCharges();

  const allSellers = sellersQ.data ?? [];
  const sellers = allSellers.filter((s) => s.role === "garagista");
  // O admin também tem mini-loja pública; entra na gestão de lojas (mas não na
  // lista de assinantes/garagistas nem nos cálculos de MRR).
  const stores = allSellers.filter((s) => s.role === "garagista" || s.role === "admin");
  const activeSellers = sellers.filter((s) => s.status === "active");
  const plans = plansQ.data ?? [];
  const vehicles = vehiclesQ.data ?? [];
  const charges = chargesQ.data ?? [];

  const plansByKey = new Map(plans.map((p) => [p.key, p]));

  const vehicleCounts = new Map<string, number>();
  for (const v of vehicles)
    vehicleCounts.set(v.seller_id, (vehicleCounts.get(v.seller_id) ?? 0) + 1);

  const mrr = activeSellers.reduce((acc, s) => {
    const p = s.pricing_plan_key ? plansByKey.get(s.pricing_plan_key) : undefined;
    return acc + (p ? Number(p.price_monthly) : 0);
  }, 0);

  const distribution = plans.map((p) => ({
    name: p.name,
    color: planColor(p.name),
    price: Number(p.price_monthly),
    count: activeSellers.filter((s) => s.pricing_plan_key === p.key).length,
  }));

  // Receita acumulada = soma dos valores de cobranças pagas (null se não houver)
  const paidCharges = charges.filter((c) => PAID.has((c.status ?? "").toLowerCase()));
  const accumulated = paidCharges.length
    ? paidCharges.reduce((acc, c) => acc + Number(c.value), 0)
    : null;

  // Série dos últimos 8 meses (cobranças pagas por mês)
  const now = new Date();
  const mrrSeries: { label: string; value: number }[] = [];
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const sum = paidCharges
      .filter((c) => {
        const cd = new Date(c.due_date ?? c.created_at);
        return cd.getFullYear() === d.getFullYear() && cd.getMonth() === d.getMonth();
      })
      .reduce((acc, c) => acc + Number(c.value), 0);
    mrrSeries.push({ label: MONTHS_PT[d.getMonth()], value: sum });
  }

  return {
    loading: sellersQ.isLoading || plansQ.isLoading || vehiclesQ.isLoading,
    sellers,
    stores,
    plans,
    plansByKey,
    vehicleCounts,
    distribution,
    mrr,
    accumulated,
    activeSubs: activeSellers.length,
    miniLojas: activeSellers.length,
    vehicleTotal: vehicles.length,
    mrrSeries,
  };
}

export function useVehicleCount(): UseQueryResult<number> {
  return useQuery({
    queryKey: ["admin-vehicle-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("rv_vehicles")
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });
}

/* ── Aparência: banner da home (rv_site_settings) ───────────── */

/** URL atual do banner da home (config global, id=1). */
export function useHomeBanner(): UseQueryResult<string | null> {
  return useQuery({
    queryKey: ["admin-home-banner"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rv_site_settings")
        .select("home_banner_url")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return (data?.home_banner_url ?? null) as string | null;
    },
  });
}

/**
 * Sobe uma nova imagem de banner ao bucket `banners` (pasta `home/`, permitida
 * ao admin pela policy), grava a URL em rv_site_settings e remove a anterior.
 */
export function useUpdateHomeBanner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const { data: prev } = await supabase
        .from("rv_site_settings")
        .select("home_banner_url")
        .eq("id", 1)
        .maybeSingle();
      const previousUrl = (prev?.home_banner_url ?? null) as string | null;

      const url = await uploadMedia("banners", "home", file);
      const { error } = await supabase
        .from("rv_site_settings")
        .update({ home_banner_url: url })
        .eq("id", 1);
      if (error) throw error;

      if (previousUrl) {
        await removeMedia("banners", previousUrl).catch(() => {});
      }
      return url;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-home-banner"] });
      qc.invalidateQueries({ queryKey: ["site-settings"] });
    },
  });
}

/* ── Movimentações: motivos de venda e remoção (admin) ──── */
export type ReasonFilters = {
  sellerId?: string;
  reason?: string;
  from?: string; // ISO date (yyyy-mm-dd), inclusivo
  to?: string;   // ISO date (yyyy-mm-dd), inclusivo
  affiliateId?: string;
};

export type AdminSaleRow = {
  id: string;
  sale_date: string;
  buyer_name: string;
  sale_price: number;
  payment_method: string;
  sale_reason: string | null;
  seller_name: string;
  vehicle_label: string;
};

export type AdminRemovalRow = {
  id: number;
  removed_at: string | null;
  removal_reason: string | null;
  price: number;
  seller_name: string;
  vehicle_label: string;
};

function vehicleLabel(v: { make?: string; model?: string; year?: number | null } | null): string {
  if (!v || (!v.make && !v.model)) return "Veículo removido";
  return [v.make, v.model, v.year].filter(Boolean).join(" ");
}

export function useAdminSales(filters: ReasonFilters = {}): UseQueryResult<AdminSaleRow[]> {
  const { sellerId, reason, from, to, affiliateId } = filters;
  return useQuery({
    queryKey: ["admin-sales", sellerId ?? null, reason ?? null, from ?? null, to ?? null, affiliateId ?? null],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let q = supabase
        .from("rv_sales")
        .select(
          "id, sale_date, buyer_name, sale_price, payment_method, sale_reason, seller:rv_sellers!rv_sales_seller_id_fkey(name), vehicle:rv_vehicles(make, model, year)"
        )
        .order("sale_date", { ascending: false });
      if (sellerId) q = q.eq("seller_id", sellerId);
      if (reason) q = q.eq("sale_reason", reason);
      if (from) q = q.gte("sale_date", from);
      if (to) q = q.lte("sale_date", to);
      if (affiliateId) q = q.eq("affiliate_id", affiliateId);
      const { data, error } = await q;
      if (error) throw error;
      type Raw = {
        id: string; sale_date: string; buyer_name: string; sale_price: number;
        payment_method: string; sale_reason: string | null;
        seller: { name: string } | null;
        vehicle: { make: string; model: string; year: number | null } | null;
      };
      return ((data ?? []) as unknown as Raw[]).map((r) => ({
        id: r.id,
        sale_date: r.sale_date,
        buyer_name: r.buyer_name,
        sale_price: Number(r.sale_price),
        payment_method: r.payment_method,
        sale_reason: r.sale_reason,
        seller_name: r.seller?.name ?? "—",
        vehicle_label: vehicleLabel(r.vehicle),
      }));
    },
  });
}

export function useAdminRemovals(filters: ReasonFilters = {}): UseQueryResult<AdminRemovalRow[]> {
  const { sellerId, reason, from, to } = filters;
  return useQuery({
    queryKey: ["admin-removals", sellerId ?? null, reason ?? null, from ?? null, to ?? null],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let q = supabase
        .from("rv_vehicles")
        .select(
          "id, make, model, year, price, removal_reason, removed_at, seller:rv_sellers!rv_vehicles_seller_id_fkey(name)"
        )
        .eq("status", "removed" as never)
        .order("removed_at", { ascending: false });
      if (sellerId) q = q.eq("seller_id", sellerId);
      if (reason) q = q.eq("removal_reason", reason);
      // removed_at é timestamptz; ancora os limites no fuso BRT (-03:00) para
      // não cortar/incluir remoções na virada do dia local.
      if (from) q = q.gte("removed_at", `${from}T00:00:00-03:00`);
      if (to) q = q.lte("removed_at", `${to}T23:59:59.999-03:00`);
      const { data, error } = await q;
      if (error) throw error;
      type Raw = {
        id: number; make: string; model: string; year: number | null; price: number;
        removal_reason: string | null; removed_at: string | null;
        seller: { name: string } | null;
      };
      return ((data ?? []) as unknown as Raw[]).map((r) => ({
        id: r.id,
        removed_at: r.removed_at,
        removal_reason: r.removal_reason,
        price: Number(r.price),
        seller_name: r.seller?.name ?? "—",
        vehicle_label: vehicleLabel({ make: r.make, model: r.model, year: r.year }),
      }));
    },
  });
}

/* ── Relatório global de afiliados (admin) ──────────────── */
export type AdminAffiliateFilters = {
  garagistaId?: string;
  affiliateId?: string;
  from?: string;
  to?: string;
};

export type AdminAffiliateRow = AffiliateMetrics & {
  affiliateId: string;
  name: string;
  status: string;
  rate: number;
  garagistaId: string;
  garagistaName: string;
};

export type AdminAffiliateReport = {
  rows: AdminAffiliateRow[];
  kpis: {
    totalSalesCount: number;
    totalSalesVolume: number;
    activeAffiliates: number;
    commissionPending: number;
  };
  topByVolume: AdminAffiliateRow[]; // top 5
  topByCount: AdminAffiliateRow[];  // top 5
  topGaragistas: { garagistaId: string; garagistaName: string; salesCount: number; salesVolume: number }[]; // top 5
};

/** Relatório global de afiliados (admin: is_admin lê tudo). */
export function useAdminAffiliateReport(
  filters: AdminAffiliateFilters = {}
): UseQueryResult<AdminAffiliateReport> {
  const { garagistaId, affiliateId, from, to } = filters;
  return useQuery({
    queryKey: ["admin-affiliate-report", garagistaId ?? null, affiliateId ?? null, from ?? null, to ?? null],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let salesQ = supabase.from("rv_sales").select("affiliate_id, sale_price, seller_id").not("affiliate_id", "is", null);
      let commsQ = supabase.from("rv_commissions").select("affiliate_id, amount, status").not("affiliate_id", "is", null);
      let clicksQ = supabase.from("rv_click_events").select("affiliate_id, kind").in("kind", ["affiliate_share", "affiliate_link_visit"]);
      let affQ = supabase.from("rv_sellers").select("id, name, status, commission_rate, parent_id").eq("role", "afiliado");

      if (garagistaId) {
        salesQ = salesQ.eq("seller_id", garagistaId);
        clicksQ = clicksQ.eq("seller_id", garagistaId);
        affQ = affQ.eq("parent_id", garagistaId);
      }
      if (affiliateId) {
        salesQ = salesQ.eq("affiliate_id", affiliateId);
        commsQ = commsQ.eq("affiliate_id", affiliateId);
        clicksQ = clicksQ.eq("affiliate_id", affiliateId);
      }
      if (from) { salesQ = salesQ.gte("sale_date", from); commsQ = commsQ.gte("created_at", from); clicksQ = clicksQ.gte("created_at", from); }
      if (to) { salesQ = salesQ.lte("sale_date", to); commsQ = commsQ.lt("created_at", nextDay(to)); clicksQ = clicksQ.lt("created_at", nextDay(to)); }

      // nomes de garagistas (lojas): role garagista/admin
      const garQ = supabase.from("rv_sellers").select("id, name").in("role", ["garagista", "admin"]);

      const [sales, comms, clicks, affs, gars] = await Promise.all([salesQ, commsQ, clicksQ, affQ, garQ]);
      for (const r of [sales, comms, clicks, affs, gars]) if (r.error) throw r.error;

      const metrics = buildAffiliateMetrics({
        sales: (sales.data ?? []) as AggInput["sales"],
        commissions: (comms.data ?? []) as AggInput["commissions"],
        clicks: (clicks.data ?? []) as AggInput["clicks"],
      });
      const garName = new Map<string, string>();
      for (const g of (gars.data ?? []) as { id: string; name: string }[]) garName.set(g.id, g.name);

      type AffRaw = { id: string; name: string; status: string; commission_rate: number; parent_id: string | null };
      let rows: AdminAffiliateRow[] = ((affs.data ?? []) as AffRaw[]).map((a) => ({
        affiliateId: a.id,
        name: a.name,
        status: a.status,
        rate: Number(a.commission_rate),
        garagistaId: a.parent_id ?? "",
        garagistaName: a.parent_id ? garName.get(a.parent_id) ?? "—" : "—",
        ...(metrics.get(a.id) ?? emptyMetrics()),
      }));
      if (affiliateId) rows = rows.filter((r) => r.affiliateId === affiliateId);
      rows.sort((x, y) => y.salesVolume - x.salesVolume);

      const kpis = {
        totalSalesCount: rows.reduce((a, r) => a + r.salesCount, 0),
        totalSalesVolume: rows.reduce((a, r) => a + r.salesVolume, 0),
        activeAffiliates: rows.filter((r) => r.status === "active").length,
        commissionPending: rows.reduce((a, r) => a + r.commissionPending, 0),
      };
      const topByVolume = [...rows].sort((a, b) => b.salesVolume - a.salesVolume).slice(0, 5);
      const topByCount = [...rows].sort((a, b) => b.salesCount - a.salesCount).slice(0, 5);
      const garAgg = new Map<string, { garagistaId: string; garagistaName: string; salesCount: number; salesVolume: number }>();
      for (const r of rows) {
        if (!r.garagistaId) continue;
        let g = garAgg.get(r.garagistaId);
        if (!g) { g = { garagistaId: r.garagistaId, garagistaName: r.garagistaName, salesCount: 0, salesVolume: 0 }; garAgg.set(r.garagistaId, g); }
        g.salesCount += r.salesCount;
        g.salesVolume += r.salesVolume;
      }
      const topGaragistas = [...garAgg.values()].sort((a, b) => b.salesVolume - a.salesVolume).slice(0, 5);

      return { rows, kpis, topByVolume, topByCount, topGaragistas };
    },
  });
}
