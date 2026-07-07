import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import {
  AuthSplitLayout,
  authFieldWrap,
  authFieldInput,
} from "../AuthSplitLayout";
import { Icon } from "@/features/public/components/icons";

/**
 * Destino do link "definir senha" enviado no e-mail de boas-vindas (recovery).
 * O supabase-js detecta o token na URL e cria a sessão; aqui o garagista
 * define a senha e segue para o painel.
 */
export function DefinirSenha() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const tokenHash = params.get("token_hash");
    const type = (params.get("type") ?? "recovery") as EmailOtpType;

    async function init() {
      // 1) link novo (token_hash): troca o token por uma sessão via verifyOtp.
      //    Rodar só aqui (no JS) evita que scanners de e-mail consumam o token.
      if (tokenHash) {
        const { error: vErr } = await supabase.auth.verifyOtp({
          type,
          token_hash: tokenHash,
        });
        if (!vErr) {
          setHasSession(true);
          setReady(true);
          return;
        }
      }
      // 2) fallback: link antigo (token na hash) já cria a sessão automaticamente.
      const { data } = await supabase.auth.getSession();
      setHasSession(!!data.session);
      setReady(true);
    }
    init();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) setHasSession(true);
    });
    return () => sub.subscription.unsubscribe();
  }, [params]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("A senha precisa ter ao menos 6 caracteres.");
      return;
    }
    setSaving(true);
    const { error: upErr } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (upErr) {
      setError(upErr.message);
      return;
    }
    navigate("/app", { replace: true });
  }

  return (
    <AuthSplitLayout
      title="Definir senha"
      subtitle="Crie sua senha para acessar a plataforma."
      footer={
        <Link to="/login" className="font-semibold text-brand hover:underline">
          Voltar ao login
        </Link>
      }
    >
      {!ready ? (
        <p className="text-sm text-slate-500">Carregando…</p>
      ) : !hasSession ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Link inválido ou expirado. Use{" "}
          <Link to="/login" className="font-semibold underline">
            Esqueci minha senha
          </Link>{" "}
          no login para receber um novo.
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          <div>
            <label htmlFor="password" className="text-sm font-medium text-slate-700">
              Nova senha
            </label>
            <div className={`mt-1.5 ${authFieldWrap}`}>
              <Icon name="lock" size={18} className="text-slate-400" />
              <input
                id="password"
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                placeholder="••••••••"
                className={authFieldInput}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
          </div>
          <button
            type="submit"
            disabled={saving}
            className="mt-1 inline-flex items-center justify-center rounded-xl bg-brand py-3 text-sm font-bold text-white transition-colors hover:bg-brand-dark disabled:opacity-50"
          >
            {saving ? "Salvando…" : "Definir senha e entrar"}
          </button>
        </form>
      )}
    </AuthSplitLayout>
  );
}
