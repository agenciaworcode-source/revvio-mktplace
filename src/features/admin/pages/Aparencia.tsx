import { useRef, useState } from "react";
import { useHomeBanner, useUpdateHomeBanner } from "../queries";
import { PanelHeader, SectionCard } from "@/components/panel";
import { Alert, Spinner } from "@/components/ui-light";
import { Icon } from "@/features/public/components/icons";

/**
 * Aparência do site — por enquanto, o banner da home (/).
 * O superadmin sobe uma imagem; ela vira o banner público imediatamente.
 */
export function Aparencia() {
  const { data: bannerUrl, isLoading } = useHomeBanner();
  const update = useUpdateHomeBanner();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Selecione um arquivo de imagem.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Imagem muito grande (máx. 5 MB).");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    try {
      await update.mutateAsync(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no upload do banner.");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <PanelHeader
        title="Aparência"
        subtitle="Gerencie o banner principal da home pública (/)."
      />

      {error && (
        <div className="mb-5">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      <SectionCard>
        <h2 className="text-[15px] font-bold text-slate-900">Banner da home</h2>
        <p className="mt-1 text-[13.5px] text-slate-400">
          Recomendado: imagem ampla (ex.: 1280×420). Substitui o banner anterior.
        </p>

        <div className="mt-5 overflow-hidden rounded-xl border border-hair bg-slate-50">
          {isLoading ? (
            <div className="flex h-[220px] items-center justify-center text-slate-400">
              <Spinner />
            </div>
          ) : (
            <img
              src={bannerUrl || "/home/banner-placeholder.svg"}
              alt="Pré-visualização do banner da home"
              className="h-[220px] w-full object-cover"
            />
          )}
        </div>

        <div className="mt-5 flex items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={onPick}
            className="hidden"
          />
          <button
            onClick={() => inputRef.current?.click()}
            disabled={update.isPending}
            className="inline-flex items-center gap-2 rounded-[10px] bg-brand px-[18px] py-[11px] text-sm font-bold text-white shadow-[0_6px_16px_rgba(16,185,129,.28)] hover:bg-brand-dark disabled:opacity-60"
          >
            {update.isPending ? (
              <>
                <Spinner /> Enviando…
              </>
            ) : (
              <>
                <Icon name="camera" size={16} /> Trocar banner
              </>
            )}
          </button>
          {!isLoading && !bannerUrl && (
            <span className="text-[13px] text-slate-400">
              Usando o placeholder padrão.
            </span>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
