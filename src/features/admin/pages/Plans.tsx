import { useState } from "react";
import {
  useAdminPricingPlans,
  useAdminSellers,
  useSavePricingPlan,
  useDeletePricingPlan,
  type AdminPricingPlan,
} from "../queries";
import {
  PanelHeader,
  GhostButton,
  PrimaryButton,
  brlShort,
  planColor,
} from "@/components/panel";
import { Icon } from "@/features/public/components/icons";
import { formatCurrency } from "@/lib/format";
import { AFFILIATES_ENABLED } from "@/config/features";
import {
  Alert,
  Button,
  Field,
  Input,
  Textarea,
  Modal,
  Spinner,
} from "@/components/ui-light";

/** Converte o que foi digitado em valor numérico (string) tratando como centavos. */
function digitsToValue(input: string): string {
  const digits = input.replace(/\D/g, "");
  return digits ? String(Number(digits) / 100) : "";
}

type FormState = {
  id?: string;
  key: string;
  name: string;
  tagline: string;
  price_monthly: string;
  price_annual: string;
  color: string;
  popular: boolean;
  cta_label: string;
  highlights: string;
  vehicle_limit: string;
  trial_days: string;
  sort_order: string;
  active: boolean;
  affiliates_enabled: boolean;
};

const EMPTY: FormState = {
  key: "",
  name: "",
  tagline: "",
  price_monthly: "",
  price_annual: "",
  color: "#10b981",
  popular: false,
  cta_label: "Escolher plano",
  highlights: "",
  vehicle_limit: "",
  trial_days: "7",
  sort_order: "0",
  active: true,
  affiliates_enabled: false,
};

function toForm(p: AdminPricingPlan): FormState {
  return {
    id: p.id,
    key: p.key,
    name: p.name,
    tagline: p.tagline ?? "",
    price_monthly: String(p.price_monthly),
    price_annual: String(p.price_annual),
    color: p.color,
    popular: p.popular,
    cta_label: p.cta_label,
    highlights: (p.highlights ?? []).join("\n"),
    vehicle_limit: p.vehicle_limit == null ? "" : String(p.vehicle_limit),
    trial_days: String(p.trial_days),
    sort_order: String(p.sort_order),
    active: p.active,
    affiliates_enabled: p.affiliates_enabled ?? false,
  };
}

function PlanFormModal({
  form,
  onClose,
}: {
  form: FormState;
  onClose: () => void;
}) {
  const [state, setState] = useState<FormState>(form);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const save = useSavePricingPlan();
  const del = useDeletePricingPlan();
  const isEdit = !!state.id;

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setState((s) => ({ ...s, [k]: v }));
  }

  function handleSave() {
    setError(null);
    const key = state.key.trim();
    const name = state.name.trim();
    if (!key) return setError("A chave (key) é obrigatória.");
    if (!/^[a-z0-9-]+$/.test(key))
      return setError("A chave deve ter só letras minúsculas, números e hífen.");
    if (!name) return setError("O nome é obrigatório.");
    const pm = Number(state.price_monthly);
    const pa = Number(state.price_annual);
    if (Number.isNaN(pm) || Number.isNaN(pa))
      return setError("Preços mensal e anual precisam ser números.");

    save.mutate(
      {
        id: state.id,
        key,
        name,
        tagline: state.tagline.trim() || null,
        price_monthly: pm,
        price_annual: pa,
        color: state.color.trim() || "#10b981",
        popular: state.popular,
        cta_label: state.cta_label.trim() || "Escolher plano",
        highlights: state.highlights
          .split("\n")
          .map((h) => h.trim())
          .filter(Boolean),
        vehicle_limit: state.vehicle_limit.trim() === "" ? null : Number(state.vehicle_limit),
        trial_days: Number(state.trial_days) || 0,
        sort_order: Number(state.sort_order) || 0,
        active: state.active,
        affiliates_enabled: state.affiliates_enabled,
      },
      {
        onSuccess: onClose,
        onError: (e) => setError((e as Error).message),
      }
    );
  }

  function handleDelete() {
    if (!state.id) return;
    del.mutate(state.id, {
      onSuccess: onClose,
      onError: (e) => {
        setConfirmingDelete(false);
        setError((e as Error).message);
      },
    });
  }

  return (
    <Modal open onClose={onClose} title={isEdit ? "Editar plano" : "Novo plano"} closeOnBackdrop={false}>
      <div className="flex flex-col gap-4">
        {error && <Alert variant="error">{error}</Alert>}

        <div className="grid grid-cols-2 gap-4">
          <Field label="Chave (key)" hint={isEdit ? "Não recomendado alterar" : "ex: profissional"}>
            <Input
              value={state.key}
              onChange={(e) => set("key", e.target.value)}
              placeholder="profissional"
            />
          </Field>
          <Field label="Nome">
            <Input value={state.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
        </div>

        <Field label="Tagline">
          <Input value={state.tagline} onChange={(e) => set("tagline", e.target.value)} />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Preço mensal (R$)">
            <Input
              inputMode="numeric"
              placeholder="R$ 0,00"
              value={state.price_monthly ? formatCurrency(Number(state.price_monthly)) : ""}
              onChange={(e) => set("price_monthly", digitsToValue(e.target.value))}
            />
          </Field>
          <Field label="Preço anual /mês (R$)">
            <Input
              inputMode="numeric"
              placeholder="R$ 0,00"
              value={state.price_annual ? formatCurrency(Number(state.price_annual)) : ""}
              onChange={(e) => set("price_annual", digitsToValue(e.target.value))}
            />
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Field label="Limite de veículos" hint="vazio = ilimitado">
            <Input
              type="number"
              value={state.vehicle_limit}
              onChange={(e) => set("vehicle_limit", e.target.value)}
            />
          </Field>
          <Field label="Dias de teste">
            <Input
              type="number"
              value={state.trial_days}
              onChange={(e) => set("trial_days", e.target.value)}
            />
          </Field>
          <Field label="Ordem">
            <Input
              type="number"
              value={state.sort_order}
              onChange={(e) => set("sort_order", e.target.value)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Cor de destaque">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={state.color}
                onChange={(e) => set("color", e.target.value)}
                className="h-10 w-12 cursor-pointer rounded border border-[#e3e5e9]"
              />
              <Input value={state.color} onChange={(e) => set("color", e.target.value)} />
            </div>
          </Field>
          <Field label="Texto do botão (CTA)">
            <Input value={state.cta_label} onChange={(e) => set("cta_label", e.target.value)} />
          </Field>
        </div>

        <Field label="Destaques (um por linha)">
          <Textarea
            rows={5}
            value={state.highlights}
            onChange={(e) => set("highlights", e.target.value)}
            placeholder={"Até 60 veículos\nLeads ilimitados\n3 usuários"}
          />
        </Field>

        <div className="flex gap-6">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 accent-brand"
              checked={state.popular}
              onChange={(e) => set("popular", e.target.checked)}
            />
            Marcar como popular
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 accent-brand"
              checked={state.active}
              onChange={(e) => set("active", e.target.checked)}
            />
            Plano ativo
          </label>
          {AFFILIATES_ENABLED && (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 accent-brand"
                checked={state.affiliates_enabled}
                onChange={(e) => set("affiliates_enabled", e.target.checked)}
              />
              Habilita afiliados neste plano
            </label>
          )}
        </div>

        <div className="mt-2 flex items-center justify-between border-t border-hair pt-4">
          {isEdit ? (
            <Button
              variant="ghost"
              className="text-red-500"
              onClick={() => setConfirmingDelete(true)}
              loading={del.isPending}
            >
              <Icon name="logout" size={16} /> Excluir
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={handleSave} loading={save.isPending}>
              {isEdit ? "Salvar alterações" : "Criar plano"}
            </Button>
          </div>
        </div>
      </div>

      {confirmingDelete && (
        <Modal open onClose={() => setConfirmingDelete(false)} title="Excluir plano">
          <p className="text-sm text-slate-600">
            Excluir o plano <strong className="text-slate-900">{state.name}</strong>? Esta
            ação não pode ser desfeita.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setConfirmingDelete(false)}
              disabled={del.isPending}
            >
              Cancelar
            </Button>
            <Button variant="danger" loading={del.isPending} onClick={handleDelete}>
              Excluir
            </Button>
          </div>
        </Modal>
      )}
    </Modal>
  );
}

export function Plans() {
  const plansQ = useAdminPricingPlans();
  const sellersQ = useAdminSellers();
  const [form, setForm] = useState<FormState | null>(null);

  const plans = plansQ.data ?? [];
  const sellers = (sellersQ.data ?? []).filter((s) => s.role === "garagista");
  const countByKey = (key: string) =>
    sellers.filter((s) => s.status === "active" && s.pricing_plan_key === key).length;

  return (
    <div>
      <PanelHeader
        title="Controle de Planos"
        subtitle="Planos de assinatura e precificação"
        actions={
          <>
            <GhostButton
              onClick={() => {
                const rows = plans.map((p) => ({
                  key: p.key,
                  nome: p.name,
                  mensal: p.price_monthly,
                  anual: p.price_annual,
                  ativo: p.active,
                }));
                if (!rows.length) return;
                const cols = Object.keys(rows[0]);
                const csv = [
                  cols.join(","),
                  ...rows.map((r) =>
                    cols.map((c) => `"${String((r as Record<string, unknown>)[c] ?? "")}"`).join(",")
                  ),
                ].join("\n");
                const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
                const a = document.createElement("a");
                a.href = url;
                a.download = "planos.csv";
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Icon name="download" size={17} /> Exportar
            </GhostButton>
            <PrimaryButton onClick={() => setForm({ ...EMPTY })}>
              <Icon name="plus" size={17} stroke={2.4} /> Novo plano
            </PrimaryButton>
          </>
        }
      />

      {plansQ.isLoading ? (
        <div className="flex justify-center py-24 text-slate-400">
          <Spinner />
        </div>
      ) : plans.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-hair bg-white py-20 text-center text-slate-400">
          Nenhum plano cadastrado.{" "}
          <button
            onClick={() => setForm({ ...EMPTY })}
            className="font-bold text-brand hover:underline"
          >
            Criar o primeiro
          </button>
          .
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {plans.map((p) => {
            const c = planColor(p.name);
            const stores = countByKey(p.key);
            return (
              <div
                key={p.id}
                className="relative rounded-2xl border bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,.04)]"
                style={{
                  borderColor: p.popular ? "#10b981" : "#ecedf1",
                  borderWidth: p.popular ? 1.5 : 1,
                  opacity: p.active ? 1 : 0.6,
                }}
              >
                <div className="absolute right-4 top-4 flex items-center gap-2">
                  {!p.active && (
                    <span className="rounded-full bg-slate-100 px-2.5 py-[3px] text-[11px] font-bold text-slate-500">
                      INATIVO
                    </span>
                  )}
                  {p.popular && (
                    <span className="rounded-full bg-brand/[0.12] px-2.5 py-[3px] text-[11px] font-extrabold text-brand-dark">
                      POPULAR
                    </span>
                  )}
                </div>
                <span className="text-[13px] font-bold" style={{ color: c }}>
                  {p.name}
                </span>
                <div className="my-1 flex items-baseline gap-1">
                  <span className="text-[32px] font-extrabold tracking-[-1px] text-slate-950">
                    {brlShort(p.price_monthly)}
                  </span>
                  <span className="text-[13px] text-slate-400">/mês</span>
                </div>
                <div className="mb-4 text-[13px] text-slate-500">
                  {p.vehicle_limit == null ? "Ilimitado" : `${p.vehicle_limit} veículos`} ·{" "}
                  <b className="text-slate-950">{stores}</b>{" "}
                  {stores === 1 ? "loja ativa" : "lojas ativas"}
                </div>
                <div className="mb-5 flex flex-col gap-2.5">
                  {p.highlights.slice(0, 5).map((f) => (
                    <div key={f} className="flex items-center gap-2.5 text-[13.5px] text-slate-700">
                      <Icon name="check" size={15} stroke={2.5} className="text-brand" />
                      {f}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setForm(toForm(p))}
                  className="w-full rounded-[9px] border border-[#e6e8ec] bg-white py-2.5 text-[13.5px] font-bold text-slate-950 hover:bg-slate-50"
                >
                  Editar plano
                </button>
              </div>
            );
          })}
        </div>
      )}

      {form && (
        <PlanFormModal key={form.id ?? "new"} form={form} onClose={() => setForm(null)} />
      )}
    </div>
  );
}
