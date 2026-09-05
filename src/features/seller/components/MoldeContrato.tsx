// ============================================================
// Molde de contrato da loja (Configurações de Perfil).
//
// Mesma ideia do editor de cláusulas do superadmin: um texto com tags entre
// colchetes que são trocadas pelos dados do formulário na hora de emitir. A
// diferença é que aqui ele fica salvo como o padrão da loja — todo contrato
// novo do garagista já abre com este texto em vez do modelo do sistema.
// ============================================================

import { useState } from "react";
import { Alert, Button, Card, Textarea } from "@/components/ui-light";
import { useAuth } from "@/features/auth/AuthProvider";
import { CONTRACT_TAGS, CONTRACT_TEMPLATES } from "@/features/contracts/templates";
import { useUpdateProfile } from "../queries";

const PADRAO = CONTRACT_TEMPLATES.compra_venda;

export function MoldeContrato() {
  const { seller, refreshSeller } = useAuth();
  const update = useUpdateProfile(seller);
  const [texto, setTexto] = useState(seller?.contract_template ?? PADRAO);
  const [feedback, setFeedback] = useState<
    { type: "success" | "error"; msg: string } | null
  >(null);

  async function salvar() {
    setFeedback(null);
    try {
      // Texto igual ao padrão volta a ser nulo: a loja não fica com uma cópia
      // congelada de um modelo que o sistema pode melhorar depois.
      const limpo = texto.trim();
      await update.mutateAsync({
        contract_template: !limpo || limpo === PADRAO.trim() ? null : texto,
      });
      await refreshSeller();
      setFeedback({ type: "success", msg: "Molde do contrato salvo." });
    } catch (e) {
      setFeedback({
        type: "error",
        msg: e instanceof Error ? e.message : "Erro ao salvar o molde.",
      });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {feedback && <Alert variant={feedback.type}>{feedback.msg}</Alert>}

      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-slate-800">
              Molde do contrato de compra e venda
            </p>
            <p className="text-xs text-slate-400">
              É o texto que abre em todo contrato novo da sua loja. Você ainda
              pode ajustar cláusula por cláusula na hora de emitir.
            </p>
          </div>
          <Button
            variant="ghost"
            onClick={() => {
              if (
                window.confirm(
                  "Voltar ao modelo padrão da Revvender descarta o molde da sua loja. Continuar?"
                )
              )
                setTexto(PADRAO);
            }}
          >
            Restaurar modelo padrão
          </Button>
        </div>

        <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-xs leading-relaxed text-slate-500">
          As tags entre colchetes são substituídas pelos dados preenchidos no
          contrato:{" "}
          <code className="font-mono text-slate-700">
            {CONTRACT_TAGS.map((t) => `[${t}]`).join(" ")}
          </code>
        </p>

        <Textarea
          rows={24}
          className="font-mono text-[13px] leading-relaxed"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />

        <div className="flex justify-end">
          <Button loading={update.isPending} onClick={salvar}>
            Salvar molde
          </Button>
        </div>
      </Card>
    </div>
  );
}
