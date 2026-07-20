import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Spinner,
  Badge,
} from "@/components/ui-light";
import { Icon } from "@/features/public/components/icons";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  useAdminContracts,
  useDeleteContract,
  type Contract,
  type ContractFilters,
} from "../contracts/queries";
import { CONTRACT_TYPE_LABEL, CONTRACT_TYPE_OPTIONS } from "../contracts/templates";

/** Exporta as linhas filtradas no formato do relatório contábil.
 *  Separador `;` + BOM: abre direto no Excel pt-BR sem desconfigurar. */
function exportCsv(rows: Contract[]) {
  const header = [
    "Nome do Cliente",
    "CPF/CNPJ",
    "Tipo de Contrato",
    "Valor Total da Venda",
    "Valor da Comissão Retida",
    "Data de Emissão",
  ];
  const cell = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const num = (v: number) => String(Number(v ?? 0).toFixed(2)).replace(".", ",");
  const lines = rows.map((c) =>
    [
      cell(c.vendedor_name),
      cell(c.vendedor_cpf_cnpj),
      cell(CONTRACT_TYPE_LABEL[c.contract_type]),
      num(c.sale_value),
      num(c.commission_value),
      cell(formatDate(c.created_at)),
    ].join(";")
  );
  const csv = "﻿" + [header.join(";"), ...lines].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `contratos-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const TYPE_TONE = {
  intermediacao: "sky",
  compra_venda: "green",
  procuracao: "amber",
} as const;

export function Contratos() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<ContractFilters>({});
  const [deleting, setDeleting] = useState<Contract | null>(null);
  const [printing, setPrinting] = useState<Contract | null>(null);
  const contractsQ = useAdminContracts(filters);
  const deleteMut = useDeleteContract();
  const rows = contractsQ.data ?? [];

  /* Imprime direto da lista: monta a folha no <body> (mesmo portal do
     editor), espera o paint e chama print. Sai do modo ao terminar. */
  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(null);
    window.addEventListener("afterprint", done);
    const frame = requestAnimationFrame(() => window.print());
    return () => {
      window.removeEventListener("afterprint", done);
      cancelAnimationFrame(frame);
    };
  }, [printing]);

  async function confirmDelete() {
    if (!deleting) return;
    await deleteMut.mutateAsync(deleting);
    setDeleting(null);
  }

  return (
    <div>
      <PageHeader
        title="Contratos"
        subtitle="Emissão digital de contratos e relatório contábil"
        action={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => exportCsv(rows)}
              disabled={!rows.length}
            >
              <Icon name="download" size={17} /> Exportar CSV
            </Button>
            <Button onClick={() => navigate("/dashboard/contratos/novo")}>
              <Icon name="plus" size={17} /> Novo contrato
            </Button>
          </div>
        }
      />

      <Card className="mb-4 flex flex-wrap items-end gap-4">
        <Field label="Cliente (nome ou CPF/CNPJ)">
          <Input
            placeholder="Buscar vendedor ou comprador…"
            value={filters.search ?? ""}
            onChange={(e) =>
              setFilters({ ...filters, search: e.target.value || undefined })
            }
            className="min-w-[240px]"
          />
        </Field>
        <Field label="Tipo de documento">
          <Select
            value={filters.type ?? ""}
            onChange={(e) =>
              setFilters({
                ...filters,
                type: (e.target.value || undefined) as ContractFilters["type"],
              })
            }
          >
            <option value="">Todos</option>
            {CONTRACT_TYPE_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>
                {CONTRACT_TYPE_LABEL[t.value]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Emitido de">
          <Input
            type="date"
            value={filters.from ?? ""}
            onChange={(e) =>
              setFilters({ ...filters, from: e.target.value || undefined })
            }
          />
        </Field>
        <Field label="Até">
          <Input
            type="date"
            value={filters.to ?? ""}
            onChange={(e) =>
              setFilters({ ...filters, to: e.target.value || undefined })
            }
          />
        </Field>
        <Button variant="outline" onClick={() => setFilters({})}>
          Limpar
        </Button>
      </Card>

      {contractsQ.isLoading ? (
        <div className="flex justify-center py-12 text-slate-500">
          <Spinner className="h-6 w-6" />
        </div>
      ) : !rows.length ? (
        <EmptyState
          title="Nenhum contrato encontrado"
          description="Emita o primeiro contrato digital para eliminar o preenchimento manual."
          action={
            <Button onClick={() => navigate("/dashboard/contratos/novo")}>
              <Icon name="plus" size={17} /> Novo contrato
            </Button>
          }
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hair text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3.5">Emissão</th>
                <th className="px-5 py-3.5">Tipo</th>
                <th className="px-5 py-3.5">Vendedor</th>
                <th className="px-5 py-3.5">CPF/CNPJ</th>
                <th className="px-5 py-3.5">Veículo</th>
                <th className="px-5 py-3.5 text-right">Valor da venda</th>
                <th className="px-5 py-3.5 text-right">Comissão</th>
                <th className="px-5 py-3.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-hair last:border-0 hover:bg-slate-50"
                >
                  <td className="px-5 py-3 text-slate-500">
                    {formatDate(c.created_at)}
                  </td>
                  <td className="px-5 py-3">
                    <Badge tone={TYPE_TONE[c.contract_type]}>
                      {CONTRACT_TYPE_LABEL[c.contract_type]}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 font-semibold text-slate-800">
                    <Link
                      to={`/dashboard/contratos/${c.id}`}
                      className="hover:text-brand"
                    >
                      {c.vendedor_name}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-slate-500">{c.vendedor_cpf_cnpj}</td>
                  <td className="px-5 py-3 text-slate-500">
                    {c.vehicle_brand_model}
                    {c.vehicle_plate ? ` · ${c.vehicle_plate}` : ""}
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-slate-800">
                    {formatCurrency(c.sale_value)}
                  </td>
                  <td className="px-5 py-3 text-right text-emerald-600">
                    {formatCurrency(c.commission_value)}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        title="Imprimir / PDF"
                        onClick={() => setPrinting(c)}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      >
                        <Icon name="download" size={16} />
                      </button>
                      <button
                        type="button"
                        title="Abrir / editar"
                        onClick={() => navigate(`/dashboard/contratos/${c.id}`)}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      >
                        <Icon name="edit" size={16} />
                      </button>
                      <button
                        type="button"
                        title="Excluir"
                        onClick={() => setDeleting(c)}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Icon name="trash" size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {printing &&
        createPortal(
          <div
            id="contract-print-sheet"
            className="hidden whitespace-pre-wrap font-serif text-[13pt] leading-[1.7] text-black print:block"
          >
            {printing.full_text_content}
          </div>,
          document.body
        )}

      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Excluir contrato"
      >
        <p className="text-sm text-slate-600">
          Excluir o contrato de{" "}
          <strong>{deleting?.vendedor_name}</strong> (
          {deleting ? CONTRACT_TYPE_LABEL[deleting.contract_type] : ""},{" "}
          {formatCurrency(deleting?.sale_value)})? Essa ação não pode ser
          desfeita e o registro sai do relatório contábil.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDeleting(null)}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            loading={deleteMut.isPending}
            onClick={confirmDelete}
          >
            Excluir
          </Button>
        </div>
      </Modal>
    </div>
  );
}
