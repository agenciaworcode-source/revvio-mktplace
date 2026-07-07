import { forwardRef, useState, useRef } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { AuthSplitLayout, authFieldWrap, authFieldInput } from "../AuthSplitLayout";
import { Icon } from "@/features/public/components/icons";
import { maskPhone, maskCnpj, isValidCnpj } from "@/lib/masks";
import { usePricingPlans } from "@/features/public/queries";

const schema = z.object({
  name: z.string().min(2, "Informe seu nome ou da loja"),
  email: z.string().email("E-mail inválido"),
  phone: z.string().min(8, "Telefone inválido"),
  cnpj: z.string().refine((v) => isValidCnpj(v), "CNPJ inválido"),
  city: z.string().min(2, "Informe a cidade"),
});
type CadastroForm = z.infer<typeof schema>;

/** Campo de input no mesmo estilo do Login (ícone + input claro). */
const AuthField = forwardRef<
  HTMLInputElement,
  {
    id: string;
    label: string;
    icon: string;
    error?: string;
  } & React.InputHTMLAttributes<HTMLInputElement>
>(function AuthField({ id, label, icon, error, ...rest }, ref) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      <div className={`mt-1.5 ${authFieldWrap}`}>
        <Icon name={icon} size={18} className="text-slate-400" />
        <input id={id} ref={ref} className={authFieldInput} {...rest} />
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
});

export function CadastroVendedor() {
  const [params] = useSearchParams();
  const planKey = params.get("plan");
  const cycle = (params.get("cycle") === "annual" ? "annual" : "monthly") as
    | "monthly"
    | "annual";
  const { data: plans = [] } = usePricingPlans();
  const selectedPlan = plans.find((p) => p.key === planKey) ?? null;
  const [formError, setFormError] = useState<string | null>(null);
  const [cnpjStatus, setCnpjStatus] = useState<
    "idle" | "loading" | "valid" | "invalid"
  >("idle");
  const [cnpjMsg, setCnpjMsg] = useState<string | null>(null);
  const lookupGen = useRef(0);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CadastroForm>({ resolver: zodResolver(schema) });

  const phoneField = register("phone");
  const cnpjField = register("cnpj");

  async function checkCnpj(rawCnpj: string) {
    const digits = rawCnpj.replace(/\D/g, "");
    if (digits.length !== 14 || !isValidCnpj(digits)) {
      setCnpjStatus("idle");
      setCnpjMsg(null);
      return;
    }
    const gen = ++lookupGen.current;
    setCnpjStatus("loading");
    setCnpjMsg(null);
    const { data, error } = await supabase.functions.invoke("cnpj-lookup", {
      body: { cnpj: digits },
    });
    if (gen !== lookupGen.current) return; // resposta obsoleta — o usuário já mexeu no CNPJ
    if (error || !data || data.ok !== true) {
      setCnpjStatus("invalid");
      setCnpjMsg(data?.error ?? "Não foi possível consultar o CNPJ agora. Tente novamente.");
      return;
    }
    if (data.name) setValue("name", data.name, { shouldValidate: true });
    if (data.city) setValue("city", data.city, { shouldValidate: true });
    setCnpjStatus("valid");
    setCnpjMsg(
      [data.name, data.city && `${data.city}${data.uf ? "/" + data.uf : ""}`]
        .filter(Boolean)
        .join(" — ") || "CNPJ válido."
    );
  }

  // O cadastro só acontece a partir de um plano escolhido no /vender.
  // Acesso direto (sem ?plan) é redirecionado para a seleção de planos.
  if (!planKey) return <Navigate to="/vender" replace />;

  async function onSubmit(values: CadastroForm) {
    setFormError(null);
    const { data, error } = await supabase.functions.invoke("signup-checkout", {
      body: {
        name: values.name,
        email: values.email,
        phone: values.phone,
        cnpj: values.cnpj.replace(/\D/g, ""),
        city: values.city,
        plan: planKey,
        cycle,
      },
    });
    if (error) {
      // supabase-js dá uma mensagem genérica em non-2xx; o erro real vem no corpo.
      const ctx = (error as { context?: Response }).context;
      const body = ctx?.json ? await ctx.json().catch(() => null) : null;
      setFormError(
        body?.error ?? error.message ?? "Não foi possível iniciar o cadastro."
      );
      return;
    }
    if (data?.error) {
      setFormError(data.error);
      return;
    }
    if (data?.invoiceUrl) {
      window.location.href = data.invoiceUrl as string;
      return;
    }
    setFormError("Não foi possível iniciar o pagamento. Tente novamente.");
  }

  return (
    <AuthSplitLayout
      title="Cadastro de Garagista"
      subtitle="Crie sua mini-loja. O acesso é liberado após a confirmação do pagamento."
      footer={
        <>
          Já tem conta?{" "}
          <Link to="/login" className="font-semibold text-brand hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        {formError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {formError}
          </div>
        )}

        {selectedPlan && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Plano <strong>{selectedPlan.name}</strong> —{" "}
            <strong>
              R${" "}
              {cycle === "annual"
                ? selectedPlan.price_annual * 12
                : selectedPlan.price_monthly}
            </strong>{" "}
            {cycle === "annual" ? "/ano" : "/mês"}. Após criar a conta você vai para o
            pagamento.
          </div>
        )}

        <AuthField
          id="name"
          label="Nome / Loja"
          icon="store"
          placeholder="Garagem do João"
          error={errors.name?.message}
          {...register("name")}
        />

        <AuthField
          id="email"
          label="E-mail"
          icon="mail"
          type="email"
          autoComplete="email"
          placeholder="voce@email.com"
          error={errors.email?.message}
          {...register("email")}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <AuthField
            id="phone"
            label="Telefone"
            icon="phone"
            inputMode="tel"
            placeholder="(11) 99999-9999"
            error={errors.phone?.message}
            {...phoneField}
            onChange={(e) => {
              e.target.value = maskPhone(e.target.value);
              phoneField.onChange(e);
            }}
          />
          <div aria-live="polite" aria-atomic="true">
            <AuthField
              id="cnpj"
              label="CNPJ"
              icon="badge"
              inputMode="numeric"
              placeholder="00.000.000/0000-00"
              error={errors.cnpj?.message}
              {...cnpjField}
              onChange={(e) => {
                e.target.value = maskCnpj(e.target.value);
                cnpjField.onChange(e);
                lookupGen.current++; // abandona qualquer consulta em voo
                setCnpjStatus("idle");
                setCnpjMsg(null);
              }}
              onBlur={(e) => {
                cnpjField.onBlur(e);
                void checkCnpj(e.target.value);
              }}
            />
            {cnpjStatus === "loading" && (
              <p className="mt-1 text-xs text-slate-500">Consultando CNPJ…</p>
            )}
            {cnpjStatus === "valid" && cnpjMsg && (
              <p className="mt-1 text-xs text-emerald-600">✓ {cnpjMsg}</p>
            )}
            {cnpjStatus === "invalid" && cnpjMsg && (
              <p className="mt-1 text-xs text-red-500">{cnpjMsg}</p>
            )}
          </div>
        </div>

        <AuthField
          id="city"
          label="Cidade"
          icon="mapPin"
          placeholder="São Paulo"
          error={errors.city?.message}
          {...register("city")}
        />

        <button
          type="submit"
          disabled={isSubmitting || cnpjStatus !== "valid"}
          className="mt-1 inline-flex items-center justify-center rounded-xl bg-brand py-3 text-sm font-bold text-white transition-colors hover:bg-brand-dark disabled:opacity-50"
        >
          {isSubmitting ? "Redirecionando ao pagamento…" : "Criar conta e pagar"}
        </button>
      </form>
    </AuthSplitLayout>
  );
}
