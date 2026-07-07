import type { LeadStage } from "./types";

export const LEAD_STAGES: {
  key: LeadStage;
  label: string;
  badge: string; // classes do pill de status
  column: string; // classes da borda do header da coluna kanban
}[] = [
  { key: "novo", label: "Novo", badge: "bg-blue-50 text-blue-700 ring-blue-200", column: "border-blue-300" },
  { key: "em_contato", label: "Em contato", badge: "bg-amber-50 text-amber-700 ring-amber-200", column: "border-amber-300" },
  { key: "negociando", label: "Negociando", badge: "bg-violet-50 text-violet-700 ring-violet-200", column: "border-violet-300" },
  { key: "ganho", label: "Ganho", badge: "bg-emerald-50 text-emerald-700 ring-emerald-200", column: "border-emerald-300" },
  { key: "perdido", label: "Perdido", badge: "bg-red-50 text-red-700 ring-red-200", column: "border-red-300" },
];

export function stageMeta(stage: LeadStage) {
  return LEAD_STAGES.find((s) => s.key === stage) ?? LEAD_STAGES[0];
}
