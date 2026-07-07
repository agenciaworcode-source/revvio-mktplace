import { useAuth } from "@/features/auth/AuthProvider";
import { useAffiliateLojaCars, useLogAffiliateShare } from "../queries";
import { Alert, Button, Card, EmptyState, PageHeader, Spinner } from "@/components/ui-light";
import { formatCurrency } from "@/lib/format";

function carLink(refCode: string | null | undefined, id: number): string {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  const ref = refCode ? `?ref=${refCode}` : "";
  return `${base}/veiculo/${id}${ref}`;
}

export function Carros() {
  const { lojaId, seller } = useAuth();
  const carsQ = useAffiliateLojaCars(lojaId ?? undefined);
  const logShare = useLogAffiliateShare();
  const refCode = seller?.ref_code ?? null;

  async function copy(id: number) {
    const url = carLink(refCode, id);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* clipboard pode falhar em http; ignora */
    }
    logShare.mutate({ vehicleId: id });
  }

  function whatsapp(id: number, label: string) {
    const url = carLink(refCode, id);
    const text = `Olha esse veículo: ${label} — ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    logShare.mutate({ vehicleId: id });
  }

  const cars = carsQ.data ?? [];

  return (
    <div>
      <PageHeader
        title="Carros"
        subtitle="Compartilhe os veículos da loja com o seu link próprio"
      />
      {carsQ.isLoading ? (
        <div className="flex justify-center py-16 text-slate-500">
          <Spinner className="h-6 w-6" />
        </div>
      ) : carsQ.isError ? (
        <Alert variant="error">Não foi possível carregar os carros da loja.</Alert>
      ) : cars.length === 0 ? (
        <EmptyState
          title="Nenhum carro disponível"
          description="A loja não tem veículos disponíveis no momento."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cars.map((c) => {
            const label = [c.make, c.model, c.year].filter(Boolean).join(" ");
            return (
              <Card key={c.id} className="flex flex-col gap-3 p-4">
                <div className="aspect-video overflow-hidden rounded-lg bg-slate-100">
                  {c.image ? (
                    <img src={c.image} alt={label} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-slate-400">
                      sem foto
                    </div>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{label}</p>
                  <p className="text-sm text-emerald-600">{formatCurrency(c.price)}</p>
                </div>
                <div className="mt-auto flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => copy(c.id)}>
                    Copiar link
                  </Button>
                  <Button className="flex-1" onClick={() => whatsapp(c.id, label)}>
                    WhatsApp
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
