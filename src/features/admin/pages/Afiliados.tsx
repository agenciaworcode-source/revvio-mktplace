import { useState } from "react";
import {
  useAdminAffiliateReport,
  useAdminDeleteSeller,
  useAdminSales,
  useAdminUpdateSeller,
  useSetSellerStatus,
  type AdminAffiliateRow,
} from "../queries";
import {
  Button,
  Card,
  Field,
  Modal,
  PageHeader,
  Select,
  Input,
  Badge,
  Alert,
  Spinner,
  EmptyState,
} from "@/components/ui-light";
import { formatCurrency, formatDate } from "@/lib/format";

function AffiliateSalesDrill({ affiliateId, from, to, name }: { affiliateId: string; from: string; to: string; name: string }) {
  const salesQ = useAdminSales({ affiliateId, from: from || undefined, to: to || undefined });
  const sales = salesQ.data ?? [];
  return (
    <Card className="mt-4 p-4">
      <p className="mb-3 text-sm font-semibold text-slate-900">Vendas de {name}</p>
      {salesQ.isLoading ? (
        <div className="flex justify-center py-6 text-slate-500"><Spinner className="h-5 w-5" /></div>
      ) : sales.length === 0 ? (
        <p className="text-sm text-slate-400">Nenhuma venda no período.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="border-b border-hair text-xs uppercase text-slate-500">
            <tr><th className="px-3 py-2 font-medium">Data</th><th className="px-3 py-2 font-medium">Comprador</th><th className="px-3 py-2 font-medium">Veículo</th><th className="px-3 py-2 font-medium">Valor</th></tr>
          </thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id} className="border-b border-hair last:border-0">
                <td className="px-3 py-2">{formatDate(s.sale_date)}</td>
                <td className="px-3 py-2">{s.buyer_name}</td>
                <td className="px-3 py-2">{s.vehicle_label}</td>
                <td className="px-3 py-2">{formatCurrency(s.sale_price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

/* ── Modais de edição/exclusão de afiliado (admin) ──────── */
function EditAffiliateModal({ row, onClose }: { row: AdminAffiliateRow; onClose: () => void }) {
  const update = useAdminUpdateSeller();
  const [name, setName] = useState(row.name);
  const [rate, setRate] = useState(String(row.rate));

  async function save() {
    const parsed = Number(String(rate).replace(",", "."));
    try {
      await update.mutateAsync({
        id: row.affiliateId,
        name: name.trim(),
        ...(Number.isFinite(parsed) && parsed >= 0 ? { commission_rate: parsed } : {}),
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
            Salvar
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function DeleteAffiliateModal({ row, onClose }: { row: AdminAffiliateRow; onClose: () => void }) {
  const del = useAdminDeleteSeller();

  async function confirm() {
    try {
      await del.mutateAsync(row.affiliateId);
      onClose();
    } catch {
      /* erro via del.isError */
    }
  }

  return (
    <Modal open onClose={onClose} title="Excluir afiliado">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-slate-600">
          Excluir o afiliado <strong className="text-slate-900">{row.name}</strong>{" "}
          (garagista {row.garagistaName})? Essa ação não pode ser desfeita. Afiliados com
          vendas registradas não podem ser excluídos.
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

export function Afiliados() {
  const [garagistaId, setGaragistaId] = useState("");
  const [affiliateId, setAffiliateId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminAffiliateRow | null>(null);
  const [deleting, setDeleting] = useState<AdminAffiliateRow | null>(null);
  const setStatus = useSetSellerStatus();
  const q = useAdminAffiliateReport({
    garagistaId: garagistaId || undefined,
    affiliateId: affiliateId || undefined,
    from: from || undefined,
    to: to || undefined,
  });
  const data = q.data;
  const rows = data?.rows ?? [];
  // opções de dropdown derivadas (sem filtro de afiliado aplicado, garagista pode estar aplicado)
  const garagistas = Array.from(
    new Map(rows.map((r) => [r.garagistaId, r.garagistaName])).entries()
  ).filter(([id]) => id);

  return (
    <div>
      <PageHeader
        title="Afiliados"
        subtitle="Visão global dos afiliados de todos os garagistas"
      />
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Select
          value={garagistaId}
          onChange={(e) => {
            setGaragistaId(e.target.value);
            setAffiliateId("");
          }}
        >
          <option value="">Todos os garagistas</option>
          {garagistas.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </Select>
        <Select
          value={affiliateId}
          onChange={(e) => setAffiliateId(e.target.value)}
        >
          <option value="">Todos os afiliados</option>
          {rows.map((r) => (
            <option key={r.affiliateId} value={r.affiliateId}>
              {r.name}
            </option>
          ))}
        </Select>
        <Input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <Input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
      </div>

      {q.isError ? (
        <Alert variant="error">Não foi possível carregar o relatório.</Alert>
      ) : q.isLoading || !data ? (
        <div className="flex justify-center py-16 text-slate-500">
          <Spinner className="h-6 w-6" />
        </div>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card className="p-4">
              <p className="text-xs uppercase text-slate-500">
                Vendas por afiliados
              </p>
              <p className="mt-1 text-2xl font-semibold">
                {data.kpis.totalSalesCount}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs uppercase text-slate-500">Volume (R$)</p>
              <p className="mt-1 text-2xl font-semibold">
                {formatCurrency(data.kpis.totalSalesVolume)}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs uppercase text-slate-500">
                Afiliados ativos
              </p>
              <p className="mt-1 text-2xl font-semibold">
                {data.kpis.activeAffiliates}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs uppercase text-slate-500">
                Comissões a pagar
              </p>
              <p className="mt-1 text-2xl font-semibold">
                {formatCurrency(data.kpis.commissionPending)}
              </p>
            </Card>
          </div>

          <div className="mb-5 grid grid-cols-1 gap-3 lg:grid-cols-3">
            <Card className="p-4">
              <p className="mb-2 text-xs uppercase text-slate-500">Top afiliados — volume</p>
              {data.topByVolume.filter((r) => r.salesVolume > 0).length === 0 ? (
                <p className="text-sm text-slate-400">Sem vendas no período.</p>
              ) : (
                <ol className="flex flex-col gap-1 text-sm">
                  {data.topByVolume.filter((r) => r.salesVolume > 0).map((r, i) => (
                    <li key={r.affiliateId} className="flex justify-between">
                      <span className="truncate">{i + 1}. {r.name}</span>
                      <span className="font-medium">{formatCurrency(r.salesVolume)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
            <Card className="p-4">
              <p className="mb-2 text-xs uppercase text-slate-500">Top afiliados — nº de vendas</p>
              {data.topByCount.filter((r) => r.salesCount > 0).length === 0 ? (
                <p className="text-sm text-slate-400">Sem vendas no período.</p>
              ) : (
                <ol className="flex flex-col gap-1 text-sm">
                  {data.topByCount.filter((r) => r.salesCount > 0).map((r, i) => (
                    <li key={r.affiliateId} className="flex justify-between">
                      <span className="truncate">{i + 1}. {r.name}</span>
                      <span className="font-medium">{r.salesCount}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
            <Card className="p-4">
              <p className="mb-2 text-xs uppercase text-slate-500">Garagistas que mais usam afiliados</p>
              {data.topGaragistas.filter((g) => g.salesVolume > 0).length === 0 ? (
                <p className="text-sm text-slate-400">Sem vendas no período.</p>
              ) : (
                <ol className="flex flex-col gap-1 text-sm">
                  {data.topGaragistas.filter((g) => g.salesVolume > 0).map((g, i) => (
                    <li key={g.garagistaId} className="flex justify-between">
                      <span className="truncate">{i + 1}. {g.garagistaName}</span>
                      <span className="font-medium">{formatCurrency(g.salesVolume)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          </div>

          {rows.length === 0 ? (
            <EmptyState
              title="Sem dados"
              description="Nenhum afiliado com atividade no período/filtro."
            />
          ) : (
            <>
              <Card className="overflow-x-auto p-0">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-hair text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Afiliado</th>
                      <th className="px-4 py-3 font-medium">Garagista</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Taxa</th>
                      <th className="px-4 py-3 font-medium">Cliques</th>
                      <th className="px-4 py-3 font-medium">Vendas</th>
                      <th className="px-4 py-3 font-medium">Volume</th>
                      <th className="px-4 py-3 font-medium">Com. pend.</th>
                      <th className="px-4 py-3 font-medium">Com. paga</th>
                      <th className="px-4 py-3 text-right font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr
                        key={r.affiliateId}
                        className="cursor-pointer border-b border-hair last:border-0 hover:bg-slate-50"
                        onClick={() => setExpandedId(expandedId === r.affiliateId ? null : r.affiliateId)}
                      >
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {r.name}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {r.garagistaName}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            tone={r.status === "active" ? "green" : "neutral"}
                          >
                            {r.status === "active" ? "Ativo" : "Inativo"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">{r.rate}%</td>
                        <td className="px-4 py-3">{r.clicks}</td>
                        <td className="px-4 py-3">{r.salesCount}</td>
                        <td className="px-4 py-3">
                          {formatCurrency(r.salesVolume)}
                        </td>
                        <td className="px-4 py-3">
                          {formatCurrency(r.commissionPending)}
                        </td>
                        <td className="px-4 py-3">
                          {formatCurrency(r.commissionPaid)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div
                            className="flex justify-end gap-1.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button
                              variant="outline"
                              className="px-2.5 py-1 text-xs"
                              onClick={() => setEditing(r)}
                            >
                              Editar
                            </Button>
                            <Button
                              variant="outline"
                              className="px-2.5 py-1 text-xs"
                              disabled={setStatus.isPending}
                              onClick={() =>
                                setStatus.mutate(
                                  {
                                    id: r.affiliateId,
                                    status: r.status === "active" ? "suspended" : "active",
                                  },
                                  {
                                    onSuccess: () => q.refetch(),
                                  }
                                )
                              }
                            >
                              {r.status === "active" ? "Suspender" : "Ativar"}
                            </Button>
                            <Button
                              variant="danger"
                              className="px-2.5 py-1 text-xs"
                              onClick={() => setDeleting(r)}
                            >
                              Excluir
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
              {expandedId && (
                <AffiliateSalesDrill affiliateId={expandedId} from={from} to={to} name={rows.find((r) => r.affiliateId === expandedId)?.name ?? ""} />
              )}
            </>
          )}
        </>
      )}

      {editing && <EditAffiliateModal row={editing} onClose={() => setEditing(null)} />}
      {deleting && <DeleteAffiliateModal row={deleting} onClose={() => setDeleting(null)} />}
    </div>
  );
}
