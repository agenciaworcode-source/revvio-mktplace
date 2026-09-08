// ============================================================
// Escopo do módulo de contratos.
//
// As mesmas telas servem o superadmin e o garagista; o que muda é quem é o
// dono do documento, quais modelos podem ser emitidos e qual identidade visual
// timbra a folha. Em vez de duplicar as páginas, o escopo carrega essas
// diferenças e as telas leem tudo daqui.
// ============================================================

import type { ContractModel } from "./models";

/** Timbre da folha: marca + dados de quem emite o documento. */
export interface Letterhead {
  /** Imagem da marca. A do garagista é a logo do perfil dele. */
  markUrl: string;
  /**
   * Wordmark ao lado da marca. Só a Revvender tem — a logo de uma loja
   * costuma já trazer o nome dentro da imagem.
   */
  wordmarkUrl?: string;
  name: string;
  cnpj: string;
  address: string;
}

/**
 * Fontes do autopreenchimento, já normalizadas. Cada painel busca no lugar
 * que pode (o admin varre o sistema todo, o garagista só a própria loja) e
 * entrega estas listas — assim o editor não precisa saber de onde vieram.
 */
export interface AutofillVehicle {
  id: string;
  label: string;
  brandModel: string;
  yearModel: string;
  price: number;
  sellerId: string | null;
}

export interface AutofillLead {
  id: string;
  /** Nome que vai para o campo do comprador. */
  name: string;
  /** Texto do combo — pode trazer o veículo junto, o `name` não. */
  label: string;
  city: string;
  vehicleId: string | null;
}

/** Loja que entra como vendedora no contrato. */
export interface AutofillSeller {
  id: string;
  name: string;
  cpfCnpj: string;
  address: string;
  label: string;
}

export interface AutofillSources {
  vehicles: AutofillVehicle[];
  leads: AutofillLead[];
  sellers: AutofillSeller[];
}

export interface ContractScope {
  /** Prefixo das rotas ("/dashboard/contratos" ou "/painel/contratos"). */
  basePath: string;
  /** Loja dona dos contratos. `null` = superadmin (vê e emite por todas). */
  sellerId: string | null;
  /**
   * Modelos padrão que este escopo pode emitir, já filtrados por público e
   * situação. Vêm do catálogo que o superadmin mantém no painel.
   */
  models: ContractModel[];
  letterhead: Letterhead;
  /**
   * Combos que puxam veículo/lead/loja do sistema. O superadmin escolhe entre
   * todas as lojas; o garagista só tem a dele, então o combo de loja some.
   */
  showSellerPicker: boolean;
  /** Molde salvo da loja, usado como carga inicial do editor de cláusulas. */
  savedTemplate?: string | null;
  /** Rota da gestão do catálogo de modelos. Só o superadmin tem. */
  manageModelsPath?: string;
  subtitle: string;
}

/** Timbre padrão da plataforma — usado pelo admin e como reserva da loja. */
export const REVVENDER_LETTERHEAD = {
  markUrl: "/brand/mark-bw.png",
  wordmarkUrl: "/brand/wordmark-bw.png",
} as const;
