import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/AuthProvider";
import { useAcesso } from "@/features/auth/acesso";
import { useUpdatePermissoes, type PermissoesInput } from "../queries";
import { Alert, Button, Card } from "@/components/ui-light";
import type { Seller } from "@/lib/database.types";

type Chave = keyof PermissoesInput;

const GRUPOS: { titulo: string; descricao: string; itens: {
  chave: Chave;
  label: string;
  hint: string;
  modulo?: "leads" | "financeiro" | "whatsapp";
}[] }[] = [
  {
    titulo: "Veículos",
    descricao: "O vendedor sempre enxerga o estoque da loja. Aqui você define o que ele pode mudar.",
    itens: [
      {
        chave: "vend_add_veiculo",
        label: "Cadastrar veículo",
        hint: "Permite abrir o formulário de novo veículo.",
      },
      {
        chave: "vend_editar_veiculo",
        label: "Editar veículo",
        hint: "Permite alterar preço, fotos e dados de qualquer veículo da loja.",
      },
      {
        chave: "vend_excluir_veiculo",
        label: "Excluir veículo",
        hint: "Permite remover veículos das listagens (o registro é mantido para histórico).",
      },
    ],
  },
  {
    titulo: "Vendas e financeiro",
    descricao: "O vendedor sempre vê as próprias vendas e a própria comissão.",
    itens: [
      {
        chave: "vend_ver_todas_vendas",
        label: "Ver as vendas de toda a loja",
        hint: "Sem isso, ele vê apenas as vendas que ele mesmo registrou.",
      },
      {
        chave: "vend_ver_financeiro",
        label: "Acessar o Financeiro da loja",
        hint: "Abre a aba Financeiro com as comissões de todos os vendedores.",
        modulo: "financeiro",
      },
    ],
  },
  {
    titulo: "Outras abas",
    descricao: "Abas que hoje são exclusivas do garagista.",
    itens: [
      {
        chave: "vend_ver_leads",
        label: "Acessar Leads",
        hint: "Ver e trabalhar os leads recebidos pela mini-loja.",
        modulo: "leads",
      },
      {
        chave: "vend_gerador_whatsapp",
        label: "Acessar o Gerador de WhatsApp",
        hint: "Gerar o texto de anúncio pronto para enviar.",
        modulo: "whatsapp",
      },
    ],
  },
];

function extrair(seller: Seller): PermissoesInput {
  return {
    vend_ver_leads: seller.vend_ver_leads,
    vend_ver_financeiro: seller.vend_ver_financeiro,
    vend_ver_todas_vendas: seller.vend_ver_todas_vendas,
    vend_add_veiculo: seller.vend_add_veiculo,
    vend_editar_veiculo: seller.vend_editar_veiculo,
    vend_excluir_veiculo: seller.vend_excluir_veiculo,
    vend_gerador_whatsapp: seller.vend_gerador_whatsapp,
  };
}

function Toggle({
  checked,
  onChange,
  disabled,
  label,
  hint,
  aviso,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
  hint: string;
  aviso?: string;
}) {
  return (
    <label
      className={`flex items-start gap-3 rounded-xl border border-hair p-3.5 transition-colors ${
        disabled ? "opacity-60" : "cursor-pointer hover:border-brand/40 hover:bg-slate-50"
      }`}
    >
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 accent-brand"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="min-w-0">
        <span className="block text-[14px] font-semibold text-slate-900">{label}</span>
        <span className="mt-0.5 block text-[12.5px] leading-snug text-slate-500">{hint}</span>
        {aviso && (
          <span className="mt-1 block text-[12px] font-medium text-amber-600">{aviso}</span>
        )}
      </span>
    </label>
  );
}

/**
 * Permissões que valem para TODOS os vendedores da loja (não é por pessoa).
 * Ficam na linha da própria loja; a RLS da migration 0050 aplica as mesmas
 * regras no banco, então desmarcar aqui bloqueia de verdade, não só no menu.
 */
export function PermissoesEquipe() {
  const { seller, lojaId } = useAuth();
  const { data: acesso } = useAcesso(!!seller);
  const update = useUpdatePermissoes(lojaId ?? undefined);
  const [valores, setValores] = useState<PermissoesInput | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Ressincroniza quando o seller recarrega (ex.: após salvar).
  useEffect(() => {
    if (seller) setValores(extrair(seller));
  }, [seller]);

  if (!seller || !valores) return null;

  const salvo = extrair(seller);
  const sujo = (Object.keys(valores) as Chave[]).some((k) => valores[k] !== salvo[k]);

  async function salvar() {
    if (!valores) return;
    setFeedback(null);
    try {
      await update.mutateAsync(valores);
      setFeedback("Permissões atualizadas. Os vendedores veem a mudança no próximo carregamento.");
    } catch {
      /* erro exibido via update.isError */
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <h2 className="text-[15px] font-bold text-slate-900">
          O que os vendedores da loja podem fazer
        </h2>
        <p className="mt-1 text-[13.5px] text-slate-500">
          Vale para todos os vendedores convidados — inclusive os que já estão na equipe.
          O garagista continua com acesso total.
        </p>
      </Card>

      {update.isError && (
        <Alert variant="error">
          {update.error instanceof Error
            ? update.error.message
            : "Não foi possível salvar as permissões."}
        </Alert>
      )}
      {feedback && <Alert variant="success">{feedback}</Alert>}

      {GRUPOS.map((g) => (
        <Card key={g.titulo}>
          <h3 className="text-[14px] font-bold text-slate-900">{g.titulo}</h3>
          <p className="mt-0.5 text-[12.5px] text-slate-500">{g.descricao}</p>
          <div className="mt-3 grid grid-cols-1 gap-2.5 lg:grid-cols-2">
            {g.itens.map((i) => {
              // Se o plano da loja não inclui o módulo, a permissão não tem
              // efeito — deixa visível mas travada, com o motivo explícito.
              const semModulo = !!i.modulo && acesso?.modulos[i.modulo] === false;
              return (
                <Toggle
                  key={i.chave}
                  label={i.label}
                  hint={i.hint}
                  checked={valores[i.chave]}
                  disabled={semModulo || update.isPending}
                  aviso={semModulo ? "Indisponível no plano atual da loja." : undefined}
                  onChange={(v) => {
                    setFeedback(null);
                    setValores((s) => (s ? { ...s, [i.chave]: v } : s));
                  }}
                />
              );
            })}
          </div>
        </Card>
      ))}

      <div className="flex justify-end gap-3">
        <Button
          variant="ghost"
          disabled={!sujo || update.isPending}
          onClick={() => {
            setValores(salvo);
            setFeedback(null);
          }}
        >
          Descartar
        </Button>
        <Button onClick={salvar} loading={update.isPending} disabled={!sujo}>
          Salvar permissões
        </Button>
      </div>
    </div>
  );
}
