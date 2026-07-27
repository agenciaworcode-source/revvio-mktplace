import { Input, Select } from "@/components/ui-light";
import type { LeadWithVehicle } from "../types";

export interface LeadFiltersValue {
  term: string;
  from: string;
  to: string;
  city: string;
}

export const EMPTY_FILTERS: LeadFiltersValue = { term: "", from: "", to: "", city: "all" };

export function filterLeads(leads: LeadWithVehicle[], f: LeadFiltersValue): LeadWithVehicle[] {
  const term = f.term.trim().toLowerCase();
  const from = f.from ? new Date(f.from + "T00:00:00").getTime() : null;
  const to = f.to ? new Date(f.to + "T23:59:59").getTime() : null;
  return leads.filter((l) => {
    if (term) {
      const hay = `${l.name} ${l.email ?? ""} ${l.phone ?? ""} ${l.city ?? ""}`.toLowerCase();
      if (!hay.includes(term)) return false;
    }
    const t = new Date(l.created_at).getTime();
    if (from !== null && t < from) return false;
    if (to !== null && t > to) return false;
    if (f.city !== "all" && (l.city ?? "") !== f.city) return false;
    return true;
  });
}

export function LeadFilters({
  value,
  onChange,
  cities,
}: {
  value: LeadFiltersValue;
  onChange: (v: LeadFiltersValue) => void;
  cities: string[];
}) {
  const set = (patch: Partial<LeadFiltersValue>) => onChange({ ...value, ...patch });
  return (
    <div className="mb-5 rounded-xl border border-slate-200 bg-white p-3">
      {/* Empilha no mobile: a linha única de 4 controles não cabia em 360px. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          placeholder="Buscar por nome, cidade ou telefone…"
          value={value.term}
          onChange={(e) => set({ term: e.target.value })}
          className="min-w-0 sm:!w-auto sm:flex-1"
        />
        <div className="flex items-center gap-2">
          <Input
            type="date"
            aria-label="Data inicial"
            value={value.from}
            onChange={(e) => set({ from: e.target.value })}
            className="min-w-0 flex-1 sm:!w-36 sm:flex-none sm:shrink-0"
          />
          <span className="shrink-0 text-slate-400">–</span>
          <Input
            type="date"
            aria-label="Data final"
            value={value.to}
            onChange={(e) => set({ to: e.target.value })}
            className="min-w-0 flex-1 sm:!w-36 sm:flex-none sm:shrink-0"
          />
        </div>
        <Select
          value={value.city}
          onChange={(e) => set({ city: e.target.value })}
          className="sm:!w-44 sm:shrink-0"
        >
          <option value="all">Todas as cidades</option>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
