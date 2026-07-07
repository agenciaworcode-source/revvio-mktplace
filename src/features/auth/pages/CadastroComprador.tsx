import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signUpBuyer } from "@/features/auth/buyer";
import { useAuth } from "@/features/auth/AuthProvider";
import { maskPhone } from "@/lib/masks";
import { AuthSplitLayout, authFieldWrap, authFieldInput } from "../AuthSplitLayout";
import { Icon } from "@/features/public/components/icons";

export function CadastroComprador() {
  const navigate = useNavigate();
  const { refreshSeller } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (
      !name.trim() ||
      !email.trim() ||
      phone.replace(/\D/g, "").length < 10 ||
      !city.trim() ||
      password.length < 6
    ) {
      setError("Preencha todos os campos (senha com no mínimo 6 caracteres).");
      return;
    }
    setLoading(true);
    try {
      await signUpBuyer({ name, email, phone, city, password });
      await refreshSeller();
      navigate("/", { replace: true });
    } catch (err) {
      setError(
        /already registered/i.test((err as Error).message)
          ? "Este e-mail já tem conta. Faça login."
          : (err as Error).message
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthSplitLayout
      title="Criar conta"
      subtitle="Cadastre-se para demonstrar interesse nos veículos."
      footer={
        <>
          Já tem conta?{" "}
          <Link to="/login" className="font-semibold text-brand hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        <div className={authFieldWrap}>
          <Icon name="name" size={18} className="text-slate-400" />
          <input className={authFieldInput} placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className={authFieldWrap}>
          <Icon name="phone" size={18} className="text-slate-400" />
          <input className={authFieldInput} inputMode="tel" placeholder="Telefone" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} />
        </div>
        <div className={authFieldWrap}>
          <Icon name="mapPin" size={18} className="text-slate-400" />
          <input className={authFieldInput} placeholder="Cidade" value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
        <div className={authFieldWrap}>
          <Icon name="mail" size={18} className="text-slate-400" />
          <input className={authFieldInput} type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className={authFieldWrap}>
          <Icon name="lock" size={18} className="text-slate-400" />
          <input className={authFieldInput} type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="mt-1 inline-flex items-center justify-center rounded-xl bg-brand py-3 text-sm font-bold text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {loading ? "Criando…" : "Criar conta"}
        </button>
      </form>
    </AuthSplitLayout>
  );
}
