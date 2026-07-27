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
