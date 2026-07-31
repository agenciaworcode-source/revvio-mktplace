import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

/**
 * Acesso efetivo do usuário logado no painel da loja.
 *
 * Duas camadas independentes:
 *  - `perms`   — o que o garagista liberou para os vendedores da loja
 *                (Configurações da Loja → aba Permissões).
 *  - `modulos` — o que o plano de assinatura da loja libera. Vale para a loja
 *                inteira, garagista incluído, e é definido pelo superadmin
 *                em Controle de Planos.
 *
 * Um item do painel só aparece quando o módulo do plano está ligado E o papel
 * tem permissão. A RLS repete a checagem de `perms` no banco; `modulos` é um
 * gate comercial, aplicado só no painel.
 */
export type Permissao =
  | "ver_leads"
  | "ver_financeiro"
  | "ver_todas_vendas"
  | "add_veiculo"
  | "editar_veiculo"
  | "excluir_veiculo"
  | "gerador_whatsapp";

export type Modulo = "leads" | "financeiro" | "whatsapp" | "equipe" | "afiliados";

export type Acesso = {
  role: string | null;
  is_manager: boolean;
  perms: Record<Permissao, boolean>;
  modulos: Record<Modulo, boolean>;
};

/** Usado enquanto a RPC carrega: nega tudo que é opcional, sem piscar o menu. */
export const ACESSO_VAZIO: Acesso = {
  role: null,
  is_manager: false,
  perms: {
    ver_leads: false,
    ver_financeiro: false,
    ver_todas_vendas: false,
    add_veiculo: false,
    editar_veiculo: false,
    excluir_veiculo: false,
    gerador_whatsapp: false,
  },
  modulos: {
    leads: false,
    financeiro: false,
    whatsapp: false,
    equipe: false,
    afiliados: false,
  },
};

export function useAcesso(enabled: boolean): UseQueryResult<Acesso> {
  return useQuery({
    queryKey: ["meu-acesso"],
    enabled,
    // O acesso só muda quando o garagista salva as permissões (que invalida
    // esta query) ou quando o plano muda — não precisa refetch agressivo.
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("meu_acesso");
      if (error) throw error;
      return (data ?? ACESSO_VAZIO) as unknown as Acesso;
    },
  });
}

/** Combina papel + permissões num helper único para o painel. */
export function podeAcessar(acesso: Acesso | undefined, perm: Permissao): boolean {
  if (!acesso) return false;
  return acesso.is_manager || acesso.perms[perm];
}
