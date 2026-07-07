import { useAuth } from "@/features/auth/AuthProvider";
import {
  useCommissions,
  useLojaCommissions,
  useMarkCommission,
  useMyCharges,
} from "../queries";
import { formatCurrency, formatDate } from "@/lib/format";
import type { CommissionStatus } from "@/lib/database.types";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Spinner,
  StatCard,
} from "@/components/ui-light";

/* Status bruto do ASAAS → rótulo + tom + se está em aberto (link de pagamento). */
function asaasStatusMeta(status: string): {
  label: string;
  tone: "amber" | "green" | "red" | "neutral";
  open: boolean;
} {
  switch (status) {
    case "RECEIVED":
    case "CONFIRMED":
    case "RECEIVED_IN_CASH":
      return { label: "Paga", tone: "green", open: false };
    case "OVERDUE":
      return { label: "Vencida", tone: "red", open: true };
    case "PENDING":
    case "AWAITING_PAYMENT":
    case "AWAITING_RISK_ANALYSIS":
      return { label: "Em aberto", tone: "amber", open: true };
    case "REFUNDED":
    case "REFUND_REQUESTED":
      return { label: "Estornada", tone: "neutral", open: false };
    default:
      return { label: status, tone: "neutral", open: false };
  }
}

const billingLabels: Record<string, string> = {
  PIX: "Pix",
  BOLETO: "Boleto",
  CREDIT_CARD: "Cartão",
  UNDEFINED: "—",
};

/* ── Faturas da assinatura do garagista no ASAAS ─ */
function AsaasInvoices({ lojaId }: { lojaId?: string }) {
  const { data, isLoading } = useMyCharges(lojaId);

  return (
    <section className="mt-10">
      <h2 className="mb-1 text-lg font-bold text-slate-900">Minha assinatura (ASAAS)</h2>
      <p className="mb-3 text-sm text-slate-500">
        Faturas do seu plano na plataforma. Pague as que estiverem em aberto pelo link.
      </p>
      {isLoading ? (
        <div className="flex justify-center py-10 text-slate-500">
          <Spinner />
        </div>
      ) : !data || data.length === 0 ? (
        <EmptyState
          title="Nenhuma fatura ainda"
          description="Suas cobranças do plano aparecem aqui assim que forem geradas."
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Descrição</th>
                <th className="px-5 py-3 font-medium">Forma</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Vencimento</th>
                <th className="px-5 py-3 text-right font-medium">Valor</th>
                <th className="px-5 py-3 text-right font-medium">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((ch) => {
                const meta = asaasStatusMeta(ch.status);
                return (
                  <tr key={ch.id}>
                    <td className="px-5 py-3 text-slate-900">
                      {ch.description || "Plano Revvio"}
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {ch.billing_type ? billingLabels[ch.billing_type] ?? ch.billing_type : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{formatDate(ch.due_date)}</td>
                    <td className="px-5 py-3 text-right font-semibold text-slate-900">
                      {formatCurrency(ch.value)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {meta.open && ch.invoice_url ? (
                        <a href={ch.invoice_url} target="_blank" rel="noreferrer">
                          <Button className="px-3 py-1 text-xs">Pagar fatura ↗</Button>
                        </a>
                      ) : ch.invoice_url ? (
                        <a
                          href={ch.invoice_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-brand hover:underline"
                        >
                          Ver fatura ↗
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </section>
  );
}

const statusMeta: Record<
  CommissionStatus,
  { label: string; tone: "amber" | "green" | "red" }
> = {
  pending: { label: "Pendente", tone: "amber" },
  paid: { label: "Paga", tone: "green" },
  overdue: { label: "Atrasada", tone: "red" },
};

const sumBy = (
  rows: { status: CommissionStatus; amount: number | string }[] | undefined,
  s: CommissionStatus
) => rows?.filter((c) => c.status === s).reduce((a, c) => a + Number(c.amount), 0) ?? 0;

/* ── Visão do garagista: comissões da loja, por vendedor, com baixa ─ */
function LojaView({ lojaId }: { lojaId?: string }) {
  const { data, isLoading } = useLojaCommissions(lojaId);
  const mark = useMarkCommission(lojaId);

  return (
    <div>
      <PageHeader
        title="Financeiro"
        subtitle="Comissões da equipe sobre as vendas da loja. Dê baixa quando acertar com o vendedor."
      />
      {isLoading ? (
        <div className="flex justify-center py-16 text-slate-500">
          <Spinner />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="A pagar (pendente)" value={formatCurrency(sumBy(data, "pending"))} />
            <StatCard label="Pagas" value={formatCurrency(sumBy(data, "paid"))} />
            <StatCard label="Atrasadas" value={formatCurrency(sumBy(data, "overdue"))} />
          </div>
          <h2 className="mb-3 mt-10 text-lg font-bold text-slate-900">Comissões da loja</h2>
          {!data || data.length === 0 ? (
            <EmptyState
              title="Sem comissões ainda"
              description="Aparecem conforme a equipe registra vendas."
            />
          ) : (
            <Card className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Vendedor</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Vencimento</th>
                    <th className="px-5 py-3 text-right font-medium">Valor</th>
                    <th className="px-5 py-3 text-right font-medium">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.map((c) => (
                    <tr key={c.id}>
                      <td className="px-5 py-3 text-slate-900">{c.vendedor?.name ?? "—"}</td>
                      <td className="px-5 py-3">
                        <Badge tone={statusMeta[c.status].tone}>
                          {statusMeta[c.status].label}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-slate-600">{formatDate(c.due_date)}</td>
                      <td className="px-5 py-3 text-right font-semibold text-slate-900">
                        {formatCurrency(c.amount)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Button
                          variant={c.status === "paid" ? "ghost" : "outline"}
                          className="px-3 py-1 text-xs"
                          loading={mark.isPending && mark.variables?.id === c.id}
                          onClick={() => mark.mutate({ id: c.id, paid: c.status !== "paid" })}
                        >
                          {c.status === "paid" ? "Reverter" : "Marcar paga"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          <AsaasInvoices lojaId={lojaId} />
        </>
      )}
    </div>
  );
}

/* ── Visão do vendedor: as próprias comissões (somente leitura) ─ */
function VendedorView({ personId, rate }: { personId?: string; rate: number }) {
  const { data, isLoading } = useCommissions(personId);

  return (
    <div>
      <PageHeader
        title="Financeiro"
        subtitle={`Suas comissões pelas vendas intermediadas (taxa atual: ${rate}%).`}
      />
      {isLoading ? (
        <div className="flex justify-center py-16 text-slate-500">
          <Spinner />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="A receber" value={formatCurrency(sumBy(data, "pending"))} />
            <StatCard label="Pagas" value={formatCurrency(sumBy(data, "paid"))} />
            <StatCard label="Atrasadas" value={formatCurrency(sumBy(data, "overdue"))} />
          </div>
          <h2 className="mb-3 mt-10 text-lg font-bold text-slate-900">
            Histórico de comissões
          </h2>
          {!data || data.length === 0 ? (
            <EmptyState
              title="Sem comissões ainda"
              description="Aparecem conforme você registra vendas."
            />
          ) : (
            <Card className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Vencimento</th>
                    <th className="px-5 py-3 font-medium">Pago em</th>
                    <th className="px-5 py-3 text-right font-medium">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.map((c) => (
                    <tr key={c.id}>
                      <td className="px-5 py-3">
                        <Badge tone={statusMeta[c.status].tone}>
                          {statusMeta[c.status].label}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-slate-600">{formatDate(c.due_date)}</td>
                      <td className="px-5 py-3 text-slate-600">{formatDate(c.paid_at)}</td>
                      <td className="px-5 py-3 text-right font-semibold text-slate-900">
                        {formatCurrency(c.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

export function Financial() {
  const { seller, lojaId, personId, isVendedor } = useAuth();
  if (isVendedor)
    return <VendedorView personId={personId ?? undefined} rate={seller?.commission_rate ?? 0} />;
  return <LojaView lojaId={lojaId ?? undefined} />;
}
