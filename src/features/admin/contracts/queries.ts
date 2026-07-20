// ============================================================
// Queries do módulo de contratos (admin-only — RLS garante que
// somente public.is_admin() lê/escreve rv_contracts e o bucket
// contract-photos).
// ============================================================

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { ContractType } from "./templates";

export interface Contract {
  id: string;
  contract_type: ContractType;
  vendedor_name: string;
  vendedor_cpf_cnpj: string;
  vendedor_address: string;
  comprador_name: string | null;
  comprador_cpf_cnpj: string | null;
  comprador_address: string | null;
  vehicle_brand_model: string;
  vehicle_year_model: string;
  vehicle_plate: string;
  vehicle_renavam: string;
  vehicle_chassi: string | null;
  sale_value: number;
  commission_value: number;
  template_content: string;
  full_text_content: string;
  signed_photo_path: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type ContractInput = Omit<
  Contract,
  "id" | "created_by" | "created_at" | "updated_at" | "signed_photo_path"
>;

export interface ContractFilters {
  from?: string; // yyyy-mm-dd (data de emissão)
  to?: string;
  search?: string; // nome ou CPF/CNPJ de qualquer das partes
  type?: ContractType;
}

// rv_contracts ainda não está nos tipos gerados — rode
// `npm run types:gen` após aplicar a migration 0047.
const contracts = () => supabase.from("rv_contracts" as never);

// limite superior exclusivo p/ timestamptz: soma 1 dia ao yyyy-mm-dd
function nextDay(isoDate: string): string {
  const d = new Date(isoDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function useAdminContracts(
  filters: ContractFilters
): UseQueryResult<Contract[]> {
  return useQuery({
    queryKey: ["admin-contracts", filters],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let q = contracts()
        .select("*")
        .order("created_at", { ascending: false });
      if (filters.type) q = q.eq("contract_type", filters.type);
      if (filters.from) q = q.gte("created_at", filters.from);
      if (filters.to) q = q.lt("created_at", nextDay(filters.to));
      const s = filters.search?.trim().replace(/[,()]/g, "");
      if (s) {
        q = q.or(
          `vendedor_name.ilike.%${s}%,vendedor_cpf_cnpj.ilike.%${s}%,` +
            `comprador_name.ilike.%${s}%,comprador_cpf_cnpj.ilike.%${s}%`
        );
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Contract[];
    },
  });
}

export function useContract(id?: string): UseQueryResult<Contract | null> {
  return useQuery({
    queryKey: ["admin-contract", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await contracts()
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as Contract | null) ?? null;
    },
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>, id?: string) {
  qc.invalidateQueries({ queryKey: ["admin-contracts"] });
  if (id) qc.invalidateQueries({ queryKey: ["admin-contract", id] });
}

export function useCreateContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ContractInput): Promise<Contract> => {
      const { data: auth } = await supabase.auth.getUser();
      const { data, error } = await contracts()
        .insert({ ...input, created_by: auth.user?.id ?? null } as never)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Contract;
    },
    onSuccess: () => invalidate(qc),
  });
}

export function useUpdateContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string } & Partial<ContractInput>) => {
      const { id, ...patch } = input;
      const { error } = await contracts()
        .update(patch as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => invalidate(qc, v.id),
  });
}

export function useDeleteContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (contract: Pick<Contract, "id" | "signed_photo_path">) => {
      if (contract.signed_photo_path) {
        await supabase.storage
          .from("contract-photos")
          .remove([contract.signed_photo_path]);
      }
      const { error } = await contracts().delete().eq("id", contract.id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(qc),
  });
}

/** Sobe a foto capturada pela câmera e grava o path no contrato. */
export function useUploadContractPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      contractId: string;
      blob: Blob;
      previousPath: string | null;
    }) => {
      const path = `${input.contractId}/${crypto.randomUUID()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("contract-photos")
        .upload(path, input.blob, { contentType: "image/jpeg", upsert: false });
      if (upErr) throw upErr;

      const { error } = await contracts()
        .update({ signed_photo_path: path } as never)
        .eq("id", input.contractId);
      if (error) throw error;

      if (input.previousPath) {
        await supabase.storage.from("contract-photos").remove([input.previousPath]);
      }
      return path;
    },
    onSuccess: (_d, v) => invalidate(qc, v.contractId),
  });
}

/** URL assinada (bucket privado) para exibir a foto do contrato. */
export function useContractPhotoUrl(
  path: string | null | undefined
): UseQueryResult<string | null> {
  return useQuery({
    queryKey: ["contract-photo", path],
    enabled: !!path,
    staleTime: 50 * 60 * 1000, // renova antes de a URL de 60 min expirar
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from("contract-photos")
        .createSignedUrl(path!, 60 * 60);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}
