/** Converte um nome em slug url-safe: "Garagem do João" → "garagem-do-joao". */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove marcas diacríticas (acentos)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-") // não-alfanumérico → hífen
    .replace(/^-+|-+$/g, "") // hífens das pontas
    .slice(0, 80);
}

/** Sufixo curto aleatório para desambiguar slugs em colisão. */
export function randomSuffix(len = 4): string {
  return Math.random()
    .toString(36)
    .slice(2, 2 + len);
}
