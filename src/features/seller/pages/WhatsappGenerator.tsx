import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthProvider";
import { useVehicles } from "../queries";
import { buildWhatsappCopy } from "@/lib/whatsappCopy";
import { Button, Card, PageHeader, Select, Spinner, Textarea } from "@/components/ui-light";
import { Icon } from "@/features/public/components/icons";

export function WhatsappGenerator() {
  const { seller, lojaId, isGaragista, isAdmin } = useAuth();
  const manager = isGaragista || isAdmin;
  const { data: vehicles, isLoading } = useVehicles(lojaId ?? undefined);

  const [selectedId, setSelectedId] = useState("");
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);

  const list = useMemo(() => vehicles ?? [], [vehicles]);

  if (!manager) return <Navigate to="/painel" replace />;

  function onSelect(id: string) {
    setSelectedId(id);
    setCopied(false);
    const v = list.find((x) => String(x.id) === id);
    setText(v ? buildWhatsappCopy(v, seller?.name) : "");
  }

  async function copy() {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard indisponível — usuário pode copiar manualmente */
    }
  }

  return (
    <div>
      <PageHeader
        title="Gerador de Copy WhatsApp"
        subtitle="Selecione o veículo e edite o texto conforme necessário."
      />

      <Card>
        <h2 className="text-lg font-bold text-slate-900">Editor</h2>
        <p className="mt-1 text-sm text-slate-400">
          Selecione um veículo para carregar os dados. O texto é totalmente editável.
        </p>

        {isLoading ? (
          <div className="flex justify-center py-12 text-slate-400">
            <Spinner />
          </div>
        ) : (
          <>
            <div className="mt-5">
              <label className="mb-1 block text-sm font-semibold text-slate-700">Veículo</label>
              <Select value={selectedId} onChange={(e) => onSelect(e.target.value)}>
                <option value="">Selecione um carro…</option>
                {list.map((v) => (
                  <option key={v.id} value={v.id}>
                    {[v.make, v.model].filter(Boolean).join(" ")}
                    {v.year ? ` - ${v.year}` : ""}
                  </option>
                ))}
              </Select>
              {list.length === 0 && (
                <p className="mt-2 text-sm text-slate-400">
                  Nenhum veículo cadastrado ainda.
                </p>
              )}
            </div>

            <div className="mt-5">
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Texto do Anúncio
              </label>
              <Textarea
                rows={18}
                placeholder="Selecione um veículo para gerar o texto…"
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setCopied(false);
                }}
                className="font-mono text-[13px] leading-relaxed"
              />
            </div>

            <div className="mt-4">
              <Button onClick={copy} disabled={!text} className="w-full justify-center">
                <Icon name={copied ? "check" : "copy"} size={18} />
                {copied ? "Copiado!" : "Copiar texto"}
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
