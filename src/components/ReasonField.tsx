import { useEffect, useState } from "react";
import { Field, Input, Select } from "@/components/ui-light";

export const SALE_REASONS = [
  "Comprei outro veículo",
  "Não uso mais",
  "Mudança de cidade/país",
  "Preciso do dinheiro",
  "Troca por outro veículo",
  "Repasse/lojista",
  "Outro",
] as const;

export const REMOVAL_REASONS = [
  "Vendido fora da plataforma",
  "Desistência do proprietário",
  "Cadastro duplicado",
  "Erro de cadastro",
  "Veículo indisponível",
  "Outro",
] as const;

export function ReasonField({
  label,
  options,
  error,
  onResolved,
}: {
  label: string;
  options: readonly string[];
  error?: string;
  onResolved: (value: string) => void;
}) {
  const [sel, setSel] = useState("");
  const [outro, setOutro] = useState("");
  const resolved = sel === "Outro" ? outro.trim() : sel;

  useEffect(() => {
    onResolved(resolved);
    // onResolved é um setter estável; só reportamos quando o valor muda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved]);

  return (
    <Field label={label} error={error}>
      <Select value={sel} onChange={(e) => setSel(e.target.value)}>
        <option value="" disabled>
          Selecione…
        </option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </Select>
      {sel === "Outro" && (
        <Input
          className="mt-2"
          placeholder="Descreva o motivo"
          value={outro}
          onChange={(e) => setOutro(e.target.value)}
        />
      )}
    </Field>
  );
}
