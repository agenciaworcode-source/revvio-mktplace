import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  useAdminSales,
  useAdminRemovals,
  useAdminSeller,
  useAdminUpdateSeller,
  useCharges,
  useSellerCommissions,
  useSetCommissionPaid,
  useSetSellerStatus,
} from "../queries";
import {
  ReasonSummary,
  SalesReasonTable,
  RemovalsReasonTable,
} from "../components/MovimentacoesPanels";
import { SALE_REASONS, REMOVAL_REASONS } from "@/components/ReasonField";
import { SELLER_STATUS_ACTIONS } from "../components";
import { StatusPill } from "@/components/panel";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Charge, CommissionStatus, Seller } from "@/lib/database.types";
import { Alert, Badge, Button, Card, Field, Input, Modal, PageHeader, Spinner } from "@/components/ui-light";
import { maskPhone } from "@/lib/masks";

/* ── Histórico de cobranças ─────────────────────────────── */
/* Mapeia o status bruto do ASAAS para rótulo PT + cor do Badge. */
function chargeStatusMeta(raw: string | null): {
  label: string;
  tone: "green" | "amber" | "red" | "neutral";
} {
  const s = (raw ?? "").toUpperCase();
  if (["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"].includes(s))
    return { label: "Pago", tone: "green" };
  if (["PENDING", "AWAITING_RISK_ANALYSIS", "AWAITING_PAYMENT"].includes(s))
    return { label: "Pendente", tone: "amber" };
  if (
    [
      "CANCELED",
      "CANCELLED",
      "REFUSED",
      "REFUNDED",
      "OVERDUE",
      "CHARGEBACK_REQUESTED",
      "CHARGEBACK_DISPUTE",
      "DUNNING_REQUESTED",
    ].includes(s)
  )
    return { label: s === "OVERDUE" ? "Atrasada" : "Cancelada", tone: "red" };
  return { label: raw ?? "—", tone: "neutral" };
}

/* Mantém só a cobrança mais recente por código ASAAS (asaas_id);
   linhas sem asaas_id são tratadas individualmente (chave = id). */
function dedupeCharges(charges: Charge[]): Charge[] {
  const ts = (c: Charge) => Date.parse(c.updated_at ?? c.created_at ?? "") || 0;
  const latest = new Map<string, Charge>();
  for (const c of charges) {
    const key = c.asaas_id || c.id;
    const prev = latest.get(key);
    if (!prev || ts(c) > ts(prev)) latest.set(key, c);
  }
  return [...latest.values()].sort((a, b) => ts(b) - ts(a));
}

function ChargesCard({ sellerId }: { sellerId: string }) {
  const { data, isLoading } = useCharges(sellerId);
  const rows = data ? dedupeCharges(data) : [];

  return (
    <Card className="p-0">
      <h2 className="px-6 pt-5 text-lg font-bold text-slate-900">Cobranças ASAAS</h2>
      {isLoading ? (
        <div className="flex justify-center py-8 text-slate-500">
          <Spinner />
        </div>
      ) : rows.length === 0 ? (
        <p className="px-6 py-5 text-sm text-slate-500">
          Nenhuma cobrança gerada ainda.
        </p>
      ) : (
        <table className="mt-3 w-full text-sm">
          <thead className="border-y border-slate-200 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-6 py-2 font-medium">Descrição</th>
              <th className="px-6 py-2 font-medium">Status</th>
              <th className="px-6 py-2 font-medium">Vencimento</th>
              <th className="px-6 py-2 text-right font-medium">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((c) => {
              const meta = chargeStatusMeta(c.status);
              return (
              <tr key={c.id}>
                <td className="px-6 py-2 text-slate-900">
                  {c.invoice_url ? (
                    <a
                      href={c.invoice_url}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-brand"
                    >
                      {c.description ?? "Cobrança"} ↗
                    </a>
                  ) : (
                    c.description ?? "Cobrança"
                  )}
                </td>
                <td className="px-6 py-2">
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                </td>
                <td className="px-6 py-2 text-slate-600">{formatDate(c.due_date)}</td>
                <td className="px-6 py-2 text-right font-semibold text-slate-900">
                  {formatCurrency(c.value)}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Card>
  );
}

/* ── Comissões de venda (marcar paga / reverter) ────────── */
const commissionMeta: Record<
  CommissionStatus,
  { label: string; tone: "amber" | "green" | "red" }
> = {
  pending: { label: "Pendente", tone: "amber" },
  paid: { label: "Paga", tone: "green" },
  overdue: { label: "Atrasada", tone: "red" },
};

function CommissionsCard({ sellerId }: { sellerId: string }) {
  const { data, isLoading } = useSellerCommissions(sellerId);
  const setPaid = useSetCommissionPaid();

  const total = (data ?? []).reduce((acc, c) => acc + Number(c.amount), 0);
  const pending = (data ?? [])
    .filter((c) => c.status !== "paid")
    .reduce((acc, c) => acc + Number(c.amount), 0);

  return (
    <Card className="p-0">
      <div className="flex items-center justify-between px-6 pt-5">
        <h2 className="text-lg font-bold text-slate-900">Comissões de venda</h2>
        <p className="text-sm text-slate-400">
          A receber:{" "}
          <span className="font-semibold text-slate-900">
            {formatCurrency(pending)}
          </span>{" "}
          · Total: {formatCurrency(total)}
        </p>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-8 text-slate-500">
          <Spinner />
        </div>
      ) : !data || data.length === 0 ? (
        <p className="px-6 py-5 text-sm text-slate-500">
          Nenhuma comissão gerada ainda (aparecem quando o vendedor registra vendas).
        </p>
      ) : (
        <table className="mt-3 w-full text-sm">
          <thead className="border-y border-slate-200 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-6 py-2 font-medium">Venda</th>
              <th className="px-6 py-2 font-medium">Status</th>
              <th className="px-6 py-2 font-medium">Vencimento</th>
              <th className="px-6 py-2 text-right font-medium">Valor</th>
              <th className="px-6 py-2 text-right font-medium">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((c) => (
              <tr key={c.id}>
                <td className="px-6 py-2 text-slate-900">
                  {c.sale?.buyer_name ?? "—"}
                  <span className="ml-2 text-xs text-slate-400">
                    {c.sale ? formatDate(c.sale.sale_date) : ""}
                  </span>
                </td>
                <td className="px-6 py-2">
                  <Badge tone={commissionMeta[c.status].tone}>
                    {commissionMeta[c.status].label}
                  </Badge>
                </td>
                <td className="px-6 py-2 text-slate-600">{formatDate(c.due_date)}</td>
                <td className="px-6 py-2 text-right font-semibold text-slate-900">
                  {formatCurrency(c.amount)}
                </td>
                <td className="px-6 py-2 text-right">
                  <Button
                    variant={c.status === "paid" ? "ghost" : "outline"}
                    className="px-3 py-1 text-xs"
                    loading={setPaid.isPending && setPaid.variables?.id === c.id}
                    onClick={() =>
                      setPaid.mutate({
                        id: c.id,
                        paid: c.status !== "paid",
                        sellerId,
                      })
                    }
                  >
                    {c.status === "paid" ? "Reverter" : "Marcar paga"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

/* ── Edição cadastral (admin) ───────────────────────────── */
function EditSellerModal({ seller, onClose }: { seller: Seller; onClose: () => void }) {
  const update = useAdminUpdateSeller();
  const [name, setName] = useState(seller.name);
  const [phone, setPhone] = useState(seller.phone ?? "");
  const [whatsapp, setWhatsapp] = useState(seller.whatsapp ?? "");
  const [city, setCity] = useState(seller.city ?? "");
  const [state, setState] = useState(seller.state ?? "");
  const [rate, setRate] = useState(String(seller.commission_rate ?? ""));

  async function save() {
    const parsedRate = Number(String(rate).replace(",", "."));
    try {
      await update.mutateAsync({
        id: seller.id,
        name: name.trim(),
        phone: phone || null,
        whatsapp: whatsapp || null,
        city: city.trim() || null,
        state: state.trim() || null,
        ...(Number.isFinite(parsedRate) && parsedRate >= 0
          ? { commission_rate: parsedRate }
          : {}),
      });
      onClose();
    } catch {
      /* erro exibido via update.isError */
    }
  }

  return (
    <Modal open onClose={onClose} title="Editar dados" closeOnBackdrop={false}>
      <div className="flex flex-col gap-4">
        <Field label="Nome">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Telefone">
            <Input
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(maskPhone(e.target.value))}
            />
          </Field>
          <Field label="WhatsApp">
            <Input
              inputMode="tel"
              value={whatsapp}
              onChange={(e) => setWhatsapp(maskPhone(e.target.value))}
            />
          </Field>
          <Field label="Cidade">
            <Input value={city} onChange={(e) => setCity(e.target.value)} />
          </Field>
          <Field label="Estado (UF)">
            <Input maxLength={2} value={state} onChange={(e) => setState(e.target.value.toUpperCase())} />
          </Field>
        </div>
        <Field label="Comissão (%)">
          <Input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
        </Field>
        {update.isError && (
          <Alert variant="error">
            {update.error instanceof Error ? update.error.message : "Erro ao salvar."}
          </Alert>
        )}
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={update.isPending}>
            Cancelar
          </Button>
          <Button onClick={save} loading={update.isPending} disabled={!name.trim()}>
            Salvar alterações
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ── Status da conta (aprovar / suspender / reativar) ───── */
function StatusCard({ seller }: { seller: Seller }) {
  const setStatus = useSetSellerStatus();
  const actions = SELLER_STATUS_ACTIONS[seller.status] ?? [];

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Status da conta</h2>
          <div className="mt-2">
            <StatusPill status={seller.status} />
          </div>
        </div>
        {actions.length > 0 && (
          <div className="flex gap-2">
            {actions.map((a) => (
              <Button
                key={a.to}
                variant={a.tone === "approve" ? "primary" : "danger"}
                loading={
                  setStatus.isPending && setStatus.variables?.status === a.to
                }
                disabled={setStatus.isPending}
                onClick={() => setStatus.mutate({ id: seller.id, status: a.to })}
              >
                {a.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

function SalesReasonCard({ sellerId }: { sellerId: string }) {
  const { data, isLoading } = useAdminSales({ sellerId });
  const rows = data ?? [];
  return (
    <Card className="p-0">
      <div className="flex items-center justify-between px-6 pt-5">
        <h3 className="text-sm font-semibold text-slate-900">Vendas</h3>
      </div>
      <div className="flex flex-col gap-3 p-6 pt-3">
        {isLoading ? (
          <div className="flex justify-center py-8 text-slate-500">
            <Spinner className="h-5 w-5" />
          </div>
        ) : (
          <>
            <ReasonSummary
              rows={rows.map((r) => ({ reason: r.sale_reason }))}
              reasons={SALE_REASONS}
            />
            <SalesReasonTable rows={rows} showSeller={false} />
          </>
        )}
      </div>
    </Card>
  );
}

function RemovalsReasonCard({ sellerId }: { sellerId: string }) {
  const { data, isLoading } = useAdminRemovals({ sellerId });
  const rows = data ?? [];
  return (
    <Card className="p-0">
      <div className="flex items-center justify-between px-6 pt-5">
        <h3 className="text-sm font-semibold text-slate-900">Veículos removidos</h3>
      </div>
      <div className="flex flex-col gap-3 p-6 pt-3">
        {isLoading ? (
          <div className="flex justify-center py-8 text-slate-500">
            <Spinner className="h-5 w-5" />
          </div>
        ) : (
          <>
            <ReasonSummary
              rows={rows.map((r) => ({ reason: r.removal_reason }))}
              reasons={REMOVAL_REASONS}
            />
            <RemovalsReasonTable rows={rows} showSeller={false} />
          </>
        )}
      </div>
    </Card>
  );
}

export function SellerDetail() {
  const { id } = useParams();
  const { data: seller, isLoading } = useAdminSeller(id);
  const [editing, setEditing] = useState(false);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16 text-slate-500">
        <Spinner />
      </div>
    );
  }

  if (!seller) {
    return (
      <div>
        <p className="text-slate-400">Vendedor não encontrado.</p>
        <Link to="/dashboard/sellers" className="text-sm text-brand hover:underline">
          ← Voltar
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Link
        to="/dashboard/sellers"
        className="text-sm text-slate-400 hover:text-slate-900"
      >
        ← Vendedores
      </Link>
      <PageHeader
        title={seller.name}
        subtitle={`${seller.email ?? "sem e-mail"} · ${
          seller.asaas_customer_id ? "cliente ASAAS vinculado" : "sem cliente ASAAS"
        }`}
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditing(true)}>
              Editar dados
            </Button>
            <a href={`/loja/${seller.slug}`} target="_blank" rel="noreferrer">
              <Button variant="outline">Ver mini-loja ↗</Button>
            </a>
          </div>
        }
      />

      {editing && <EditSellerModal seller={seller} onClose={() => setEditing(false)} />}

      <div className="flex flex-col gap-6">
        <StatusCard seller={seller} />
        <CommissionsCard sellerId={seller.id} />
        <ChargesCard sellerId={seller.id} />
        <SalesReasonCard sellerId={seller.id} />
        <RemovalsReasonCard sellerId={seller.id} />
      </div>
    </div>
  );
}
