import { useMemo, useState } from "react";
import { createPortal, flushSync } from "react-dom";
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
  useContracts,
  useDeleteContract,
  type Contract,
  type ContractFilters,
} from "./queries";
import { CONTRACT_TYPE_LABEL } from "./templates";
import { ContractSheet, isSinglePage } from "./ContractSheet";
import type { ContractScope } from "./scope";
import { printContractSheet } from "@/lib/printContract";

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

export function ContractsListPage({ scope }: { scope: ContractScope }) {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<ContractFilters>({});
  const [deleting, setDeleting] = useState<Contract | null>(null);
  const [printing, setPrinting] = useState<Contract | null>(null);
  const contractsQ = useContracts(scope.sellerId, filters);
  const deleteMut = useDeleteContract();
  const rows = contractsQ.data ?? [];
  // O filtro é por natureza do documento, não por modelo: dois modelos de
  // compra e venda geram contratos da mesma espécie. Com uma natureza só não
  // há o que filtrar — o combo vira ruído na tela.
  const types = useMemo(
    () => Array.from(new Set(scope.models.map((m) => m.contractType))),
    [scope.models]
  );
  const multiType = types.length > 1;

  /* Imprime direto da lista: monta a folha no <body> (mesmo portal do editor)
     e chama print. O flushSync commita o portal ANTES do print, sem sair do
     handler do clique — o Safari do iPhone descarta `window.print()` chamado
     fora da ativação do usuário, que era o motivo de só falhar no iOS.
     A folha fica montada depois (é `hidden` na tela) e é substituída na
     impressão seguinte; não dá para depender de `afterprint`, que o iOS não
     dispara. */
  function imprimir(c: Contract) {
    flushSync(() => setPrinting(c));
    printContractSheet();
  }

  async function confirmDelete() {
    if (!deleting) return;
    await deleteMut.mutateAsync(deleting);
    setDeleting(null);
  }

  return (
    <div>
      <PageHeader
        title="Contratos"
        subtitle={scope.subtitle}
        action={
          <div className="flex flex-wrap gap-2">
            {scope.manageModelsPath && (
              <Button
                variant="outline"
                onClick={() => navigate(scope.manageModelsPath!)}
              >
                <Icon name="settings" size={17} /> Modelos de contrato
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => exportCsv(rows)}
              disabled={!rows.length}
            >
              <Icon name="download" size={17} /> Exportar CSV
            </Button>
            <Button onClick={() => navigate(`${scope.basePath}/novo`)}>
              <Icon name="plus" size={17} /> Novo contrato
            </Button>
          </div>
        }
      />

      <Card className="mb-4 grid grid-cols-1 items-end gap-3 p-4 sm:grid-cols-2 sm:gap-4 sm:p-6 lg:grid-cols-[1.6fr_1.2fr_1fr_1fr_auto]">
        <Field label="Cliente (nome ou CPF/CNPJ)">
          <Input
            placeholder="Buscar vendedor ou comprador…"
            value={filters.search ?? ""}
            onChange={(e) =>
              setFilters({ ...filters, search: e.target.value || undefined })
            }
          />
        </Field>
        {multiType && (
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
              {types.map((t) => (
                <option key={t} value={t}>
                  {CONTRACT_TYPE_LABEL[t]}
                </option>
              ))}
            </Select>
          </Field>
        )}
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
        <Button
          variant="outline"
          onClick={() => setFilters({})}
          className="sm:col-span-2 lg:col-span-1"
        >
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
            <Button onClick={() => navigate(`${scope.basePath}/novo`)}>
              <Icon name="plus" size={17} /> Novo contrato
            </Button>
          }
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b border-hair text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3.5">Emissão</th>
                {multiType && <th className="px-5 py-3.5">Tipo</th>}
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
                  {multiType && (
                    <td className="px-5 py-3">
                      <Badge tone={TYPE_TONE[c.contract_type]}>
                        {CONTRACT_TYPE_LABEL[c.contract_type]}
                      </Badge>
                    </td>
                  )}
                  <td className="px-5 py-3 font-semibold text-slate-800">
                    <Link
                      to={`${scope.basePath}/${c.id}`}
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
                        onClick={() => imprimir(c)}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      >
                        <Icon name="download" size={16} />
                      </button>
                      <button
                        type="button"
                        title="Abrir / editar"
                        onClick={() => navigate(`${scope.basePath}/${c.id}`)}
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
          <div id="contract-print-sheet" className="hidden print:block">
            <ContractSheet
              text={printing.full_text_content}
              mode="print"
              letterhead={scope.letterhead}
              compact={isSinglePage(printing.contract_type)}
            />
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
