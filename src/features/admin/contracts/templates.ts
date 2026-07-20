// ============================================================
// Modelos de texto padrão dos contratos (carga inicial do editor).
// As tags [campo] são substituídas em tempo real pelos inputs do
// formulário; o texto final (já interpolado) é o que fica gravado
// em rv_contracts.full_text_content.
// ============================================================

import { formatCurrency } from "@/lib/format";

/** Dados fixos da intermediadora (config do sistema). */
export const INTERMEDIADORA = {
  name: "REVVIO LTDA",
  cnpj: "63.340.233/0001-53",
  address: "AV. IPIRANGA, 207 - CENTRO - MARÍLIA/SP",
  comarca: "Marília/SP",
  cidade: "Marília",
} as const;

/** Percentual padrão da comissão de intermediação. */
export const COMMISSION_RATE = 0.04;

export type ContractType = "intermediacao" | "compra_venda" | "procuracao";

export const CONTRACT_TYPE_OPTIONS: { value: ContractType; label: string }[] = [
  { value: "intermediacao", label: "Contrato de Intermediação de Venda de Veículo Automotor" },
  { value: "compra_venda", label: "Contrato de Compra e Venda de Veículo" },
  { value: "procuracao", label: "Procuração de Veículo" },
];

export const CONTRACT_TYPE_LABEL: Record<ContractType, string> = {
  intermediacao: "Intermediação",
  compra_venda: "Compra e Venda",
  procuracao: "Procuração",
};

/** Campos do formulário que alimentam as tags dos modelos. */
export interface ContractFields {
  vendedor_name: string;
  vendedor_cpf_cnpj: string;
  vendedor_address: string;
  comprador_name: string;
  comprador_cpf_cnpj: string;
  comprador_address: string;
  vehicle_brand_model: string;
  vehicle_year_model: string;
  vehicle_plate: string;
  vehicle_renavam: string;
  vehicle_chassi: string;
  sale_value: string; // valores ficam como string no form; parse no submit
  commission_value: string;
}

export const EMPTY_FIELDS: ContractFields = {
  vendedor_name: "",
  vendedor_cpf_cnpj: "",
  vendedor_address: "",
  comprador_name: "",
  comprador_cpf_cnpj: "",
  comprador_address: "",
  vehicle_brand_model: "",
  vehicle_year_model: "",
  vehicle_plate: "",
  vehicle_renavam: "",
  vehicle_chassi: "",
  sale_value: "",
  commission_value: "",
};

/** "12345,60" | "12345.60" → 12345.6 (NaN-safe → 0). */
export function parseMoney(value: string): number {
  const n = Number(String(value).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0;
}

const BLANK = "____________________";

/**
 * Substitui as tags [campo] do modelo pelos valores do formulário.
 * Campos vazios viram linha em branco (documento imprimível à mão);
 * valores monetários são formatados em BRL; [data_atual] vira a data
 * de emissão por extenso.
 */
export function interpolate(
  template: string,
  fields: ContractFields,
  issuedAt: Date = new Date()
): string {
  const money = (v: string) => (v.trim() ? formatCurrency(parseMoney(v)) : BLANK);
  const text = (v: string) => (v.trim() ? v.trim() : BLANK);

  const map: Record<string, string> = {
    vendedor_name: text(fields.vendedor_name),
    vendedor_cpf_cnpj: text(fields.vendedor_cpf_cnpj),
    vendedor_address: text(fields.vendedor_address),
    comprador_name: text(fields.comprador_name),
    comprador_cpf_cnpj: text(fields.comprador_cpf_cnpj),
    comprador_address: text(fields.comprador_address),
    vehicle_brand_model: text(fields.vehicle_brand_model),
    vehicle_year_model: text(fields.vehicle_year_model),
    vehicle_plate: text(fields.vehicle_plate),
    vehicle_renavam: text(fields.vehicle_renavam),
    vehicle_chassi: text(fields.vehicle_chassi),
    sale_value: money(fields.sale_value),
    commission_value: money(fields.commission_value),
    data_atual: issuedAt.toLocaleDateString("pt-BR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    intermediadora_name: INTERMEDIADORA.name,
    intermediadora_cnpj: INTERMEDIADORA.cnpj,
    intermediadora_address: INTERMEDIADORA.address,
  };

  return template.replace(/\[([a-z_]+)\]/g, (tag, key: string) => map[key] ?? tag);
}

/* ── Modelo A · Intermediação ───────────────────────────── */
const TEMPLATE_INTERMEDIACAO = `CONTRATO DE INTERMEDIAÇÃO DE VENDA DE VEÍCULO AUTOMOTOR - ${INTERMEDIADORA.name}

Pelo presente instrumento particular, de um lado:

PROPRIETÁRIO / VENDEDOR:
Nome: [vendedor_name]
CPF: [vendedor_cpf_cnpj]
Endereço: [vendedor_address]

E, de outro lado:

INTERMEDIADORA:
${INTERMEDIADORA.name}
CNPJ: ${INTERMEDIADORA.cnpj}
Endereço: ${INTERMEDIADORA.address}

As partes têm entre si justo e contratado o que segue:

CLÁUSULA 1 - DO OBJETO
O presente contrato tem por objeto a intermediação da venda do veículo automotor de propriedade do VENDEDOR, não havendo, em nenhuma hipótese, a compra do veículo pela INTERMEDIADORA.

CLÁUSULA 2 - IDENTIFICAÇÃO DO VEÍCULO
Marca/Modelo: [vehicle_brand_model]
Ano/Modelo: [vehicle_year_model]
Placa: [vehicle_plate]
RENAVAM: [vehicle_renavam]

CLÁUSULA 3 - NATUREZA DA INTERMEDIAÇÃO
A INTERMEDIADORA atuará exclusivamente como intermediadora entre VENDEDOR e COMPRADOR, não se responsabilizando por:
I - pagamento do preço do veículo;
II - vícios ocultos ou aparentes;
III - inadimplência do comprador;
IV - problemas mecânicos, estruturais ou históricos do veículo.

CLÁUSULA 4 - DECLARAÇÕES DO VENDEDOR
O VENDEDOR declara, sob as penas da lei, que:
I - é legítimo proprietário do veículo;
II - o veículo está livre de quaisquer ônus, restrições judiciais ou administrativas, salvo se expressamente informado;
III - todas as informações prestadas são verdadeiras;
IV - assume integral responsabilidade civil, criminal e administrativa por informações falsas.

CLÁUSULA 5 - COMISSÃO DA INTERMEDIAÇÃO
Pela intermediação realizada, a INTERMEDIADORA fará jus à comissão de [commission_value], equivalente a 4% sobre o valor total da venda de [sale_value]. A comissão será devida no momento da assinatura do documento de transferência, independentemente do recebimento integral do valor pelo VENDEDOR.

CLÁUSULA 6 - EXCLUSIVIDADE
O presente contrato é firmado sob regime de exclusividade/sem exclusividade conforme acordado previamente pelas partes. Em caso de venda realizada sem a participação da INTERMEDIADORA durante o prazo de exclusividade, a comissão será integralmente devida.

CLÁUSULA 7 - PAGAMENTOS
A INTERMEDIADORA não receberá valores referentes ao preço do veículo, sendo o pagamento realizado diretamente entre VENDEDOR e COMPRADOR.

CLÁUSULA 8 - ISENÇÃO DE RESPONSABILIDADE
A INTERMEDIADORA não responderá por:
I - multas, tributos ou encargos anteriores ou posteriores à venda;
II - atrasos na transferência;
III - sinistros, defeitos ou vícios ocultos;
IV - litígios entre VENDEDOR e COMPRADOR.

CLÁUSULA 9 - MULTA POR DESCUMPRIMENTO
O descumprimento de quaisquer cláusulas implicará multa equivalente a 100% do valor da comissão, sem prejuízo de perdas e danos.

CLÁUSULA 10 - VIGÊNCIA
O presente contrato entra em vigor na data de sua assinatura e permanece válido até a conclusão da venda ou rescisão formal por escrito.

CLÁUSULA 11 - FORO
Fica eleito o foro da comarca de ${INTERMEDIADORA.comarca}, com renúncia de qualquer outro, por mais privilegiado que seja.

E, por estarem justas e contratadas, as partes assinam o presente instrumento em duas vias de igual teor.

Local e data: ${INTERMEDIADORA.cidade}, [data_atual]

____________________________________
VENDEDOR: [vendedor_name]

____________________________________
INTERMEDIADORA: ${INTERMEDIADORA.name}`;

/* ── Modelo B · Compra e Venda ──────────────────────────── */
const TEMPLATE_COMPRA_VENDA = `CONTRATO DE COMPRA E VENDA DE VEÍCULO

Pelo presente instrumento particular, as partes abaixo identificadas:

VENDEDOR: [vendedor_name], CPF: [vendedor_cpf_cnpj], residente e domiciliado em [vendedor_address].

COMPRADOR: [comprador_name], CPF: [comprador_cpf_cnpj], residente e domiciliado em [comprador_address].

OBJETO: Venda do veículo marca/modelo [vehicle_brand_model], placa [vehicle_plate], ano [vehicle_year_model], chassi [vehicle_chassi], RENAVAM [vehicle_renavam].

CLÁUSULA 1 - O vendedor declara ser legítimo proprietário do veículo e que este encontra-se livre de ônus, multas e débitos, salvo os expressamente informados neste contrato.

CLÁUSULA 2 - O valor total da venda é de [sale_value], pago na data de assinatura deste contrato.

CLÁUSULA 3 - O comprador se compromete a realizar a transferência do veículo junto ao Detran no prazo legal de 30 (trinta) dias.

CLÁUSULA 4 - Após a assinatura, a posse do veículo é transferida ao comprador, bem como todas as responsabilidades sobre multas, acidentes e demais encargos.

E por estarem assim justos e contratados, assinam o presente instrumento em duas vias de igual teor.

Local e data: ${INTERMEDIADORA.cidade}, [data_atual]

____________________________________
Assinatura do Vendedor: [vendedor_name]

____________________________________
Assinatura do Comprador: [comprador_name]`;

/* ── Modelo C · Procuração ──────────────────────────────── */
const TEMPLATE_PROCURACAO = `PROCURAÇÃO PARA FINS DE TRÂMITE VEICULAR

OUTORGANTE:
[vendedor_name], inscrito(a) no CPF/CNPJ sob o nº [vendedor_cpf_cnpj], residente e domiciliado(a) em [vendedor_address].

OUTORGADO:
[comprador_name], inscrito(a) no CPF/CNPJ sob o nº [comprador_cpf_cnpj], residente e domiciliado(a) em [comprador_address].

VEÍCULO OBJETO DOS PODERES:
Marca/Modelo: [vehicle_brand_model]
Ano/Modelo: [vehicle_year_model]
Placa: [vehicle_plate]
RENAVAM: [vehicle_renavam]
Chassi: [vehicle_chassi]

PODERES:
Pelo presente instrumento particular de procuração, o OUTORGANTE nomeia e constitui o OUTORGADO como seu bastante procurador, a quem confere poderes específicos para, com relação exclusivamente ao veículo acima identificado:

I - representá-lo perante o DETRAN, CIRETRAN e demais órgãos executivos de trânsito, estaduais ou municipais;
II - requerer, assinar e retirar documentos relativos ao veículo, incluindo CRV, CRLV e segundas vias;
III - promover a transferência de propriedade do veículo, assinando o documento único de transferência (ATPV-e) e reconhecendo firmas quando exigido;
IV - efetuar a quitação de débitos, multas, taxas, IPVA, licenciamento e demais encargos incidentes sobre o veículo;
V - solicitar baixas de restrições, emissão de certidões e vistorias;
VI - substabelecer, no todo ou em parte, os poderes ora conferidos, quando indispensável ao cumprimento do presente mandato.

A presente procuração é outorgada em caráter específico para os fins acima descritos, sendo vedada sua utilização para qualquer outra finalidade.

Validade: a presente procuração terá validade de 90 (noventa) dias a contar da data de sua assinatura, salvo revogação expressa anterior.

Local e data: ${INTERMEDIADORA.cidade}, [data_atual]

____________________________________
OUTORGANTE: [vendedor_name]
CPF/CNPJ: [vendedor_cpf_cnpj]`;

export const CONTRACT_TEMPLATES: Record<ContractType, string> = {
  intermediacao: TEMPLATE_INTERMEDIACAO,
  compra_venda: TEMPLATE_COMPRA_VENDA,
  procuracao: TEMPLATE_PROCURACAO,
};

/** Rótulos das partes por tipo (o form muda: comprador vira outorgado etc.). */
export const PARTY_LABELS: Record<
  ContractType,
  { vendedor: string; comprador: string | null }
> = {
  intermediacao: { vendedor: "Proprietário / Vendedor", comprador: null },
  compra_venda: { vendedor: "Vendedor", comprador: "Comprador" },
  procuracao: { vendedor: "Outorgante (Vendedor)", comprador: "Outorgado (Comprador/Intermediário)" },
};
