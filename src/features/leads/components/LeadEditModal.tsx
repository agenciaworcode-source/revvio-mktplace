import { useState } from "react";
import {
  Alert,
  Button,
  Field,
  Input,
  Modal,
  Select,
  Textarea,
} from "@/components/ui-light";
import { maskPhone } from "@/lib/masks";
import { LEAD_STAGES } from "../leadStages";
import { useUpdateLead, type LeadEditInput } from "../queries";
import type { LeadStage, LeadWithVehicle } from "../types";

export function LeadEditModal({
  lead,
  sellerId,
  onClose,
}: {
  lead: LeadWithVehicle;
  sellerId?: string;
  onClose: () => void;
}) {
  const update = useUpdateLead();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<LeadEditInput>({
    name: lead.name,
    phone: lead.phone,
    email: lead.email,
    city: lead.city,
    message: lead.message,
    financing: lead.financing,
    stage: lead.stage,
  });

  function set<K extends keyof LeadEditInput>(key: K, value: LeadEditInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    setError(null);
    if (!form.name.trim()) {
      setError("Informe o nome do lead.");
      return;
    }
    try {
      await update.mutateAsync({
        id: lead.id,
        sellerId,
        values: {
          ...form,
          name: form.name.trim(),
          phone: form.phone?.trim() || null,
          email: form.email?.trim() || null,
          city: form.city?.trim() || null,
          message: form.message?.trim() || null,
        },
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar o lead.");
    }
  }

  return (
    <Modal open onClose={onClose} title="Editar lead" closeOnBackdrop={false}>
      <div className="flex flex-col gap-4">
        {error && <Alert variant="error">{error}</Alert>}

        <Field label="Nome">
          <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Telefone">
            <Input
              inputMode="tel"
              value={form.phone ?? ""}
              onChange={(e) => set("phone", maskPhone(e.target.value))}
            />
          </Field>
          <Field label="E-mail">
            <Input
              type="email"
              value={form.email ?? ""}
              onChange={(e) => set("email", e.target.value)}
            />
          </Field>
          <Field label="Cidade">
            <Input value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} />
          </Field>
          <Field label="Estágio">
            <Select
              value={form.stage}
              onChange={(e) => set("stage", e.target.value as LeadStage)}
            >
              {LEAD_STAGES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Mensagem">
          <Textarea
            rows={3}
            value={form.message ?? ""}
            onChange={(e) => set("message", e.target.value)}
          />
        </Field>

        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            className="h-4 w-4 accent-brand"
            checked={form.financing}
            onChange={(e) => set("financing", e.target.checked)}
          />
          Interessado em financiamento
        </label>

        <div className="mt-1 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} loading={update.isPending}>
            Salvar alterações
          </Button>
        </div>
      </div>
    </Modal>
  );
}
