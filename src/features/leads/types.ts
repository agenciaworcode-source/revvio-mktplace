export type LeadStage = "novo" | "em_contato" | "negociando" | "ganho" | "perdido";

export interface Lead {
  id: string;
  seller_id: string;
  vehicle_id: number | null;
  name: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  message: string | null;
  financing: boolean;
  stage: LeadStage;
  created_at: string;
  updated_at: string;
}

export interface LeadWithVehicle extends Lead {
  vehicle: { id: number; make: string; model: string; year: number | null } | null;
}

export interface TopClickedVehicle {
  id: number;
  make: string;
  model: string;
  year: number | null;
  images: string[];
  clicks: number;
}
