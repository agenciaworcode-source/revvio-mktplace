import { type PointerEvent } from "react";
import { Icon } from "@/features/public/components/icons";
import { formatDate } from "@/lib/format";
import { whatsappLink } from "@/lib/whatsapp";
import { stageMeta } from "../leadStages";
import type { LeadWithVehicle } from "../types";

export function LeadCard({
  lead,
  onEdit,
  onDelete,
}: {
  lead: LeadWithVehicle;
  onEdit?: (lead: LeadWithVehicle) => void;
  onDelete?: (lead: LeadWithVehicle) => void;
}) {
  const meta = stageMeta(lead.stage);
  const wa = whatsappLink(lead.phone, `Olá ${lead.name}!`);
  // Em contextos arrastáveis (funil), impede que o clique no botão inicie o drag.
  const stop = (e: PointerEvent) => e.stopPropagation();
  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5">
      {/* Topo: flag de status à esquerda, ações à direita */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <span
          className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold ring-1 ring-inset ${meta.badge}`}
        >
          {meta.label}
        </span>
        {(onEdit || onDelete) && (
          <div className="flex shrink-0 items-center gap-1.5">
            {onEdit && (
              <button
                type="button"
                onPointerDown={stop}
                onClick={() => onEdit(lead)}
                title="Editar lead"
                aria-label="Editar lead"
                className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <Icon name="edit" size={15} />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onPointerDown={stop}
                onClick={() => onDelete(lead)}
                title="Excluir lead"
                aria-label="Excluir lead"
                className="grid h-7 w-7 place-items-center rounded-lg text-red-500 hover:bg-red-50 hover:text-red-600"
              >
                <Icon name="trash" size={15} />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-400">
          <Icon name="users" size={18} />
        </span>
        <div className="min-w-0">
          <p className="truncate font-bold text-slate-900">{lead.name}</p>
          <p className="truncate text-[13px] text-slate-500">{lead.email ?? "—"}</p>
          <p className="mt-0.5 text-[12px] text-slate-400">{formatDate(lead.created_at)}</p>
        </div>
      </div>

      <div className="mt-3 space-y-1 text-[13px] text-slate-600">
        <p className="flex items-center gap-2">
          <Icon name="phone" size={15} className="text-slate-400" />
          {lead.phone || "Telefone não informado"}
        </p>
        <p className="flex items-center gap-2">
          <Icon name="mapPin" size={15} className="text-slate-400" />
          {lead.city || "Cidade não informada"}
        </p>
        {lead.vehicle && (
          <p className="flex items-center gap-2">
            <Icon name="car" size={15} className="text-slate-400" />
            {lead.vehicle.make} {lead.vehicle.model}
          </p>
        )}
      </div>

      <a
        href={wa ?? undefined}
        target="_blank"
        rel="noreferrer"
        aria-disabled={!wa}
        className={`mt-4 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold ${
          wa
            ? "bg-emerald-500 text-white hover:bg-emerald-600"
            : "pointer-events-none bg-slate-100 text-slate-400"
        }`}
      >
        <Icon name="whatsapp" size={16} /> {wa ? "WhatsApp" : "Sem WhatsApp"}
      </a>
    </div>
  );
}
