import { useState } from "react";
import { useAuth } from "@/features/auth/AuthProvider";
import { useAffiliatePerformance, useSignalSale } from "../queries";
import { Alert, Button, Card, PageHeader, Spinner } from "@/components/ui-light";
import { formatCurrency } from "@/lib/format";

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-5">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
    </Card>
  );
}

export function Desempenho() {
  const { personId } = useAuth();
  const perfQ = useAffiliatePerformance(personId ?? undefined);
  const p = perfQ.data;
  const signal = useSignalSale();
  const [note, setNote] = useState("");
  const [signalMsg, setSignalMsg] = useState<string | null>(null);
  const [signalErr, setSignalErr] = useState(false);

  return (
    <div>
      <PageHeader
        title="Desempenho"
        subtitle="Seus compartilhamentos, cliques, vendas e comissões"
      />
      {perfQ.isError ? (
        <Alert variant="error">Não foi possível carregar o seu desempenho.</Alert>
      ) : perfQ.isLoading || !p ? (
        <div className="flex justify-center py-16 text-slate-500">
          <Spinner className="h-6 w-6" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <Metric label="Compartilhamentos" value={String(p.shares)} />
            <Metric label="Cliques recebidos" value={String(p.clicks)} />
            <Metric label="Vendas" value={String(p.salesCount)} />
            <Metric label="Volume vendido" value={formatCurrency(p.salesVolume)} />
            <Metric label="Comissão a receber" value={formatCurrency(p.commissionPending)} />
            <Metric label="Comissão recebida" value={formatCurrency(p.commissionPaid)} />
          </div>
          <Card className="mt-6 flex flex-col gap-3 p-5">
            <p className="text-sm font-semibold text-slate-900">Ajudou numa venda?</p>
            <p className="text-xs text-slate-500">
              Avise o garagista. Ele registra a venda e atribui a você.
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Observação (opcional): qual carro, qual comprador…"
              className="rounded-lg border border-slate-200 p-2 text-sm"
            />
            {signalMsg && <Alert variant={signalErr ? "error" : "success"}>{signalMsg}</Alert>}
            <div>
              <Button
                onClick={async () => {
                  try {
                    await signal.mutateAsync({ note: note || null });
                    setNote("");
                    setSignalErr(false);
                    setSignalMsg("Aviso enviado ao garagista.");
                  } catch {
                    setSignalErr(true);
                    setSignalMsg("Não foi possível enviar agora.");
                  }
                }}
                disabled={signal.isPending}
              >
                Avisei uma venda
              </Button>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
