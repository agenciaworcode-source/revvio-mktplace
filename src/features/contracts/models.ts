// ============================================================
// Catálogo de modelos de contrato (rv_contract_models).
//
// Os modelos padrão viviam no código; agora são dado, mantido pelo superadmin
// no painel. Cada modelo diz para quem aparece (`audience`) e qual é a
// natureza do documento (`contractType`) — é ela que define os rótulos das
// partes, a validação do formulário, o cálculo da comissão e a diagramação da
// folha, então vários modelos podem compartilhar a mesma natureza.
//
// O catálogo do código (templates.ts) fica como reserva: se a tabela não
// responder, o editor ainda abre com os modelos originais em vez de vazio.
// ============================================================

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import {
  CONTRACT_TEMPLATES,
  CONTRACT_TYPE_OPTIONS,
  type ContractType,
} from "./templates";

/** Painéis em que um modelo aparece. */
export type ContractAudience = "admin" | "garagista" | "ambos";

export const AUDIENCE_LABEL: Record<ContractAudience, string> = {
  admin: "Somente Revvio",
  garagista: "Somente lojas",
  ambos: "Revvio e lojas",
};

export const AUDIENCE_OPTIONS: { value: ContractAudience; label: string }[] = [
  { value: "ambos", label: AUDIENCE_LABEL.ambos },
  { value: "garagista", label: AUDIENCE_LABEL.garagista },
  { value: "admin", label: AUDIENCE_LABEL.admin },
];

export interface ContractModel {
  id: string;
  /** Só os três modelos que nasceram no código têm slug. */
  slug: string | null;
  name: string;
  contractType: ContractType;
  audience: ContractAudience;
  body: string;
  active: boolean;
  sortOrder: number;
}

export type ContractModelInput = Omit<ContractModel, "id" | "slug">;

/** Slug do modelo que o molde de contrato da loja sobrescreve. */
export const SLUG_MOLDE_LOJA = "compra_venda";

interface ModelRow {
  id: string;
  slug: string | null;
  name: string;
  contract_type: ContractType;
  audience: ContractAudience;
  body: string;
  active: boolean;
  sort_order: number;
}

// rv_contract_models ainda não está nos tipos gerados — rode
// `npm run types:gen` após aplicar a migration 0055.
const models = () => supabase.from("rv_contract_models" as never);

function fromRow(r: ModelRow): ContractModel {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    contractType: r.contract_type,
    audience: r.audience,
    body: r.body,
    active: r.active,
    sortOrder: r.sort_order,
  };
}

function toRow(input: ContractModelInput) {
  return {
    name: input.name,
    contract_type: input.contractType,
    audience: input.audience,
    body: input.body,
    active: input.active,
    sort_order: input.sortOrder,
  };
}

/* ── Reserva: o catálogo original, embutido no código ────────
   Vale só quando a consulta falha (tabela ausente, rede fora). Catálogo
   vazio de propósito continua vazio — remover modelo é uma decisão do
   superadmin, não um defeito a compensar. */
const AUDIENCE_PADRAO: Record<ContractType, ContractAudience> = {
  intermediacao: "admin",
  compra_venda: "ambos",
  procuracao: "admin",
};

export const FALLBACK_MODELS: ContractModel[] = CONTRACT_TYPE_OPTIONS.map(
  (opt, i) => ({
    id: `builtin:${opt.value}`,
    slug: opt.value,
    name: opt.label,
    contractType: opt.value,
    audience: AUDIENCE_PADRAO[opt.value],
    body: CONTRACT_TEMPLATES[opt.value],
    active: true,
    sortOrder: (i + 1) * 10,
  })
);

/**
 * Modelos que o painel pode emitir. `painel` é quem pergunta: o superadmin vê
 * os dele e os compartilhados, o garagista idem. Inativos ficam de fora — e o
 * RLS repete o corte no banco, então nem chegam ao garagista pela API.
 */
export function useContractModels(
  painel: "admin" | "garagista"
): UseQueryResult<ContractModel[]> {
  return useQuery({
    queryKey: ["contract-models", painel],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await models()
        .select("*")
        .eq("active", true)
        .in("audience", [painel, "ambos"])
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) {
        // Sem catálogo o editor não abre. Melhor cair no texto de fábrica do
        // que deixar o garagista sem conseguir emitir contrato.
        console.error("Falha ao carregar modelos de contrato:", error);
        return FALLBACK_MODELS.filter(
          (m) => m.audience === painel || m.audience === "ambos"
        );
      }
      return ((data ?? []) as unknown as ModelRow[]).map(fromRow);
    },
  });
}

/** Catálogo completo (inclusive inativos) — tela de gestão do superadmin. */
export function useAdminContractModels(): UseQueryResult<ContractModel[]> {
  return useQuery({
    queryKey: ["contract-models", "todos"],
    queryFn: async () => {
      const { data, error } = await models()
        .select("*")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as unknown as ModelRow[]).map(fromRow);
    },
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["contract-models"] });
}

/** Cria (sem `id`) ou atualiza um modelo do catálogo. */
export function useSaveContractModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id?: string } & ContractModelInput) => {
      const { id, ...rest } = input;
      if (id) {
        const { error } = await models()
          .update(toRow(rest) as never)
          .eq("id", id);
        if (error) throw error;
        return;
      }
      const { error } = await models().insert(toRow(rest) as never);
      if (error) throw error;
    },
    onSuccess: () => invalidate(qc),
  });
}

export function useDeleteContractModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await models().delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(qc),
  });
}
