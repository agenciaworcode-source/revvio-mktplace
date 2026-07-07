import { useMutation, useQuery, type UseQueryResult } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Seller, Vehicle } from "@/lib/database.types";

/** Subconjunto público do vendedor (o que aparece na vitrine/mini-loja). */
export type PublicSeller = Pick<
  Seller,
  | "id"
  | "name"
  | "slug"
  | "avatar_url"
  | "banner_url"
  | "bio"
  | "city"
  | "state"
  | "whatsapp"
  | "phone"
  | "instagram"
  | "pricing_plan_key"
  | "created_at"
>;

export type PublicVehicle = Vehicle & { seller: PublicSeller | null };

const SELLER_COLS =
  "id, name, slug, avatar_url, banner_url, bio, city, state, whatsapp, phone, instagram, pricing_plan_key, created_at";

/**
 * Vitrine geral: veículos disponíveis cujo vendedor está ativo.
 * O `!inner` em rv_sellers usa o RLS (lê só sellers active) para descartar
 * veículos de vendedores pendentes/suspensos.
 */
export function usePublicVehicles(): UseQueryResult<PublicVehicle[]> {
  return useQuery({
    queryKey: ["public-vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rv_vehicles")
        .select(`*, seller:rv_sellers!rv_vehicles_seller_id_fkey!inner(${SELLER_COLS})`)
        .eq("status", "available")
        .eq("blocked", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PublicVehicle[];
    },
  });
}

export function usePublicVehicle(id?: string): UseQueryResult<PublicVehicle | null> {
  return useQuery({
    queryKey: ["public-vehicle", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rv_vehicles")
        .select(`*, seller:rv_sellers!rv_vehicles_seller_id_fkey(${SELLER_COLS})`)
        .eq("id", Number(id))
        .eq("blocked", false)
        .neq("status", "removed" as never)
        .maybeSingle();
      if (error) throw error;
      return (data as PublicVehicle | null) ?? null;
    },
  });
}

export type Storefront = {
  seller: PublicSeller;
  vehicles: PublicVehicle[];
  soldCount: number;
} | null;

/** Mini-loja por slug: vendedor ativo + seus veículos disponíveis. */
export function useStorefront(slug?: string): UseQueryResult<Storefront> {
  return useQuery({
    queryKey: ["storefront", slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data: seller, error } = await supabase
        .from("rv_sellers")
        .select(SELLER_COLS)
        .eq("slug", slug!)
        .maybeSingle();
      if (error) throw error;
      if (!seller) return null;

      const sellerId = (seller as PublicSeller).id;
      const [vehiclesRes, soldRes] = await Promise.all([
        supabase
          .from("rv_vehicles")
          .select("*")
          .eq("seller_id", sellerId)
          .eq("status", "available")
          .eq("blocked", false)
          .order("created_at", { ascending: false }),
        supabase
          .from("rv_vehicles")
          .select("*", { count: "exact", head: true })
          .eq("seller_id", sellerId)
          .eq("status", "sold"),
      ]);
      if (vehiclesRes.error) throw vehiclesRes.error;
      if (soldRes.error) throw soldRes.error;

      return {
        seller: seller as PublicSeller,
        // seller=null: o card não repete "Vendido por" na própria vitrine.
        vehicles: ((vehiclesRes.data ?? []) as Vehicle[]).map((v) => ({
          ...v,
          seller: null,
        })) as PublicVehicle[],
        soldCount: soldRes.count ?? 0,
      };
    },
  });
}

/** Plano público exibido na landing /vender (tabela rv_pricing_plans). */
export type PricingPlan = {
  id: string;
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
};

const PRICING_COLS =
  "id, key, name, tagline, price_monthly, price_annual, color, popular, cta_label, highlights, vehicle_limit, trial_days, sort_order";

/**
 * Catálogo público de planos da página Vender. O RLS `pricing_public_read`
 * já restringe a planos ativos; filtramos por garantia e ordenamos.
 */
export function usePricingPlans(): UseQueryResult<PricingPlan[]> {
  return useQuery({
    queryKey: ["pricing-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rv_pricing_plans")
        .select(PRICING_COLS)
        .eq("active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PricingPlan[];
    },
  });
}

/** Configurações globais do site (singleton `rv_site_settings`). Leitura pública. */
export type SiteSettings = {
  home_banner_url: string | null;
};

/** Lê a config do site (id=1). A landing usa `home_banner_url` no banner da home. */
export function useSiteSettings(): UseQueryResult<SiteSettings> {
  return useQuery({
    queryKey: ["site-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rv_site_settings")
        .select("home_banner_url")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return (data ?? { home_banner_url: null }) as SiteSettings;
    },
  });
}

/** Loga a visita de um carro via link de afiliado (?ref=). Best-effort. */
export function useLogAffiliateVisit() {
  const m = useMutation({
    mutationFn: async (input: { refCode: string; vehicleId: number }) => {
      const { error } = await supabase.rpc("log_affiliate_visit", {
        p_ref_code: input.refCode,
        p_vehicle_id: input.vehicleId,
      });
      if (error) throw error;
    },
  });
  return (refCode: string, vehicleId: number) =>
    m.mutate({ refCode, vehicleId }, { onError: () => {} });
}

/** "Nossos Vendedores": vendedores ativos (RLS já restringe a active). */
export function useActiveSellers(): UseQueryResult<PublicSeller[]> {
  return useQuery({
    queryKey: ["active-sellers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rv_sellers")
        .select(SELLER_COLS)
        .eq("role", "garagista")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PublicSeller[];
    },
  });
}
