import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/features/auth/AuthProvider";
import {
  useAffiliateSaleSignals,
  useAffiliates,
  useAffiliatesEnabled,
  useDeleteAffiliate,
  useInviteAffiliate,
  useLojaAffiliateReport,
  useSetAffiliateRate,
  useSetAffiliateStatus,
  useUpdateAffiliate,
} from "../queries";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Spinner,
} from "@/components/ui-light";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Seller } from "@/lib/database.types";

const schema = z.object({
  name: z.string().min(2, "Informe o nome"),
  email: z.string().email("E-mail inválido"),
  commission_rate: z.coerce.number().min(0).max(100),
});
type FormValues = z.infer<typeof schema>;

function InviteForm({ lojaId, onClose }: { lojaId?: string; onClose: () => void }) {
  const invite = useInviteAffiliate(lojaId);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { commission_rate: 5 },
  });

  async function onSubmit(values: FormValues) {
    setError(null);
    try {
      await invite.mutateAsync(values);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao convidar o afiliado.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      {error && <Alert variant="error">{error}</Alert>}
      <Field label="Nome" htmlFor="name" error={errors.name?.message}>
        <Input id="name" placeholder="Nome do afiliado" {...register("name")} />
      </Field>
      <Field label="E-mail" htmlFor="email" error={errors.email?.message}>
        <Input id="email" type="email" placeholder="email@exemplo.com" {...register("email")} />
      </Field>
      <Field label="Comissão (%)" htmlFor="commission_rate" error={errors.commission_rate?.message}>
        <Input id="commission_rate" type="number" step="0.5" {...register("commission_rate")} />
      </Field>
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={invite.isPending}>
          {invite.isPending ? "Convidando…" : "Convidar afiliado"}
        </Button>
      </div>
    </form>
  );
}

/* ── Editar dados cadastrais do afiliado ────────────────── */
function EditAffiliateModal({ a, lojaId, onClose }: { a: Seller; lojaId?: string; onClose: () => void }) {
  const update = useUpdateAffiliate(lojaId);
  const [name, setName] = useState(a.name);
  const [phone, setPhone] = useState(a.phone ?? "");
  const [whatsapp, setWhatsapp] = useState(a.whatsapp ?? "");

  async function save() {
    try {
      await update.mutateAsync({
        id: a.id,
        name: name.trim(),
        phone: phone.trim() || null,
        whatsapp: whatsapp.trim() || null,
      });
      onClose();
    } catch {
      /* erro via update.isError */
    }
  }

  return (
    <Modal open onClose={onClose} title="Editar afiliado" closeOnBackdrop={false}>
      <div className="flex flex-col gap-4">
        <Field label="Nome">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="E-mail">
          <Input value={a.email ?? ""} disabled />
        </Field>
        <Field label="Telefone">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(00) 00000-0000" />
        </Field>
        <Field label="WhatsApp">
          <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="(00) 00000-0000" />
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
            Salvar
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ── Excluir afiliado ───────────────────────────────────── */
function DeleteAffiliateModal({ a, lojaId, onClose }: { a: Seller; lojaId?: string; onClose: () => void }) {
  const del = useDeleteAffiliate(lojaId);

  async function confirm() {
    try {
      await del.mutateAsync(a.id);
      onClose();
    } catch {
      /* erro via del.isError */
    }
  }

  return (
    <Modal open onClose={onClose} title="Excluir afiliado">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-slate-600">
          Excluir o afiliado <strong className="text-slate-900">{a.name}</strong>? Essa ação não
          pode ser desfeita. Afiliados com vendas registradas não podem ser excluídos.
        </p>
        {del.isError && (
          <Alert variant="error">
            {del.error instanceof Error ? del.error.message : "Não foi possível excluir."}
          </Alert>
        )}
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={del.isPending}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={confirm} loading={del.isPending}>
            Excluir
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function AffiliateRow({ a, lojaId }: { a: Seller; lojaId?: string }) {
  const setRate = useSetAffiliateRate(lojaId);
  const setStatus = useSetAffiliateStatus(lojaId);
  const [rate, setRateValue] = useState(String(a.commission_rate ?? 0));
  const [rowError, setRowError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const suspended = a.status === "suspended";

  useEffect(() => {
    setRateValue(String(a.commission_rate ?? 0));
  }, [a.commission_rate]);

  return (
    <tr>
      <td className="px-5 py-3 font-medium text-slate-900">
        {a.name}
        <span className="block text-xs text-slate-500">{a.email}</span>
        {rowError && <span className="block text-xs text-red-600">{rowError}</span>}
      </td>
      <td className="px-5 py-3">
        <div className="flex items-center gap-2">
          <Input
            type="number"
            step="0.5"
            value={rate}
            onChange={(e) => setRateValue(e.target.value)}
            className="w-20"
          />
          <Button
            variant="outline"
            disabled={setRate.isPending || Number(rate) === Number(a.commission_rate)}
            onClick={() => {
              setRowError(null);
              setRate.mutate({ id: a.id, rate: Number(rate) }, { onError: (e) => setRowError(e instanceof Error ? e.message : "Erro ao salvar a comissão.") });
            }}
          >
            Salvar
          </Button>
        </div>
      </td>
      <td className="px-5 py-3">
        <Badge tone={suspended ? "red" : "green"}>{suspended ? "Suspenso" : "Ativo"}</Badge>
      </td>
      <td className="px-5 py-3 text-slate-500">{a.created_at ? formatDate(a.created_at) : "—"}</td>
      <td className="px-5 py-3 text-right">
        <div className="flex justify-end gap-1.5">
          <Button variant="outline" onClick={() => setEditing(true)}>
            Editar
          </Button>
          <Button
            variant="outline"
            disabled={setStatus.isPending}
            onClick={() => {
              setRowError(null);
              setStatus.mutate({ id: a.id, status: suspended ? "active" : "suspended" }, { onError: (e) => setRowError(e instanceof Error ? e.message : "Erro ao atualizar o status.") });
            }}
          >
            {suspended ? "Reativar" : "Suspender"}
          </Button>
          <Button variant="danger" onClick={() => setDeleting(true)}>
            Excluir
          </Button>
        </div>
        {editing && <EditAffiliateModal a={a} lojaId={lojaId} onClose={() => setEditing(false)} />}
        {deleting && <DeleteAffiliateModal a={a} lojaId={lojaId} onClose={() => setDeleting(false)} />}
      </td>
    </tr>
  );
}

export function Afiliados() {
  const { lojaId, seller, isGaragista, isAdmin } = useAuth();
  const enabledQ = useAffiliatesEnabled(seller?.pricing_plan_key);
  const affiliatesQ = useAffiliates(lojaId ?? undefined);
  const signals = useAffiliateSaleSignals(lojaId ?? undefined);
  const [open, setOpen] = useState(false);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [affiliateId, setAffiliateId] = useState("");
  const report = useLojaAffiliateReport(lojaId ?? undefined, {
    affiliateId: affiliateId || undefined,
    from: from || undefined,
    to: to || undefined,
  });
  const rows = report.data ?? [];
  const totals = rows.reduce(
    (acc, r) => ({
      salesCount: acc.salesCount + r.salesCount,
      salesVolume: acc.salesVolume + r.salesVolume,
      commissionPending: acc.commissionPending + r.commissionPending,
    }),
    { salesCount: 0, salesVolume: 0, commissionPending: 0 }
  );

  if (!isGaragista && !isAdmin) {
    return <p className="py-16 text-center text-slate-500">Área exclusiva do garagista.</p>;
  }

  const enabled = isAdmin || enabledQ.data === true;

  return (
    <div>
      <PageHeader
        title="Afiliados"
        subtitle="Convide afiliados para divulgar e vender os seus carros"
        action={
          enabled ? (
            <Button onClick={() => setOpen(true)}>Convidar afiliado</Button>
          ) : undefined
        }
      />

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Visão geral dos afiliados</h2>
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Select value={affiliateId} onChange={(e) => setAffiliateId(e.target.value)}>
            <option value="">Todos os afiliados</option>
            {(affiliatesQ.data ?? []).map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </Select>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
          <Card className="p-4"><p className="text-xs uppercase text-slate-500">Vendas geradas</p><p className="mt-1 text-2xl font-semibold">{totals.salesCount}</p></Card>
          <Card className="p-4"><p className="text-xs uppercase text-slate-500">Volume</p><p className="mt-1 text-2xl font-semibold">{formatCurrency(totals.salesVolume)}</p></Card>
          <Card className="p-4"><p className="text-xs uppercase text-slate-500">Comissões a pagar</p><p className="mt-1 text-2xl font-semibold">{formatCurrency(totals.commissionPending)}</p></Card>
        </div>
        {report.isError ? (
          <Alert variant="error">Não foi possível carregar o relatório.</Alert>
        ) : report.isLoading ? (
          <div className="flex justify-center py-8 text-slate-500"><Spinner className="h-5 w-5" /></div>
        ) : rows.length === 0 ? (
          <EmptyState title="Sem dados" description="Nenhum afiliado com atividade no período." />
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-hair text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Afiliado</th>
                  <th className="px-4 py-3 font-medium">Comp.</th>
                  <th className="px-4 py-3 font-medium">Cliques</th>
                  <th className="px-4 py-3 font-medium">Vendas</th>
                  <th className="px-4 py-3 font-medium">Volume</th>
                  <th className="px-4 py-3 font-medium">Com. pend.</th>
                  <th className="px-4 py-3 font-medium">Com. paga</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.affiliateId} className="border-b border-hair last:border-0">
                    <td className="px-4 py-3 font-medium text-slate-900">{r.name}</td>
                    <td className="px-4 py-3">{r.shares}</td>
                    <td className="px-4 py-3">{r.clicks}</td>
                    <td className="px-4 py-3">{r.salesCount}</td>
                    <td className="px-4 py-3">{formatCurrency(r.salesVolume)}</td>
                    <td className="px-4 py-3">{formatCurrency(r.commissionPending)}</td>
                    <td className="px-4 py-3">{formatCurrency(r.commissionPaid)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>

      {!isAdmin && enabledQ.isLoading ? (
        <div className="flex justify-center py-16 text-slate-500">
          <Spinner className="h-6 w-6" />
        </div>
      ) : !enabled ? (
        <Alert variant="info">
          O recurso de <strong>afiliados</strong> não está incluído no seu plano atual. Faça upgrade
          para convidar afiliados e ampliar a divulgação dos seus veículos.
        </Alert>
      ) : affiliatesQ.isLoading ? (
        <div className="flex justify-center py-16 text-slate-500">
          <Spinner className="h-6 w-6" />
        </div>
      ) : affiliatesQ.isError ? (
        <Alert variant="error">Não foi possível carregar os afiliados. Tente novamente.</Alert>
      ) : (affiliatesQ.data ?? []).length === 0 ? (
        <EmptyState
          title="Nenhum afiliado ainda"
          description="Convide o primeiro afiliado para começar."
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Afiliado</th>
                <th className="px-5 py-3 font-medium">Comissão (%)</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Desde</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(affiliatesQ.data ?? []).map((a) => (
                <AffiliateRow key={a.id} a={a} lojaId={lojaId ?? undefined} />
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {(signals.data ?? []).length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Vendas sinalizadas</h2>
          <div className="flex flex-col gap-2">
            {(signals.data ?? []).map((s) => (
              <Card key={s.id} className="flex flex-col gap-1 p-4 text-sm">
                <span className="font-semibold text-slate-900">
                  {s.affiliate_name ?? "Afiliado"}
                  {s.vehicle_label ? ` · ${s.vehicle_label}` : ""}
                </span>
                {s.note && <span className="text-slate-600">{s.note}</span>}
                <span className="text-xs text-slate-400">
                  {new Date(s.created_at).toLocaleDateString("pt-BR")}
                </span>
              </Card>
            ))}
          </div>
        </section>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Convidar afiliado" closeOnBackdrop={false}>
        {open && <InviteForm lojaId={lojaId ?? undefined} onClose={() => setOpen(false)} />}
      </Modal>
    </div>
  );
}
