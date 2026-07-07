import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { AggInput, AffiliateMetrics } from "@/features/affiliate/report";
import { buildAffiliateMetrics, emptyMetrics } from "@/features/affiliate/report";
import type {
  Charge,
  Commission,
  FuelType,
  PaymentMethod,
  Sale,
  Seller,
  TransmissionType,
  Vehicle,
  VehicleBodyType,
  VehicleOwner,
} from "@/lib/database.types";

// limite superior exclusivo p/ colunas timestamptz: soma 1 dia a um yyyy-mm-dd
function nextDay(isoDate: string): string {
  const d = new Date(isoDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export type VehicleWithOwner = Vehicle & {
  owner: Pick<VehicleOwner, "owner_name" | "owner_phone"> | null;
  /** Cliques no botão "Quero ver o carro" (não está no tipo gerado do banco). */
  clicks: number;
};

export type SaleWithVehicle = Sale & {
  vehicle: Pick<Vehicle, "make" | "model" | "year"> | null;
};

/* ── Queries ────────────────────────────────────────────── */
export function useVehicles(sellerId?: string): UseQueryResult<VehicleWithOwner[]> {
  return useQuery({
    queryKey: ["vehicles", sellerId],
    enabled: !!sellerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rv_vehicles")
        .select("*, owner:rv_vehicle_owners(owner_name, owner_phone)")
        .eq("seller_id", sellerId!)
        .neq("status", "removed" as never)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as VehicleWithOwner[];
    },
  });
}

/** Faturas da assinatura do garagista no ASAAS (rv_charges da loja). */
export function useMyCharges(lojaId?: string): UseQueryResult<Charge[]> {
  return useQuery({
    queryKey: ["my-charges", lojaId],
    enabled: !!lojaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rv_charges")
        .select("*")
        .eq("seller_id", lojaId!)
        .order("due_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Charge[];
    },
  });
}

export function useSales(sellerId?: string): UseQueryResult<SaleWithVehicle[]> {
  return useQuery({
    queryKey: ["sales", sellerId],
    enabled: !!sellerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rv_sales")
        .select("*, vehicle:rv_vehicles(make, model, year)")
        .eq("seller_id", sellerId!)
        .order("sale_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SaleWithVehicle[];
    },
  });
}

export function useCommissions(sellerId?: string): UseQueryResult<Commission[]> {
  return useQuery({
    queryKey: ["commissions", sellerId],
    enabled: !!sellerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rv_commissions")
        .select("*")
        .eq("seller_id", sellerId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Commission[];
    },
  });
}

/* ── Mutations ──────────────────────────────────────────── */
export type VehicleInput = {
  id?: number;
  make: string;
  model: string;
  year: number | null;
  price: number;
  fipe_price: number | null;
  mileage: number | null;
  color: string | null;
  fuel: FuelType | null;
  transmission: TransmissionType | null;
  body_type: VehicleBodyType | null;
  armored: boolean;
  featured: boolean;
  options: string[];
  description: string | null;
  status: Vehicle["status"];
  vendedor_id: string;
  origem: string | null;
  primeiro_dono: boolean | null;
  documentacao: string | null;
  ipva: string | null;
  garantia: string | null;
  leilao: boolean | null;
  owner_name: string | null;
  owner_phone: string | null;
  images: string[];
};

export function useSaveVehicle(sellerId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: VehicleInput) => {
      // owner vai para a tabela privada rv_vehicle_owners
      const { id, owner_name, owner_phone, ...fields } = input;
      let vehicleId = id;

      if (id) {
        const { error } = await supabase
          .from("rv_vehicles")
          .update(fields)
          .eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("rv_vehicles")
          .insert({ ...fields, seller_id: sellerId })
          .select("id")
          .single();
        if (error) throw error;
        vehicleId = (data as { id: number }).id;
      }

      if (vehicleId != null) {
        const { error: ownerErr } = await supabase
          .from("rv_vehicle_owners")
          .upsert(
            { vehicle_id: vehicleId, owner_name, owner_phone },
            { onConflict: "vehicle_id" }
          );
        if (ownerErr) throw ownerErr;
      }
      return vehicleId!;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vehicles", sellerId] }),
  });
}

export function useDeleteVehicle(sellerId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      reason,
      personId,
    }: {
      id: number;
      reason: string;
      personId: string | null;
    }) => {
      const { error } = await supabase
        .from("rv_vehicles")
        .update({
          status: "removed",
          removal_reason: reason,
          removed_at: new Date().toISOString(),
          removed_by: personId,
        } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vehicles", sellerId] }),
  });
}

export type RegisterSaleInput = {
  vehicle_id: number;
  vendedor_id: string | null;
  affiliate_id?: string | null;
  buyer_name: string;
  buyer_phone: string | null;
  sale_price: number;
  payment_method: PaymentMethod;
  sale_date: string;
  sale_reason: string;
};

export function useRegisterSale(sellerId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: RegisterSaleInput) => {
      const { data, error } = await supabase.rpc("register_sale", {
        p_vehicle_id: input.vehicle_id,
        p_vendedor_id: input.vendedor_id,
        p_affiliate_id: input.affiliate_id ?? null,
        p_buyer_name: input.buyer_name,
        p_sale_price: input.sale_price,
        p_payment_method: input.payment_method,
        p_buyer_phone: input.buyer_phone ?? undefined,
        p_sale_date: input.sale_date,
        p_sale_reason: input.sale_reason,
      } as never);
      if (error) throw error;
      return data as string; // sale id
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales", sellerId] });
      qc.invalidateQueries({ queryKey: ["vehicles", sellerId] });
      qc.invalidateQueries({ queryKey: ["commissions", sellerId] });
    },
  });
}

/** Exclui uma venda (RPC delete_sale): apaga a comissão, devolve o veículo
 *  a 'available'. Bloqueada no servidor se a comissão já foi paga. */
export function useDeleteSale(sellerId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (saleId: string) => {
      const { error } = await supabase.rpc("delete_sale" as never, {
        p_sale_id: saleId,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales", sellerId] });
      qc.invalidateQueries({ queryKey: ["vehicles", sellerId] });
      qc.invalidateQueries({ queryKey: ["commissions", sellerId] });
      qc.invalidateQueries({ queryKey: ["loja-commissions", sellerId] });
    },
  });
}

export type ProfileInput = Partial<
  Pick<
    Seller,
    | "name"
    | "bio"
    | "city"
    | "state"
    | "phone"
    | "whatsapp"
    | "instagram"
    | "avatar_url"
    | "banner_url"
  >
>;

export function useUpdateProfile(seller?: Seller | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ProfileInput) => {
      if (!seller) throw new Error("Vendedor não carregado.");
      const { error } = await supabase
        .from("rv_sellers")
        .update(input)
        .eq("id", seller.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["seller"] }),
  });
}

/* Pessoas atribuíveis a um veículo: o garagista (dono) + os vendedores da
   loja. Usado no select "Vendedor responsável" (funciona p/ garagista e admin). */
export function useLojaSellers(lojaId?: string): UseQueryResult<Seller[]> {
  return useQuery({
    queryKey: ["loja-sellers", lojaId],
    enabled: !!lojaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rv_sellers")
        .select("*")
        // inclui 'admin' p/ o dono da plataforma que atua como loja (Minha loja)
        .or(`id.eq.${lojaId},parent_id.eq.${lojaId}`)
        .in("role", ["garagista", "vendedor", "admin"])
        .order("role", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Seller[];
    },
  });
}

/* ── Equipe (vendedores da loja) ────────────────────────── */
export function useTeam(lojaId?: string): UseQueryResult<Seller[]> {
  return useQuery({
    queryKey: ["team", lojaId],
    enabled: !!lojaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rv_sellers")
        .select("*")
        .eq("parent_id", lojaId!)
        .eq("role", "vendedor")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Seller[];
    },
  });
}

export function useInviteVendedor(lojaId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; email: string; commission_rate: number }) => {
      const { data, error } = await supabase.functions.invoke("invite-vendedor", {
        body: input,
      });
      if (error) {
        // supabase-js esconde o corpo da resposta em error.context quando a
        // function devolve um status não-2xx — lemos o JSON p/ a msg amigável.
        const ctx = (error as { context?: Response }).context;
        if (ctx && typeof ctx.json === "function") {
          const body = await ctx.json().catch(() => null);
          if (body?.error) throw new Error(body.error);
        }
        throw error;
      }
      if ((data as { error?: string })?.error)
        throw new Error((data as { error: string }).error);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team", lojaId] }),
  });
}

export function useSetVendedorRate(lojaId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; rate: number }) => {
      const { error } = await supabase
        .from("rv_sellers")
        .update({ commission_rate: input.rate })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team", lojaId] }),
  });
}

export function useSetVendedorStatus(lojaId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; status: "active" | "suspended" }) => {
      const { error } = await supabase
        .from("rv_sellers")
        .update({ status: input.status })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team", lojaId] }),
  });
}

/* ── Comissões da loja (visão do garagista) ─────────────── */
export type LojaCommission = Commission & {
  vendedor: { name: string } | null;
};

export function useLojaCommissions(lojaId?: string): UseQueryResult<LojaCommission[]> {
  return useQuery({
    queryKey: ["loja-commissions", lojaId],
    enabled: !!lojaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rv_commissions")
        .select("*, vendedor:rv_sellers!rv_commissions_vendedor_id_fkey(name)")
        .eq("seller_id", lojaId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as LojaCommission[];
    },
  });
}

export function useMarkCommission(lojaId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; paid: boolean }) => {
      const rpc = input.paid ? "mark_commission_paid" : "mark_commission_pending";
      const { error } = await supabase.rpc(rpc, { p_commission_id: input.id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["loja-commissions", lojaId] });
      qc.invalidateQueries({ queryKey: ["commissions"] });
    },
  });
}

/* ── Afiliados (visão do garagista) ─────────────────────── */
export function useAffiliates(lojaId?: string): UseQueryResult<Seller[]> {
  return useQuery({
    queryKey: ["affiliates", lojaId],
    enabled: !!lojaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rv_sellers")
        .select("*")
        .eq("parent_id", lojaId!)
        .eq("role", "afiliado")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Seller[];
    },
  });
}

/** Afiliados ATIVOS da loja, para o seletor de responsável na venda. */
export function useLojaAffiliates(lojaId?: string): UseQueryResult<Seller[]> {
  return useQuery({
    queryKey: ["loja-affiliates-active", lojaId],
    enabled: !!lojaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rv_sellers")
        .select("*")
        .eq("parent_id", lojaId!)
        .eq("role", "afiliado")
        .eq("status", "active")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Seller[];
    },
  });
}

export function useInviteAffiliate(lojaId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; email: string; commission_rate: number }) => {
      const { data, error } = await supabase.functions.invoke("invite-affiliate", {
        body: input,
      });
      if (error) {
        const ctx = (error as { context?: Response }).context;
        if (ctx && typeof ctx.json === "function") {
          const body = await ctx.json().catch(() => null);
          if (body?.error) throw new Error(body.error);
        }
        throw error;
      }
      if ((data as { error?: string })?.error)
        throw new Error((data as { error: string }).error);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["affiliates", lojaId] }),
  });
}

export function useSetAffiliateRate(lojaId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; rate: number }) => {
      const { error } = await supabase
        .from("rv_sellers")
        .update({ commission_rate: input.rate })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["affiliates", lojaId] }),
  });
}

export function useSetAffiliateStatus(lojaId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; status: "active" | "suspended" }) => {
      const { error } = await supabase
        .from("rv_sellers")
        .update({ status: input.status })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["affiliates", lojaId] }),
  });
}

/** Sugere o afiliado a partir do telefone do comprador (RPC server-side). */
export function useSuggestAffiliate() {
  return async (vehicleId: number, phone: string) => {
    const { data, error } = await supabase.rpc("suggest_affiliate_for_sale", {
      p_vehicle_id: vehicleId,
      p_buyer_phone: phone,
    });
    if (error) return null;
    const row = (data as unknown as { affiliate_id: string; affiliate_name: string }[] | null)?.[0];
    return row ? { id: row.affiliate_id, name: row.affiliate_name } : null;
  };
}

export type AffiliateSaleSignal = {
  id: string;
  affiliate_name: string | null;
  vehicle_label: string | null;
  note: string | null;
  status: string;
  created_at: string;
};

/** Sinais de venda enviados pelos afiliados da loja (in-app). */
export function useAffiliateSaleSignals(lojaId?: string): UseQueryResult<AffiliateSaleSignal[]> {
  return useQuery({
    queryKey: ["affiliate-sale-signals", lojaId],
    enabled: !!lojaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rv_affiliate_sale_signals")
        .select("id, note, status, created_at, affiliate:rv_sellers!rv_affiliate_sale_signals_affiliate_id_fkey(name), vehicle:rv_vehicles(make, model)")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      type Raw = {
        id: string; note: string | null; status: string; created_at: string;
        affiliate: { name: string } | null;
        vehicle: { make: string; model: string } | null;
      };
      return ((data ?? []) as unknown as Raw[]).map((r) => ({
        id: r.id,
        affiliate_name: r.affiliate?.name ?? null,
        vehicle_label: r.vehicle ? `${r.vehicle.make} ${r.vehicle.model}` : null,
        note: r.note,
        status: r.status,
        created_at: r.created_at,
      }));
    },
  });
}

/** O plano do garagista habilita afiliados? Lookup por pricing_plan_key. */
export function useAffiliatesEnabled(planKey?: string | null): UseQueryResult<boolean> {
  return useQuery({
    queryKey: ["affiliates-enabled", planKey ?? null],
    enabled: !!planKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rv_pricing_plans")
        .select("affiliates_enabled")
        .eq("key", planKey!)
        .maybeSingle();
      if (error) throw error;
      return !!(data as { affiliates_enabled?: boolean } | null)?.affiliates_enabled;
    },
  });
}

/* ── Relatório de afiliados (visão do garagista) ─────────── */
export type AffiliateReportFilters = { affiliateId?: string; from?: string; to?: string };

export type AffiliateReportRow = AffiliateMetrics & {
  affiliateId: string;
  name: string;
  status: string;
  rate: number;
};

/** Visão geral dos afiliados da loja (agregada). RLS já escopa à loja; filtra
 *  explicitamente por seller_id=lojaId por consistência/defesa em profundidade. */
export function useLojaAffiliateReport(
  lojaId?: string,
  filters: AffiliateReportFilters = {}
): UseQueryResult<AffiliateReportRow[]> {
  const { affiliateId, from, to } = filters;
  return useQuery({
    queryKey: ["loja-affiliate-report", lojaId, affiliateId ?? null, from ?? null, to ?? null],
    enabled: !!lojaId,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let salesQ = supabase
        .from("rv_sales")
        .select("affiliate_id, sale_price")
        .eq("seller_id", lojaId!)
        .not("affiliate_id", "is", null);
      let commsQ = supabase
        .from("rv_commissions")
        .select("affiliate_id, amount, status")
        .eq("seller_id", lojaId!)
        .not("affiliate_id", "is", null);
      let clicksQ = supabase
        .from("rv_click_events")
        .select("affiliate_id, kind")
        .eq("seller_id", lojaId!)
        .in("kind", ["affiliate_share", "affiliate_link_visit"]);
      if (affiliateId) {
        salesQ = salesQ.eq("affiliate_id", affiliateId);
        commsQ = commsQ.eq("affiliate_id", affiliateId);
        clicksQ = clicksQ.eq("affiliate_id", affiliateId);
      }
      if (from) {
        salesQ = salesQ.gte("sale_date", from);
        commsQ = commsQ.gte("created_at", from);
        clicksQ = clicksQ.gte("created_at", from);
      }
      if (to) {
        salesQ = salesQ.lte("sale_date", to);
        commsQ = commsQ.lt("created_at", nextDay(to));
        clicksQ = clicksQ.lt("created_at", nextDay(to));
      }
      const affQ = supabase
        .from("rv_sellers")
        .select("id, name, status, commission_rate")
        .eq("parent_id", lojaId!)
        .eq("role", "afiliado");

      const [sales, comms, clicks, affs] = await Promise.all([salesQ, commsQ, clicksQ, affQ]);
      for (const r of [sales, comms, clicks, affs]) if (r.error) throw r.error;

      const metrics = buildAffiliateMetrics({
        sales: (sales.data ?? []) as unknown as AggInput["sales"],
        commissions: (comms.data ?? []) as unknown as AggInput["commissions"],
        clicks: (clicks.data ?? []) as unknown as AggInput["clicks"],
      });
      type AffRaw = { id: string; name: string; status: string; commission_rate: number };
      let rows = ((affs.data ?? []) as AffRaw[]).map((a) => ({
        affiliateId: a.id,
        name: a.name,
        status: a.status,
        rate: Number(a.commission_rate),
        ...(metrics.get(a.id) ?? emptyMetrics()),
      }));
      if (affiliateId) rows = rows.filter((r) => r.affiliateId === affiliateId);
      return rows.sort((x, y) => y.salesVolume - x.salesVolume);
    },
  });
}
