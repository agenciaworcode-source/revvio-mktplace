import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/features/auth/AuthProvider";
import { signUpBuyer } from "@/features/auth/buyer";
import { maskPhone } from "@/lib/masks";
import { Alert, Button, Field, Input, Modal } from "@/components/ui-light";

type Tab = "entrar" | "criar";

export type BuyerAuthInitial = {
  name?: string;
  email?: string;
  phone?: string;
  city?: string;
};

export function BuyerAuthModal({
  open,
  onClose,
  onAuthed,
  initial,
  defaultTab = "entrar",
}: {
  open: boolean;
  onClose: () => void;
  onAuthed: () => void;
  /** Dados já preenchidos em outro form (ex.: "Quero ver o carro") — abre direto em "Criar conta". */
  initial?: BuyerAuthInitial;
  /** Aba inicial quando não há dados pré-preenchidos (ex.: canais da loja → "criar"). */
  defaultTab?: Tab;
}) {
  const { refreshSeller } = useAuth();
  const [tab, setTab] = useState<Tab>("entrar");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // campos
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [password, setPassword] = useState("");

  // Ao abrir, semeia os campos a partir do form anterior (sobrescreve apenas na abertura).
  useEffect(() => {
    if (!open) return;
    const hasInitial = !!(initial?.name || initial?.email || initial?.phone || initial?.city);
    setName(initial?.name ?? "");
    setEmail(initial?.email ?? "");
    setPhone(initial?.phone ? maskPhone(initial.phone) : "");
    setCity(initial?.city ?? "");
    setPassword("");
    setError(null);
    setTab(hasInitial ? "criar" : defaultTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function finish() {
    await refreshSeller(); // recarrega buyer no contexto
    onAuthed();
  }

  async function handleEntrar() {
    setError(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await finish();
    } catch (e) {
      setError(
        /invalid login credentials/i.test((e as Error).message)
          ? "E-mail ou senha incorretos."
          : (e as Error).message
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleCriar() {
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
      await finish();
    } catch (e) {
      setError(
        /already registered/i.test((e as Error).message)
          ? "Este e-mail já tem conta. Use a aba Entrar."
          : (e as Error).message
      );
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <Modal open onClose={onClose} title="Entre para continuar" closeOnBackdrop={false}>
      <p className="mb-4 text-sm text-slate-600">
        {tab === "criar" && (initial?.name || initial?.email)
          ? "Confirme seus dados e defina uma senha para criar sua conta e continuar."
          : "Crie sua conta ou entre para continuar."}
      </p>

      <div className="mb-4 flex rounded-lg border border-hair p-1">
        <button
          onClick={() => setTab("entrar")}
          className={`flex-1 rounded-md py-1.5 text-sm font-semibold ${tab === "entrar" ? "bg-brand text-white" : "text-slate-600"}`}
        >
          Entrar
        </button>
        <button
          onClick={() => setTab("criar")}
          className={`flex-1 rounded-md py-1.5 text-sm font-semibold ${tab === "criar" ? "bg-brand text-white" : "text-slate-600"}`}
        >
          Criar conta
        </button>
      </div>

      {error && (
        <div className="mb-3">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {tab === "criar" && (
          <>
            <Field label="Nome">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" />
            </Field>
            <Field label="Telefone">
              <Input
                value={phone}
                inputMode="tel"
                onChange={(e) => setPhone(maskPhone(e.target.value))}
                placeholder="(11) 99999-9999"
              />
            </Field>
            <Field label="Cidade">
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Sua cidade" />
            </Field>
          </>
        )}
        <Field label="E-mail">
          <Input value={email} type="email" onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" />
        </Field>
        <Field label="Senha">
          <Input value={password} type="password" onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </Field>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
        {tab === "entrar" ? (
          <Button loading={loading} onClick={handleEntrar}>
            Entrar
          </Button>
        ) : (
          <Button loading={loading} onClick={handleCriar}>
            Criar conta
          </Button>
        )}
      </div>
    </Modal>
  );
}
