import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Lead, LeadStage, LeadWithVehicle, TopClickedVehicle } from "./types";

/* rv_leads e a coluna rv_vehicles.clicks não estão no tipo gerado do banco
   (gerado sem supabase local). Usamos um cliente sem tipagem nestes pontos;
   os retornos são tipados pelas nossas interfaces (Lead*, TopClickedVehicle). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

const LEAD_COLS = "*, vehicle:rv_vehicles(id, make, model, year)";

export function useLeads(sellerId?: string): UseQueryResult<LeadWithVehicle[]> {
  return useQuery({
    queryKey: ["leads", sellerId ?? "all"],
    queryFn: async () => {
      let q = sb
        .from("rv_leads")
        .select(LEAD_COLS)
        .order("created_at", { ascending: false });
      if (sellerId) q = q.eq("seller_id", sellerId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as LeadWithVehicle[];
    },
  });
}

export type NewLead = Pick<
  Lead,
  "seller_id" | "vehicle_id" | "name" | "phone" | "email" | "city" | "message" | "financing"
> & { buyer_id?: string | null };

export function useCreateLead() {
  return useMutation({
    mutationFn: async (input: NewLead) => {
      const { error } = await sb.from("rv_leads").insert(input);
      if (error) throw error;
    },
  });
}

export function useUpdateLeadStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: LeadStage; sellerId?: string }) => {
      const { error } = await sb.from("rv_leads").update({ stage }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["leads", vars.sellerId ?? "all"] });
    },
  });
}

export type LeadEditInput = Pick<
  Lead,
  "name" | "phone" | "email" | "city" | "message" | "financing" | "stage"
>;

export function useUpdateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id: string;
      values: LeadEditInput;
      sellerId?: string;
    }) => {
      const { error } = await sb.from("rv_leads").update(values).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["leads", vars.sellerId ?? "all"] });
    },
  });
}

export function useDeleteLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; sellerId?: string }) => {
      const { error } = await sb.from("rv_leads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["leads", vars.sellerId ?? "all"] });
    },
  });
}

export function useTopClicked(
  sellerId?: string,
  limit = 5
): UseQueryResult<TopClickedVehicle[]> {
  return useQuery({
    queryKey: ["top-clicked", sellerId ?? "all"],
    queryFn: async () => {
      let q = sb
        .from("rv_vehicles")
        .select("id, make, model, year, images, clicks")
        .gt("clicks", 0)
        .neq("status", "removed" as never)
        .order("clicks", { ascending: false })
        .limit(limit);
      if (sellerId) q = q.eq("seller_id", sellerId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as TopClickedVehicle[];
    },
  });
}

export function useTrackVehicleClick() {
  return (id: number) => {
    // RPC não está no tipo gerado → best-effort (ignora erro).
    // O builder do supabase-js é lazy: só dispara a requisição no .then(),
    // por isso precisamos chamá-lo (um `void` sozinho não executa nada).
    sb.rpc("increment_vehicle_clicks", { p_id: id }).then(
      () => {},
      () => {}
    );
  };
}
