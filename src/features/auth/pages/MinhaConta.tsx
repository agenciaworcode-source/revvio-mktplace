import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/features/auth/AuthProvider";
import { updateBuyerProfile } from "@/features/auth/buyer";
import { maskPhone } from "@/lib/masks";
import { PublicShell } from "@/features/public/PublicShell";
import { Alert, Button, Card, Field, Input } from "@/components/ui-light";

export function MinhaConta() {
  const { buyer, isBuyer, loading, user, signOut, refreshSeller } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (buyer) {
      setName(buyer.name ?? "");
      setPhone(buyer.phone ?? "");
      setCity(buyer.city ?? "");
    }
  }, [buyer]);

  if (loading)
    return (
      <PublicShell>
        <div className="p-8 text-slate-400">Carregando…</div>
      </PublicShell>
    );
  if (!user) return <Navigate to="/login" replace />;
  if (!isBuyer) return <Navigate to="/app" replace />;

  async function salvar() {
    if (!buyer) return;
    setErr(null);
    setMsg(null);
    setSaving(true);
    try {
      await updateBuyerProfile(buyer.id, { name, phone, city });
      if (password) {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setPassword("");
      }
      await refreshSeller();
      setMsg("Dados atualizados.");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function sair() {
    await signOut();
    navigate("/", { replace: true });
  }

  return (
    <PublicShell>
      <div className="mx-auto max-w-[640px] px-5 py-10">
        <h1 className="mb-6 text-2xl font-extrabold text-slate-900">Minha conta</h1>
        <Card className="flex flex-col gap-4 p-6">
          {msg && <Alert variant="success">{msg}</Alert>}
          {err && <Alert variant="error">{err}</Alert>}
          <Field label="Nome">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="E-mail">
            <Input value={buyer?.email ?? ""} disabled />
          </Field>
          <Field label="Telefone">
            <Input value={phone} inputMode="tel" onChange={(e) => setPhone(maskPhone(e.target.value))} />
          </Field>
          <Field label="Cidade">
            <Input value={city} onChange={(e) => setCity(e.target.value)} />
          </Field>
          <Field label="Nova senha (opcional)">
            <Input
              value={password}
              type="password"
              placeholder="Deixe em branco para manter"
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <div className="mt-2 flex justify-between">
            <Button variant="ghost" onClick={sair}>
              Sair
            </Button>
            <Button loading={saving} onClick={salvar}>
              Salvar
            </Button>
          </div>
        </Card>
      </div>
    </PublicShell>
  );
}
