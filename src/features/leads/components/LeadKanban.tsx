import { useMemo, type ReactNode } from "react";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { LEAD_STAGES } from "../leadStages";
import type { LeadStage, LeadWithVehicle } from "../types";
import { useUpdateLeadStage } from "../queries";
import { LeadCard } from "./LeadCard";

function Column({
  stage,
  label,
  count,
  children,
}: {
  stage: LeadStage;
  label: string;
  count: number;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <div
      ref={setNodeRef}
      className={`flex w-72 shrink-0 flex-col rounded-xl bg-slate-50 p-3 ${
        isOver ? "ring-2 ring-brand" : ""
      }`}
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <span className="text-[13px] font-bold text-slate-700">{label}</span>
        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500">
          {count}
        </span>
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

function DraggableCard({
  lead,
  onEdit,
  onDelete,
}: {
  lead: LeadWithVehicle;
  onEdit?: (lead: LeadWithVehicle) => void;
  onDelete?: (lead: LeadWithVehicle) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
  });
  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)`, opacity: isDragging ? 0.5 : 1 }
    : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="cursor-grab touch-none active:cursor-grabbing"
    >
      <LeadCard lead={lead} onEdit={onEdit} onDelete={onDelete} />
    </div>
  );
}

export function LeadKanban({
  leads,
  sellerId,
  onEdit,
  onDelete,
}: {
  leads: LeadWithVehicle[];
  sellerId?: string;
  onEdit?: (lead: LeadWithVehicle) => void;
  onDelete?: (lead: LeadWithVehicle) => void;
}) {
  const updateStage = useUpdateLeadStage();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const byStage = useMemo(() => {
    const map: Record<LeadStage, LeadWithVehicle[]> = {
      novo: [],
      em_contato: [],
      negociando: [],
      ganho: [],
      perdido: [],
    };
    for (const l of leads) map[l.stage].push(l);
    return map;
  }, [leads]);

  function onDragEnd(e: DragEndEvent) {
    const id = String(e.active.id);
    const dest = e.over?.id as LeadStage | undefined;
    if (!dest) return;
    const lead = leads.find((l) => l.id === id);
    if (!lead || lead.stage === dest) return;
    updateStage.mutate({ id, stage: dest, sellerId });
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {LEAD_STAGES.map((s) => (
          <Column key={s.key} stage={s.key} label={s.label} count={byStage[s.key].length}>
            {byStage[s.key].map((l) => (
              <DraggableCard key={l.id} lead={l} onEdit={onEdit} onDelete={onDelete} />
            ))}
          </Column>
        ))}
      </div>
    </DndContext>
  );
}
