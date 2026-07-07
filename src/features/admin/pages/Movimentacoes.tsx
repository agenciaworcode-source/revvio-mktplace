import { useState } from "react";
import {
  useAdminRemovals,
  useAdminSales,
  useAdminSellers,
  type ReasonFilters,
} from "../queries";
import {
  RemovalsReasonTable,
  ReasonSummary,
  SalesReasonTable,
} from "../components/MovimentacoesPanels";
import { REMOVAL_REASONS, SALE_REASONS } from "@/components/ReasonField";
import { Button, Card, Field, Input, PageHeader, Select, Spinner } from "@/components/ui-light";
import type { Seller } from "@/lib/database.types";

type Tab = "vendas" | "remocoes";

/** Só lojas aparecem no filtro: o seller_id de vendas/remoções é sempre a loja
 *  (garagista ou dono-plataforma atuando como loja). Vendedores têm parent_id. */
function lojaOptions(sellers: Seller[] | undefined): { id: string; name: string }[] {
  return (sellers ?? []).filter((s) => s.parent_id === null);
}

function FiltersBar({
  sellerOptions,
  reasons,
  value,
  onChange,
}: {
  sellerOptions: { id: string; name: string }[];
  reasons: readonly string[];
  value: ReasonFilters;
  onChange: (next: ReasonFilters) => void;
}) {
  return (
    <Card className="flex flex-wrap items-end gap-4">
      <Field label="Garagista">
        <Select
          value={value.sellerId ?? ""}
          onChange={(e) => onChange({ ...value, sellerId: e.target.value || undefined })}
        >
          <option value="">Todos</option>
          {sellerOptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Motivo">
        <Select
          value={value.reason ?? ""}
          onChange={(e) => onChange({ ...value, reason: e.target.value || undefined })}
        >
          <option value="">Todos</option>
          {reasons.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="De">
        <Input
          type="date"
          value={value.from ?? ""}
          onChange={(e) => onChange({ ...value, from: e.target.value || undefined })}
        />
      </Field>
      <Field label="Até">
        <Input
          type="date"
          value={value.to ?? ""}
          onChange={(e) => onChange({ ...value, to: e.target.value || undefined })}
        />
      </Field>
      <Button variant="outline" onClick={() => onChange({})}>
        Limpar
      </Button>
    </Card>
  );
}

function VendasSection() {
  const [filters, setFilters] = useState<ReasonFilters>({});
  const sellersQ = useAdminSellers();
  const salesQ = useAdminSales(filters);
  const rows = salesQ.data ?? [];
  return (
    <div className="flex flex-col gap-4">
      <FiltersBar
        sellerOptions={lojaOptions(sellersQ.data)}
        reasons={SALE_REASONS}
        value={filters}
        onChange={setFilters}
      />
      <ReasonSummary rows={rows.map((r) => ({ reason: r.sale_reason }))} reasons={SALE_REASONS} />
      {salesQ.isLoading ? (
        <div className="flex justify-center py-12 text-slate-500">
          <Spinner className="h-6 w-6" />
        </div>
      ) : (
        <SalesReasonTable rows={rows} showSeller />
      )}
    </div>
  );
}

function RemocoesSection() {
  const [filters, setFilters] = useState<ReasonFilters>({});
  const sellersQ = useAdminSellers();
  const removalsQ = useAdminRemovals(filters);
  const rows = removalsQ.data ?? [];
  return (
    <div className="flex flex-col gap-4">
      <FiltersBar
        sellerOptions={lojaOptions(sellersQ.data)}
        reasons={REMOVAL_REASONS}
        value={filters}
        onChange={setFilters}
      />
      <ReasonSummary
        rows={rows.map((r) => ({ reason: r.removal_reason }))}
        reasons={REMOVAL_REASONS}
      />
      {removalsQ.isLoading ? (
        <div className="flex justify-center py-12 text-slate-500">
          <Spinner className="h-6 w-6" />
        </div>
      ) : (
        <RemovalsReasonTable rows={rows} showSeller />
      )}
    </div>
  );
}

export function Movimentacoes() {
  const [tab, setTab] = useState<Tab>("vendas");
  return (
    <div>
      <PageHeader title="Movimentações" subtitle="Motivos de venda e de remoção dos garagistas" />
      <div className="mb-4 flex gap-2">
        <Button variant={tab === "vendas" ? "primary" : "outline"} onClick={() => setTab("vendas")}>
          Vendas
        </Button>
        <Button
          variant={tab === "remocoes" ? "primary" : "outline"}
          onClick={() => setTab("remocoes")}
        >
          Remoções
        </Button>
      </div>
      {tab === "vendas" ? <VendasSection /> : <RemocoesSection />}
    </div>
  );
}
