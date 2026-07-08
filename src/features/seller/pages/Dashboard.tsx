import { Link } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthProvider";
import { useCommissions, useSales, useVehicles } from "../queries";
import { DashboardCharts } from "../components/DashboardCharts";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Spinner,
  StatCard,
} from "@/components/ui-light";

function isThisMonth(dateStr: string): boolean {
  const d = new Date(dateStr.length <= 10 ? `${dateStr}T00:00:00` : dateStr);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

export function Dashboard() {
  const { seller, lojaId, personId, isVendedor } = useAuth();
  const vehicles = useVehicles(lojaId ?? undefined);
  const sales = useSales(lojaId ?? undefined);
  const commissions = useCommissions((isVendedor ? personId : lojaId) ?? undefined);

  const loading = vehicles.isLoading || sales.isLoading || commissions.isLoading;

  const available =
    vehicles.data?.filter((v) => v.status === "available").length ?? 0;
  const sold = vehicles.data?.filter((v) => v.status === "sold").length ?? 0;
  const monthRevenue =
    sales.data
      ?.filter((s) => isThisMonth(s.sale_date))
      .reduce((acc, s) => acc + Number(s.sale_price), 0) ?? 0;
  const pendingCommission =
    commissions.data
      ?.filter((c) => c.status === "pending")
      .reduce((acc, c) => acc + Number(c.amount), 0) ?? 0;

  // Comissões a receber (vendedor): pendentes + atrasadas, por vencimento.
  const receivable = (commissions.data ?? [])
    .filter((c) => c.status === "pending" || c.status === "overdue")
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));

  const recent = sales.data?.slice(0, 5) ?? [];

  return (
    <div>
      <PageHeader
        title={`Olá, ${seller?.name ?? "vendedor"} 👋`}
        subtitle="Resumo da sua operação na plataforma."
        action={
          <Link to="/painel/vendas">
            <Button>Registrar venda</Button>
          </Link>
        }
      />

      {loading ? (
        <div className="flex justify-center py-16 text-slate-500">
          <Spinner />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Veículos ativos" value={available} />
            <StatCard label="Veículos vendidos" value={sold} />
            <StatCard label="Faturamento do mês" value={formatCurrency(monthRevenue)} />
            <StatCard
              label={isVendedor ? "Comissões a receber" : "Comissões a pagar"}
              value={formatCurrency(pendingCommission)}
              hint={
                isVendedor ? "Seu ganho pelas vendas intermediadas" : "Para a equipe da loja"
              }
            />
          </div>

          <DashboardCharts
            sales={sales.data ?? []}
            vehicles={vehicles.data ?? []}
          />

          {isVendedor && (
            <>
              <div className="mb-3 mt-10 flex items-end justify-between gap-3">
                <h2 className="text-lg font-bold text-slate-900">Comissões a receber</h2>
                <span className="text-sm font-semibold text-slate-500">
                  {formatCurrency(pendingCommission)} no total
                </span>
              </div>
              {receivable.length === 0 ? (
                <EmptyState
                  title="Nenhuma comissão a receber"
                  description="Ao registrar uma venda, sua comissão aparece aqui com a data de vencimento."
                />
              ) : (
                <Card className="p-0">
                  <ul className="divide-y divide-slate-100">
                    {receivable.map((c) => (
                      <li
                        key={c.id}
                        className="flex items-center justify-between gap-4 px-5 py-4"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900">
                            {formatCurrency(c.amount)}
                          </p>
                          <p className="text-xs text-slate-500">
                            Vencimento: {c.due_date ? formatDate(c.due_date) : "a definir"}
                          </p>
                        </div>
                        <Badge tone={c.status === "overdue" ? "red" : "amber"}>
                          {c.status === "overdue" ? "Atrasada" : "A receber"}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </>
          )}

          <h2 className="mb-3 mt-10 text-lg font-bold text-slate-900">Vendas recentes</h2>
          {recent.length === 0 ? (
            <EmptyState
              title="Nenhuma venda registrada ainda"
              description="Quando você registrar uma venda, ela aparece aqui."
              action={
                <Link to="/painel/vendas">
                  <Button>Registrar primeira venda</Button>
                </Link>
              }
            />
          ) : (
            <Card className="p-0">
              <ul className="divide-y divide-slate-100">
                {recent.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-4 px-5 py-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">
                        {s.vehicle
                          ? `${s.vehicle.make} ${s.vehicle.model}`
                          : "Veículo removido"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {s.buyer_name} · {formatDate(s.sale_date)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-slate-900">
                        {formatCurrency(s.sale_price)}
                      </span>
                      <Badge tone="sky">{s.payment_method}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
