import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { Icon } from "@/features/public/components/icons";
import {
  AuthSplitLayout,
  authFieldWrap,
  authFieldInput,
} from "../AuthSplitLayout";

const schema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(1, "Informe a senha"),
});
type LoginForm = z.infer<typeof schema>;

function friendlyError(message: string): string {
  if (/invalid login credentials/i.test(message)) return "E-mail ou senha incorretos.";
  if (/email not confirmed/i.test(message))
    return "Confirme seu e-mail antes de entrar.";
  return message;
}

export function Login() {
  const navigate = useNavigate();
  const [authError, setAuthError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(schema) });

  async function onSubmit(values: LoginForm) {
    setAuthError(null);
    setInfo(null);
    const { error } = await supabase.auth.signInWithPassword(values);
    if (error) {
      setAuthError(friendlyError(error.message));
      return;
    }
    navigate("/app", { replace: true });
  }

  async function handleForgot() {
    setAuthError(null);
    setInfo(null);
    const email = getValues("email");
    if (!email) {
      setAuthError("Informe seu e-mail acima para recuperar a senha.");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });
    if (error) setAuthError(friendlyError(error.message));
    else setInfo("Enviamos um link de recuperação para o seu e-mail.");
  }

  return (
    <AuthSplitLayout
      title="Entrar na plataforma"
      subtitle="Acesse com suas credenciais."
      footer={
        <>
          Ainda não tem conta?{" "}
          <Link to="/vender" className="font-semibold text-brand hover:underline">
            Cadastre-se como garagista
          </Link>
          <div className="mt-1">
            É comprador?{" "}
            <Link to="/cadastro" className="font-semibold text-brand hover:underline">
              Criar conta
            </Link>
          </div>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        {authError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {authError}
          </div>
        )}
        {info && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {info}
          </div>
        )}

        <div>
          <label htmlFor="email" className="text-sm font-medium text-slate-700">
            E-mail
          </label>
          <div className={`mt-1.5 ${authFieldWrap}`}>
            <Icon name="mail" size={18} className="text-slate-400" />
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="seu@email.com"
              className={authFieldInput}
              {...register("email")}
            />
          </div>
          {errors.email && (
            <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="text-sm font-medium text-slate-700">
              Senha
            </label>
            <button
              type="button"
              onClick={handleForgot}
              className="text-sm font-semibold text-brand hover:underline"
            >
              Esqueci minha senha
            </button>
          </div>
          <div className={`mt-1.5 ${authFieldWrap}`}>
            <Icon name="lock" size={18} className="text-slate-400" />
            <input
              id="password"
              type={showPw ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              className={authFieldInput}
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              className="text-slate-400 hover:text-slate-600"
              aria-label={showPw ? "Ocultar senha" : "Mostrar senha"}
            >
              <Icon name={showPw ? "eyeOff" : "eye"} size={18} />
            </button>
          </div>
          {errors.password && (
            <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-1 inline-flex items-center justify-center rounded-xl bg-brand py-3 text-sm font-bold text-white transition-colors hover:bg-brand-dark disabled:opacity-50"
        >
          {isSubmitting ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </AuthSplitLayout>
  );
}
