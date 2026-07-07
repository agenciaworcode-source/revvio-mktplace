import { useMutation, useQuery, type UseQueryResult } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export type AffiliateCar = {
  id: number;
  make: string;
  model: string;
  year: number | null;
  price: number;
  image: string | null;
};

/** Carros disponíveis da loja do afiliado (catálogo é leitura pública). */
export function useAffiliateLojaCars(lojaId?: string): UseQueryResult<AffiliateCar[]> {
  return useQuery({
    queryKey: ["affiliate-loja-cars", lojaId],
    enabled: !!lojaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rv_vehicles")
        .select("id, make, model, year, price, images, status, blocked, seller_id")
        .eq("seller_id", lojaId!)
        .eq("status", "available" as never)
        .order("created_at", { ascending: false });
      if (error) throw error;
      type Raw = {
        id: number; make: string; model: string; year: number | null;
        price: number; images: string[] | null; blocked: boolean | null;
      };
      return ((data ?? []) as unknown as Raw[])
        .filter((v) => !v.blocked)
        .map((v) => ({
          id: v.id,
          make: v.make,
          model: v.model,
          year: v.year,
          price: Number(v.price),
          image: v.images?.[0] ?? null,
        }));
    },
  });
}

export type AffiliatePerformance = {
  shares: number;
  clicks: number;
  salesCount: number;
  salesVolume: number;
  commissionPending: number;
  commissionPaid: number;
};

/** Desempenho do próprio afiliado (RLS escopa a affiliate_id = current_person). */
export function useAffiliatePerformance(personId?: string): UseQueryResult<AffiliatePerformance> {
  return useQuery({
    queryKey: ["affiliate-performance", personId],
    enabled: !!personId,
    queryFn: async () => {
      const [sharesQ, clicksQ, salesQ, commsQ] = await Promise.all([
        supabase
          .from("rv_click_events")
          .select("id", { count: "exact", head: true })
          .eq("affiliate_id", personId!)
          .eq("kind", "affiliate_share"),
        supabase
          .from("rv_click_events")
          .select("id", { count: "exact", head: true })
          .eq("affiliate_id", personId!)
          .eq("kind", "affiliate_link_visit"),
        supabase.from("rv_sales").select("sale_price").eq("affiliate_id", personId!),
        supabase.from("rv_commissions").select("amount, status").eq("affiliate_id", personId!),
      ]);
      if (sharesQ.error) throw sharesQ.error;
      if (clicksQ.error) throw clicksQ.error;
      if (salesQ.error) throw salesQ.error;
      if (commsQ.error) throw commsQ.error;

      const sales = (salesQ.data ?? []) as { sale_price: number }[];
      const comms = (commsQ.data ?? []) as { amount: number; status: string }[];
      return {
        shares: sharesQ.count ?? 0,
        clicks: clicksQ.count ?? 0,
        salesCount: sales.length,
        salesVolume: sales.reduce((acc, s) => acc + Number(s.sale_price), 0),
        commissionPending: comms
          .filter((c) => c.status !== "paid")
          .reduce((acc, c) => acc + Number(c.amount), 0),
        commissionPaid: comms
          .filter((c) => c.status === "paid")
          .reduce((acc, c) => acc + Number(c.amount), 0),
      };
    },
  });
}

/** Afiliado sinaliza ao garagista que ajudou numa venda (não cria venda). */
export function useSignalSale() {
  return useMutation({
    mutationFn: async (input: { note?: string | null; vehicleId?: number | null }) => {
      const { error } = await supabase.rpc("signal_affiliate_sale", {
        p_vehicle_id: input.vehicleId ?? undefined,
        p_note: input.note ?? undefined,
      });
      if (error) throw error;
    },
  });
}

/** Registra o compartilhamento de um carro pelo afiliado (RPC). */
export function useLogAffiliateShare() {
  return useMutation({
    mutationFn: async (input: { vehicleId: number }) => {
      const { error } = await supabase.rpc("log_affiliate_share", {
        p_vehicle_id: input.vehicleId,
      });
      if (error) throw error;
    },
  });
}
