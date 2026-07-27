/**
 * Código curto do anúncio, usado para rastrear de qual veículo veio uma
 * conversa que chegou pelo WhatsApp.
 *
 * É o próprio `rv_vehicles.id` (serial) com prefixo: continua curto, é único
 * e a busca no banco é direta, sem tabela de/para. Não expõe nada novo — o id
 * já aparece na URL pública do anúncio (/veiculo/:id).
 */
export function vehicleRef(id: number | string): string {
  return `RV-${id}`;
}

/** Extrai o id de um código (`"RV-1042"` → `1042`). Útil ao resolver um
 *  código colado pelo garagista. Devolve null se não for um código válido. */
export function parseVehicleRef(ref: string): number | null {
  const m = /^\s*RV-(\d+)\s*$/i.exec(ref);
  return m ? Number(m[1]) : null;
}

/**
 * Casa um termo de busca com o código do anúncio. O garagista copia o texto do
 * WhatsApp de formas diferentes, então aceitamos `RV-1042`, `rv 1042`, `#1042`
 * e `1042`. Só considera o termo quando ele é de fato um código — assim a
 * busca por texto (marca/modelo) segue funcionando normalmente.
 */
export function matchesVehicleRef(term: string, id: number): boolean {
  const digits = term.trim().toLowerCase().replace(/^#/, "").replace(/^rv[-\s]?/, "");
  return /^\d+$/.test(digits) && Number(digits) === id;
}
