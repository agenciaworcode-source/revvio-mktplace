/**
 * Catálogo de marcas do bloco "Explore por marca" da home.
 *
 * `arquivo` aponta para `public/marcas/<pasta>/`. Marca sem `arquivo` é
 * renderizada como wordmark (o nome tipografado no lugar da logo): o Wikimedia
 * Commons não hospeda a logo dessas marcas por serem trademark protegida, e um
 * logotipo errado é pior do que nenhum — ver docs/marcas-logos.md.
 *
 * `busca` sobrescreve o termo enviado ao marketplace quando o nome exibido não
 * bate com o fabricante cadastrado (ex.: "BMW Motorrad" → "BMW").
 */
export type Marca = { nome: string; arquivo?: string; busca?: string };

/** As mais buscadas abrem cada lista; o resto segue em ordem alfabética. */
export const CARROS: Marca[] = [
  { nome: "Chevrolet", arquivo: "chevrolet.svg" },
  { nome: "Volkswagen", arquivo: "volkswagem.svg" },
  { nome: "Fiat", arquivo: "fiat.svg" },
  { nome: "Toyota", arquivo: "toyota.svg" },
  { nome: "Hyundai", arquivo: "hyundai.svg" },
  { nome: "Honda", arquivo: "honda.svg" },
  { nome: "Renault", arquivo: "renault.svg" },
  { nome: "Jeep", arquivo: "jeep.svg" },
  { nome: "Nissan", arquivo: "nissan.svg" },
  { nome: "Ford", arquivo: "ford.svg" },
  { nome: "Peugeot", arquivo: "peugeot.svg" },
  { nome: "Citroën", arquivo: "citroen.svg", busca: "Citro" },
  { nome: "Aston Martin" },
  { nome: "Audi", arquivo: "audi.svg" },
  { nome: "Bentley" },
  { nome: "BMW", arquivo: "bmw.svg" },
  { nome: "Caoa Chery", arquivo: "chery.svg", busca: "Chery" },
  { nome: "Chrysler", arquivo: "chrysler.svg" },
  { nome: "Dodge", arquivo: "dodge.svg" },
  { nome: "Ferrari" },
  { nome: "Geely", arquivo: "geely.svg" },
  { nome: "GWM", arquivo: "gwm.svg" },
  { nome: "Iveco", arquivo: "iveco.svg" },
  { nome: "JAC" },
  { nome: "Jaecoo", arquivo: "jaecoo.svg" },
  { nome: "Jaguar", arquivo: "jaguar.svg" },
  { nome: "Kia", arquivo: "kia.svg" },
  { nome: "Lamborghini", arquivo: "lamborghini.svg" },
  { nome: "Land Rover", arquivo: "land-rover.svg" },
  { nome: "Lexus", arquivo: "lexus.svg" },
  { nome: "Maserati", arquivo: "maserati.svg" },
  { nome: "McLaren", arquivo: "mclaren.svg" },
  { nome: "Mercedes-Benz", arquivo: "mercedes-benz.svg", busca: "Mercedes" },
  { nome: "MINI", arquivo: "mini.svg" },
  { nome: "Mitsubishi", arquivo: "mitsubishi.svg" },
  { nome: "Omoda", arquivo: "omoda.svg" },
  { nome: "Porsche", arquivo: "porsche.svg" },
  { nome: "RAM", arquivo: "ram.svg" },
  { nome: "Rolls-Royce", arquivo: "rolls-royce.svg" },
  { nome: "Subaru", arquivo: "subaru.svg" },
  { nome: "Suzuki", arquivo: "suzuki.svg" },
  { nome: "Troller" },
  { nome: "Volvo", arquivo: "volvo.svg" },
];

export const ELETRICOS: Marca[] = [
  { nome: "BYD", arquivo: "byd.svg" },
  { nome: "GAC Aion", arquivo: "aion.svg", busca: "Aion" },
  { nome: "Denza" },
  { nome: "Dongfeng", arquivo: "dongfeng.svg" },
  { nome: "Leapmotor", arquivo: "leapmotor.svg" },
  { nome: "Livan", arquivo: "livan.svg" },
  { nome: "Lotus" },
  { nome: "Neta" },
  { nome: "Polestar", arquivo: "polestar.svg" },
  { nome: "Seres" },
  { nome: "smart", arquivo: "smart.svg" },
  { nome: "Tesla", arquivo: "tesla.svg" },
  { nome: "Zeekr", arquivo: "zeekr.svg" },
];

export const MOTOS: Marca[] = [
  { nome: "Honda", arquivo: "honda.svg" },
  { nome: "Yamaha", arquivo: "yamaha.svg" },
  { nome: "Shineray" },
  { nome: "Haojue", arquivo: "haojue.svg" },
  { nome: "Suzuki", arquivo: "suzuki.svg" },
  { nome: "Dafra", arquivo: "dafra.png" },
  { nome: "Aprilia", arquivo: "aprilia.svg" },
  { nome: "Bajaj", arquivo: "bajaj.svg" },
  { nome: "BMW Motorrad", arquivo: "bmwmotor.svg", busca: "BMW" },
  { nome: "CFMOTO", arquivo: "cfmoto.svg" },
  { nome: "Ducati", arquivo: "ducati.svg" },
  { nome: "Harley-Davidson", arquivo: "harley-davidson.svg", busca: "Harley" },
  { nome: "Husqvarna", arquivo: "husqvarna.svg" },
  { nome: "Indian", arquivo: "indian.svg" },
  { nome: "Kawasaki", arquivo: "kawasaki.svg" },
  { nome: "KTM" },
  { nome: "Kymco", arquivo: "kymco.svg" },
  { nome: "MV Agusta", arquivo: "mv-agusta.svg" },
  { nome: "Royal Enfield", arquivo: "royal-enfield.svg" },
  { nome: "Triumph", arquivo: "triumph.svg" },
  { nome: "Voltz", arquivo: "voltz.svg" },
];
