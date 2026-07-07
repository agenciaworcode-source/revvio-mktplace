import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchMarcas,
  fetchModelos,
  fetchAnos,
  fetchResult,
  fipeYear,
  type FipeTipo,
  type FipeResult,
} from "@/lib/fipe";
import { Alert, Field, Select, Spinner } from "@/components/ui-light";

const DAY = 24 * 60 * 60 * 1000;

const TIPOS: { value: FipeTipo; label: string }[] = [
  { value: "carros", label: "Carro" },
  { value: "motos", label: "Moto" },
  { value: "caminhoes", label: "Caminhão" },
];

export type FipeSelectorProps = {
  onSelect: (r: FipeResult) => void;
  onUseManual: () => void;
};

export function FipeSelector({ onSelect, onUseManual }: FipeSelectorProps) {
  const qc = useQueryClient();
  const [tipo, setTipo] = useState<FipeTipo>("carros");
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [ano, setAno] = useState("");
  const [loadingValor, setLoadingValor] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const marcas = useQuery({
    queryKey: ["fipe", "marcas", tipo],
    queryFn: () => fetchMarcas(tipo),
    staleTime: DAY,
    gcTime: DAY,
  });
  const modelos = useQuery({
    queryKey: ["fipe", "modelos", tipo, marca],
    queryFn: () => fetchModelos(tipo, marca),
    enabled: !!marca,
    staleTime: DAY,
    gcTime: DAY,
  });
  const anos = useQuery({
    queryKey: ["fipe", "anos", tipo, marca, modelo],
    queryFn: () => fetchAnos(tipo, marca, modelo),
    enabled: !!marca && !!modelo,
    staleTime: DAY,
    gcTime: DAY,
  });

  function resetFrom(level: "tipo" | "marca" | "modelo") {
    if (level === "tipo") setMarca("");
    if (level === "tipo" || level === "marca") setModelo("");
    setAno("");
    setError(null);
  }

  async function handleAno(anoCod: string) {
    setAno(anoCod);
    if (!anoCod) return;
    // Identidade já disponível sem a chamada de valor: preenche mesmo se o valor falhar (spec §6).
    const marcaNome = (marcas.data ?? []).find((m) => m.codigo === marca)?.nome ?? "";
    const modeloNome = (modelos.data ?? []).find((m) => m.codigo === modelo)?.nome ?? "";
    onSelect({
      make: marcaNome,
      model: modeloNome,
      year: fipeYear(Number.parseInt(anoCod, 10)),
      fipePrice: null,
      fuel: null,
    });
    setLoadingValor(true);
    setError(null);
    try {
      const result = await qc.fetchQuery({
        queryKey: ["fipe", "valor", tipo, marca, modelo, anoCod],
        queryFn: () => fetchResult(tipo, marca, modelo, anoCod),
        staleTime: DAY,
        gcTime: DAY,
      });
      onSelect(result);
    } catch {
      setError("Não foi possível consultar o valor na FIPE agora. Marca, modelo e ano foram preenchidos — informe o preço manualmente ou tente selecionar o ano novamente.");
    } finally {
      setLoadingValor(false);
    }
  }

  const anyError = marcas.isError || modelos.isError || anos.isError || error;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-slate-700">Buscar pela tabela FIPE</p>
        <button
          type="button"
          onClick={onUseManual}
          className="text-xs font-medium text-brand hover:underline"
        >
          Não encontrei / preencher manualmente
        </button>
      </div>

      {anyError && (
        <div className="mb-3">
          <Alert variant="error">
            {error ?? "Não foi possível consultar a FIPE agora. Tente novamente ou preencha manualmente."}
          </Alert>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Tipo">
          <Select
            value={tipo}
            onChange={(e) => {
              setTipo(e.target.value as FipeTipo);
              resetFrom("tipo");
            }}
          >
            {TIPOS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Marca">
          <Select
            value={marca}
            disabled={marcas.isLoading}
            onChange={(e) => {
              setMarca(e.target.value);
              resetFrom("marca");
            }}
          >
            <option value="">{marcas.isLoading ? "Carregando…" : "Selecione a marca"}</option>
            {(marcas.data ?? []).map((m) => (
              <option key={m.codigo} value={m.codigo}>
                {m.nome}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Modelo">
          <Select
            value={modelo}
            disabled={!marca || modelos.isLoading}
            onChange={(e) => {
              setModelo(e.target.value);
              resetFrom("modelo");
            }}
          >
            <option value="">
              {!marca ? "Escolha a marca primeiro" : modelos.isLoading ? "Carregando…" : "Selecione o modelo"}
            </option>
            {(modelos.data ?? []).map((m) => (
              <option key={m.codigo} value={m.codigo}>
                {m.nome}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Ano">
          <Select
            value={ano}
            disabled={!modelo || anos.isLoading}
            onChange={(e) => handleAno(e.target.value)}
          >
            <option value="">
              {!modelo ? "Escolha o modelo primeiro" : anos.isLoading ? "Carregando…" : "Selecione o ano"}
            </option>
            {(anos.data ?? []).map((a) => (
              <option key={a.codigo} value={a.codigo}>
                {a.nome}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {loadingValor && (
        <p className="mt-3 flex items-center gap-2 text-sm text-slate-500">
          <Spinner className="h-4 w-4" /> Consultando valor na FIPE…
        </p>
      )}
    </div>
  );
}
