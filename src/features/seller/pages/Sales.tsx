import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/features/auth/AuthProvider";
import { useLeads } from "@/features/leads/queries";
import {
  useDeleteSale,
  useLojaAffiliates,
  useRegisterSale,
  useSales,
  useSuggestAffiliate,
  useTeam,
  useVehicles,
  type SaleWithVehicle,
} from "../queries";
import { formatCurrency, formatDate } from "@/lib/format";
import { maskPhone } from "@/lib/masks";
import { ReasonField, SALE_REASONS } from "@/components/ReasonField";
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

const paymentLabels: Record<string, string> = {
  pix: "Pix",
  financiamento: "Financiamento",
  a_vista: "À vista",
};

const schema = z.object({
  vehicle_id: z.coerce.number().int().positive("Selecione o veículo"),
  // "responsavel" = `${tipo}:${id}` onde tipo ∈ {vendedor, afiliado}
  responsavel: z.string().min(1, "Selecione o responsável"),
  buyer_name: z.string().min(2, "Informe o comprador"),
  buyer_phone: z.string().optional(),
  sale_price: z.coerce.number().gt(0, "Informe o valor"),
  payment_method: z.enum(["pix", "financiamento", "a_vista"]),
  sale_date: z.string().min(1, "Informe a data"),
  sale_reason: z.string().min(1, "Informe como a venda foi realizada"),
});
type FormValues = z.infer<typeof schema>;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function RegisterSaleForm({ onClose }: { onClose: () => void }) {
  const { personId, lojaId, isVendedor, seller } = useAuth();
  const vehicles = useVehicles(lojaId ?? undefined);
  const team = useTeam(lojaId ?? undefined);
  const affiliates = useLojaAffiliates(lojaId ?? undefined);
  const leads = useLeads(lojaId ?? undefined);
  const register_ = useRegisterSale(lojaId ?? undefined);
  const [error, setError] = useState<string | null>(null);
  const [leadSel, setLeadSel] = useState("");

  const available = vehicles.data?.filter((v) => v.status === "available") ?? [];

  const {
    register,
    handleSubmit,
    setValue,
    control,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      sale_date: today(),
      payment_method: "pix",
      responsavel: isVendedor && personId ? `vendedor:${personId}` : "",
      sale_reason: "",
    },
  });

  const suggest = useSuggestAffiliate();
  const [suggestion, setSuggestion] = useState<{ id: string; name: string } | null>(null);

  const watchedPhone = watch("buyer_phone");
  const watchedVehicle = watch("vehicle_id");

  useEffect(() => {
    if (isVendedor) {
      setSuggestion(null);
      return;
    }
    const digits = (watchedPhone ?? "").replace(/\D/g, "");
    if (digits.length < 10 || !watchedVehicle) {
      setSuggestion(null);
      return;
    }
    const t = setTimeout(async () => {
      const s = await suggest(Number(watchedVehicle), watchedPhone ?? "");
      setSuggestion(s);
      if (s) setValue("responsavel", `afiliado:${s.id}`, { shouldValidate: true });
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedPhone, watchedVehicle, isVendedor]);

  async function onSubmit(values: FormValues) {
    setError(null);
    try {
      const [tipo, rid] = values.responsavel.split(":");
      await register_.mutateAsync({
        vehicle_id: values.vehicle_id,
        vendedor_id: tipo === "vendedor" ? rid : null,
        affiliate_id: tipo === "afiliado" ? rid : null,
        buyer_name: values.buyer_name,
        buyer_phone: values.buyer_phone || null,
        sale_price: values.sale_price,
        payment_method: values.payment_method,
        sale_date: values.sale_date,
        sale_reason: values.sale_reason,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao registrar a venda.");
    }
  }

  if (available.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <Alert variant="warning">
          Você não tem veículos disponíveis para vender. Cadastre um veículo (ou ajuste o
          status para “Disponível”) antes de registrar uma venda.
        </Alert>
        <div className="flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      {error && <Alert variant="error">{error}</Alert>}

      {isVendedor ? (
        <input type="hidden" value={`vendedor:${personId ?? ""}`} {...register("responsavel")} />
      ) : (
        <>
        {suggestion && (
          <Alert variant="info">
            Este comprador veio pelo link do afiliado <strong>{suggestion.name}</strong>. Pré-selecionamos
            ele como responsável — você pode confirmar ou trocar.
          </Alert>
        )}
        <Field label="Responsável pela venda" error={errors.responsavel?.message}>
          <Select {...register("responsavel")} defaultValue="">
            <option value="" disabled>
              Selecione o responsável…
            </option>
            <optgroup label="Equipe">
              {seller && (
                <option value={`vendedor:${seller.id}`}>
                  {seller.name} ({seller.commission_rate}%) — você (garagista)
                </option>
              )}
              {(team.data ?? [])
                .filter((v) => v.status === "active")
                .map((v) => (
                  <option key={`v-${v.id}`} value={`vendedor:${v.id}`}>
                    {v.name} ({v.commission_rate}%)
                  </option>
                ))}
            </optgroup>
            {(affiliates.data ?? []).length > 0 && (
              <optgroup label="Afiliados">
                {(affiliates.data ?? []).map((a) => (
                  <option key={`a-${a.id}`} value={`afiliado:${a.id}`}>
                    {a.name} ({a.commission_rate}%) — afiliado
                  </option>
                ))}
              </optgroup>
            )}
          </Select>
        </Field>
        </>
      )}

      {(leads.data ?? []).length > 0 && (
        <Field label="Comprador veio de um interesse no site? (opcional)">
          <Select
            value={leadSel}
            onChange={(e) => {
              const id = e.target.value;
              setLeadSel(id);
              const lead = (leads.data ?? []).find((l) => l.id === id);
              if (!lead) return;
              setValue("buyer_name", lead.name, { shouldValidate: true });
              setValue("buyer_phone", lead.phone ? maskPhone(lead.phone) : "", {
                shouldValidate: true,
              });
              // pré-seleciona o veículo do interesse, se ainda estiver disponível
              const veh = lead.vehicle_id
                ? available.find((v) => v.id === lead.vehicle_id)
                : undefined;
              if (veh) {
                setValue("vehicle_id", veh.id, { shouldValidate: true });
                setValue("sale_price", veh.price, { shouldValidate: true });
              }
            }}
          >
            <option value="">Não / preencher manualmente…</option>
            {(leads.data ?? []).map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
                {l.phone ? ` — ${l.phone}` : ""}
                {l.vehicle ? ` — interesse: ${l.vehicle.make} ${l.vehicle.model}` : ""}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <Field label="Veículo" error={errors.vehicle_id?.message}>
        <Select
          {...register("vehicle_id")}
          defaultValue=""
          onChange={(e) => {
            const v = available.find((x) => x.id === Number(e.target.value));
            if (v) setValue("sale_price", v.price, { shouldValidate: true });
          }}
        >
          <option value="" disabled>
            Selecione…
          </option>
          {available.map((v) => (
            <option key={v.id} value={v.id}>
              {v.make} {v.model} {v.year ? `(${v.year})` : ""} — {formatCurrency(v.price)}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Comprador" error={errors.buyer_name?.message}>
          <Input placeholder="Nome do comprador" {...register("buyer_name")} />
        </Field>
        <Field label="Telefone do comprador" error={errors.buyer_phone?.message}>
          <Controller
            control={control}
            name="buyer_phone"
            render={({ field }) => (
              <Input
                inputMode="tel"
                placeholder="(11) 99999-9999"
                value={field.value ?? ""}
                onChange={(e) => field.onChange(maskPhone(e.target.value))}
              />
            )}
          />
        </Field>
        <Field label="Valor da venda (R$)" error={errors.sale_price?.message}>
          <Controller
            control={control}
            name="sale_price"
            render={({ field }) => (
              <Input
                inputMode="numeric"
                placeholder="R$ 0,00"
                value={field.value ? formatCurrency(field.value) : ""}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "");
                  field.onChange(digits ? Number(digits) / 100 : 0);
                }}
              />
            )}
          />
        </Field>
        <Field label="Forma de pagamento" error={errors.payment_method?.message}>
          <Select {...register("payment_method")}>
            <option value="pix">Pix</option>
            <option value="a_vista">À vista</option>
            <option value="financiamento">Financiamento</option>
          </Select>
        </Field>
        <Field label="Data da venda" error={errors.sale_date?.message}>
          <Input type="date" {...register("sale_date")} />
        </Field>
      </div>

      <Controller
        control={control}
        name="sale_reason"
        render={({ field }) => (
          <ReasonField
            label="Venda realizada"
            options={SALE_REASONS}
            error={errors.sale_reason?.message}
            onResolved={field.onChange}
          />
        )}
      />

      <Alert variant="info">
        Sua comissão pela intermediação é calculada automaticamente no servidor com base
        na sua taxa configurada.
      </Alert>

      <div className="mt-2 flex justify-end gap-3">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" loading={register_.isPending}>
          Registrar venda
        </Button>
      </div>
    </form>
  );
}

export function Sales() {
  const { lojaId, isGaragista, isAdmin } = useAuth();
  const manager = isGaragista || isAdmin;
  const { data, isLoading } = useSales(lojaId ?? undefined);
  const del = useDeleteSale(lojaId ?? undefined);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<SaleWithVehicle | null>(null);

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await del.mutateAsync(deleting.id);
      setDeleting(null);
    } catch {
      /* erro exibido no modal via del.error */
    }
  }

  return (
    <div>
      <PageHeader
        title="Minhas Vendas"
        subtitle="Registre vendas e acompanhe o histórico."
        action={<Button onClick={() => setOpen(true)}>+ Registrar venda</Button>}
      />

      {isLoading ? (
        <div className="flex justify-center py-16 text-slate-500">
          <Spinner />
        </div>
      ) : !data || data.length === 0 ? (
        <EmptyState
          title="Nenhuma venda registrada"
          description="Ao registrar uma venda, a comissão é gerada automaticamente."
          action={<Button onClick={() => setOpen(true)}>+ Registrar venda</Button>}
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Veículo</th>
                <th className="px-5 py-3 font-medium">Comprador</th>
                <th className="px-5 py-3 font-medium">Pagamento</th>
                <th className="px-5 py-3 font-medium">Venda realizada</th>
                <th className="px-5 py-3 font-medium">Data</th>
                <th className="px-5 py-3 text-right font-medium">Valor</th>
                {manager && <th className="px-5 py-3 text-right font-medium">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((s) => (
                <tr key={s.id}>
                  <td className="px-5 py-3 font-medium text-slate-900">
                    {s.vehicle
                      ? `${s.vehicle.make} ${s.vehicle.model}`
                      : "Veículo removido"}
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    {s.buyer_name}
                    {s.buyer_phone && (
                      <span className="block text-xs text-slate-500">{s.buyer_phone}</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <Badge tone="sky">
                      {paymentLabels[s.payment_method] ?? s.payment_method}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{s.sale_reason ?? "—"}</td>
                  <td className="px-5 py-3 text-slate-600">{formatDate(s.sale_date)}</td>
                  <td className="px-5 py-3 text-right font-semibold text-slate-900">
                    {formatCurrency(s.sale_price)}
                  </td>
                  {manager && (
                    <td className="px-5 py-3 text-right">
                      <Button
                        variant="danger"
                        className="px-3 py-1.5 text-xs"
                        onClick={() => setDeleting(s)}
                      >
                        Excluir
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Registrar venda" closeOnBackdrop={false}>
        {open && <RegisterSaleForm onClose={() => setOpen(false)} />}
      </Modal>

      {deleting && (
        <Modal open onClose={() => setDeleting(null)} title="Excluir venda">
          <div className="flex flex-col gap-4">
            <p className="text-sm text-slate-600">
              Excluir a venda de{" "}
              <strong className="text-slate-900">
                {deleting.vehicle
                  ? `${deleting.vehicle.make} ${deleting.vehicle.model}`
                  : "veículo removido"}
              </strong>{" "}
              para <strong className="text-slate-900">{deleting.buyer_name}</strong> (
              {formatCurrency(deleting.sale_price)})? A comissão associada será apagada e o
              veículo volta a ficar disponível. Essa ação não pode ser desfeita.
            </p>
            {del.isError && (
              <Alert variant="error">
                {del.error instanceof Error
                  ? del.error.message
                  : "Não foi possível excluir a venda."}
              </Alert>
            )}
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setDeleting(null)} disabled={del.isPending}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={confirmDelete} loading={del.isPending}>
                Excluir venda
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
