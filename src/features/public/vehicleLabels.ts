// Rótulos PT-BR dos enums do veículo (usados no marketplace, detalhe e painel).

export const fuelLabels: Record<string, string> = {
  flex: "Flex",
  gasolina: "Gasolina",
  diesel: "Diesel",
  etanol: "Etanol",
  hibrido: "Híbrido",
  eletrico: "Elétrico",
  gnv: "GNV",
};

export const transmissionLabels: Record<string, string> = {
  manual: "Manual",
  automatico: "Automático",
  automatizado: "Automatizado",
  cvt: "CVT",
};

export const bodyLabels: Record<string, string> = {
  hatch: "Hatch",
  sedan: "Sedã",
  suv: "SUV",
  picape: "Picape",
  utilitario: "Utilitário",
  cupe: "Cupê",
  conversivel: "Conversível",
  minivan: "Minivan",
};

// Opcionais selecionáveis no cadastro de veículo (multi-select).
// Base: filtros de opcionais de classificados (OLX/Webmotors) + clássicos.
// "Blindado" e "câmbio automático" ficam de fora — já são campos próprios.
export const VEHICLE_OPTIONS: string[] = [
  "Ar-condicionado",
  "Ar-condicionado digital",
  "Direção hidráulica",
  "Direção elétrica",
  "Vidros elétricos",
  "Travas elétricas",
  "Airbag",
  "Freios ABS",
  "Bancos de couro",
  "Alarme",
  "Sensor de estacionamento",
  "Câmera de ré",
  "Piloto automático",
  "Computador de bordo",
  "Rodas de liga leve",
  "Central multimídia",
  "Bluetooth",
  "Conexão USB",
  "GPS / Navegador",
  "Teto solar",
  "Faróis de neblina",
  "Faróis de LED",
  "Retrovisores elétricos",
  "Volante multifuncional",
  "Controle de tração",
  "Partida por botão",
  "Start/Stop",
  "Desembaçador traseiro",
  "Engate / reboque",
  "Banco com regulagem de altura",
  "Bancos com aquecimento",
  "Som",
];
