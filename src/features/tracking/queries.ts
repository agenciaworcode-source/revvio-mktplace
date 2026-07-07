import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export type ClickKind = "vehicle_interest" | "store_whatsapp" | "store_instagram";

/**
 * Seller do dono da plataforma (admin@revvio.com). Cliques em canais do rodapé
 * global (que não pertencem a nenhuma loja) são atribuídos a este seller.
 */
export const PLATFORM_OWNER_SELLER_ID = "6128cc30-51c4-47b7-9fb7-e8aa3295312e";

export type VehicleClicks = {
  vehicle_id: number;
  make: string;
  model: string;
  year: number | null;
  clicks: number;
};

export type ClickBuyer = {
  buyer_id: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  count: number;
  last_at: string;
};

export type ChannelClicks = {
  kind: "store_whatsapp" | "store_instagram";
  total: number;
  buyers: ClickBuyer[];
};

/** Dispara um evento de clique (best-effort; o builder do supabase-js é lazy). */
export function useLogClickEvent() {
  return (kind: ClickKind, sellerId: string, vehicleId?: number) => {
    supabase
      .rpc("log_click_event", {
        p_kind: kind,
        p_seller_id: sellerId,
        p_vehicle_id: vehicleId ?? undefined,
      })
      .then(
        () => {},
        () => {}
      );
  };
}

/**
 * Todos os veículos do garagista (exceto removidos) com a contagem de cliques
 * 'vehicle_interest' — carros sem cliques aparecem com 0. Admin filtra garagista;
 * garagista usa o próprio (RLS restringe leitura ao current_loja()).
 */
export function useClicksByVehicle(sellerId?: string): UseQueryResult<VehicleClicks[]> {
  return useQuery({
    queryKey: ["clicks-by-vehicle", sellerId ?? "all"],
    enabled: !!sellerId,
    queryFn: async () => {
      const [vehiclesRes, eventsRes] = await Promise.all([
        supabase
          .from("rv_vehicles")
          .select("id, make, model, year")
          .eq("seller_id", sellerId!)
          .neq("status", "removed" as never),
        supabase
          .from("rv_click_events")
          .select("vehicle_id")
          .eq("kind", "vehicle_interest")
          .eq("seller_id", sellerId!)
          .not("vehicle_id", "is", null),
      ]);
      if (vehiclesRes.error) throw vehiclesRes.error;
      if (eventsRes.error) throw eventsRes.error;

      const counts = new Map<number, number>();
      for (const e of (eventsRes.data ?? []) as { vehicle_id: number | null }[]) {
        if (e.vehicle_id == null) continue;
        counts.set(e.vehicle_id, (counts.get(e.vehicle_id) ?? 0) + 1);
      }
      const vehicles = (vehiclesRes.data ?? []) as unknown as {
        id: number;
        make: string;
        model: string;
        year: number | null;
      }[];
      return vehicles
        .map((v) => ({
          vehicle_id: v.id,
          make: v.make ?? "—",
          model: v.model ?? "",
          year: v.year ?? null,
          clicks: counts.get(v.id) ?? 0,
        }))
        .sort((a, b) => b.clicks - a.clicks || `${a.make} ${a.model}`.localeCompare(`${b.make} ${b.model}`));
    },
  });
}

/** Compradores que clicaram num carro (agrupados; anônimos viram um grupo). */
export function useClickBuyers(vehicleId?: number): UseQueryResult<ClickBuyer[]> {
  return useQuery({
    queryKey: ["click-buyers", vehicleId ?? 0],
    enabled: !!vehicleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rv_click_events")
        .select("buyer_id, created_at, buyer:rv_buyers(name, phone, email, city)")
        .eq("kind", "vehicle_interest")
        .eq("vehicle_id", vehicleId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as unknown as {
        buyer_id: string | null;
        created_at: string;
        buyer: { name: string; phone: string | null; email: string | null; city: string | null } | null;
      }[];
      const map = new Map<string, ClickBuyer>();
      for (const r of rows) {
        const key = r.buyer_id ?? "anon";
        const cur = map.get(key);
        if (cur) {
          cur.count += 1;
          if (r.created_at > cur.last_at) cur.last_at = r.created_at;
        } else {
          map.set(key, {
            buyer_id: r.buyer_id,
            name: r.buyer?.name ?? "Visitante não identificado",
            phone: r.buyer?.phone ?? null,
            email: r.buyer?.email ?? null,
            city: r.buyer?.city ?? null,
            count: 1,
            last_at: r.created_at,
          });
        }
      }
      return [...map.values()].sort((a, b) => (a.last_at < b.last_at ? 1 : -1));
    },
  });
}

/** Acessos a canais externos (WhatsApp/Instagram) da loja, com quem acessou. */
export function useChannelClicks(sellerId?: string): UseQueryResult<ChannelClicks[]> {
  return useQuery({
    queryKey: ["channel-clicks", sellerId ?? "all"],
    enabled: !!sellerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rv_click_events")
        .select("kind, buyer_id, created_at, buyer:rv_buyers(name, phone, email, city)")
        .in("kind", ["store_whatsapp", "store_instagram"])
        .eq("seller_id", sellerId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as unknown as {
        kind: "store_whatsapp" | "store_instagram";
        buyer_id: string | null;
        created_at: string;
        buyer: { name: string; phone: string | null; email: string | null; city: string | null } | null;
      }[];
      const channels: Record<"store_whatsapp" | "store_instagram", ChannelClicks> = {
        store_whatsapp: { kind: "store_whatsapp", total: 0, buyers: [] },
        store_instagram: { kind: "store_instagram", total: 0, buyers: [] },
      };
      const byKey: Record<string, Map<string, ClickBuyer>> = {
        store_whatsapp: new Map(),
        store_instagram: new Map(),
      };
      for (const r of rows) {
        const ch = channels[r.kind];
        ch.total += 1;
        const key = r.buyer_id ?? "anon";
        const m = byKey[r.kind];
        const cur = m.get(key);
        if (cur) {
          cur.count += 1;
          if (r.created_at > cur.last_at) cur.last_at = r.created_at;
        } else {
          m.set(key, {
            buyer_id: r.buyer_id,
            name: r.buyer?.name ?? "Visitante não identificado",
            phone: r.buyer?.phone ?? null,
            email: r.buyer?.email ?? null,
            city: r.buyer?.city ?? null,
            count: 1,
            last_at: r.created_at,
          });
        }
      }
      channels.store_whatsapp.buyers = [...byKey.store_whatsapp.values()];
      channels.store_instagram.buyers = [...byKey.store_instagram.values()];
      return [channels.store_whatsapp, channels.store_instagram];
    },
  });
}
