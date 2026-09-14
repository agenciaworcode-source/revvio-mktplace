/**
 * Construtores de JSON-LD (schema.org) das páginas públicas.
 *
 * Por que existe: o Google entende o catálogo muito melhor com dado estruturado
 * do que inferindo do HTML. Num marketplace de veículos é o que habilita o
 * resultado rico com preço, ano e quilometragem direto na busca.
 *
 * Os construtores recebem só os campos que usam, em vez dos tipos do banco:
 * assim uma coluna renomeada quebra no ponto de chamada, com o erro apontando
 * para o lugar certo, e não silenciosamente aqui dentro.
 *
 * Cada função devolve `null` quando não há dado suficiente — página sem schema
 * é melhor que schema incompleto, que o Google trata como erro.
 *
 * O `<script type="application/ld+json">` é emitido pelo `<Seo jsonLd={...}>`.
 */
import { SITE_URL } from "@/components/Seo";
import { SITE_NAME } from "@/config/site";

/** Só emite a chave quando há valor — schema.org ignora `undefined`, mas o
 *  JSON.stringify deixaria `null` no documento, que conta como campo vazio. */
function clean<T extends Record<string, unknown>>(obj: T): T {
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (v === undefined || v === null || v === "") delete obj[k];
  }
  return obj;
}

function absolute(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  return url.startsWith("http") ? url : `${SITE_URL}${url}`;
}

/* ── Home ──────────────────────────────────────────────────── */

/**
 * `Organization` + `WebSite` na home.
 *
 * A plataforma é a Revvender; quem a opera é a REVVIO LTDA — daí o
 * `parentOrganization`, que é como o schema.org expressa essa relação.
 *
 * O `SearchAction` declara a busca do site: `/comprar` já lê `?q` da URL, então
 * o alvo é real, não decorativo.
 */
export function homeJsonLd(): object[] {
  return [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
      logo: `${SITE_URL}/brand/lockup-light.png`,
      parentOrganization: {
        "@type": "Organization",
        name: "REVVIO LTDA",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE_NAME,
      url: SITE_URL,
      inLanguage: "pt-BR",
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${SITE_URL}/comprar?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
  ];
}

/* ── Anúncio do veículo ────────────────────────────────────── */

export type VehicleSchemaInput = {
  id: number | string;
  make: string;
  model: string;
  year?: number | null;
  price: number;
  mileage?: number | null;
  color?: string | null;
  images?: string[] | null;
  /** Rótulos já traduzidos (Flex, Automático, SUV) — não os enums crus. */
  fuelLabel?: string | null;
  transmissionLabel?: string | null;
  bodyLabel?: string | null;
  sellerName?: string | null;
  sellerSlug?: string | null;
};

/**
 * `Vehicle` com a `Offer` aninhada.
 *
 * Só veículo `available` de loja ativa chega à vitrine pública, então
 * `InStock` é sempre verdade aqui — quem filtra é a consulta, não este módulo.
 */
export function vehicleJsonLd(v: VehicleSchemaInput): object | null {
  if (!v.make || !v.model || v.price == null) return null;

  const url = `${SITE_URL}/veiculo/${v.id}`;
  const name = `${v.make} ${v.model}${v.year ? ` ${v.year}` : ""}`;

  return clean({
    "@context": "https://schema.org",
    "@type": "Vehicle",
    name,
    url,
    brand: { "@type": "Brand", name: v.make },
    model: v.model,
    vehicleModelDate: v.year ? String(v.year) : undefined,
    color: v.color || undefined,
    fuelType: v.fuelLabel || undefined,
    vehicleTransmission: v.transmissionLabel || undefined,
    bodyType: v.bodyLabel || undefined,
    mileageFromOdometer:
      v.mileage != null
        ? { "@type": "QuantitativeValue", value: v.mileage, unitCode: "KMT" }
        : undefined,
    image: (v.images ?? []).map((i) => absolute(i)).filter(Boolean),
    offers: clean({
      "@type": "Offer",
      url,
      price: v.price,
      priceCurrency: "BRL",
      availability: "https://schema.org/InStock",
      itemCondition: "https://schema.org/UsedCondition",
      seller: v.sellerName
        ? clean({
            "@type": "AutoDealer",
            name: v.sellerName,
            url: v.sellerSlug ? `${SITE_URL}/loja/${v.sellerSlug}` : undefined,
          })
        : undefined,
    }),
  });
}

/* ── Mini-loja ─────────────────────────────────────────────── */

export type StoreSchemaInput = {
  name: string;
  /** Nulo em pessoa da equipe — só loja tem mini-loja pública (migration 0013). */
  slug: string | null;
  bio?: string | null;
  city?: string | null;
  state?: string | null;
  whatsapp?: string | null;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
};

/** `AutoDealer` da mini-loja. O endereço sai sem logradouro de propósito: o
 *  cadastro só tem cidade e UF, e endereço parcial inventado é pior que nenhum. */
export function storeJsonLd(s: StoreSchemaInput): object | null {
  if (!s.name || !s.slug) return null;

  const hasAddress = Boolean(s.city || s.state);

  return clean({
    "@context": "https://schema.org",
    "@type": "AutoDealer",
    name: s.name,
    url: `${SITE_URL}/loja/${s.slug}`,
    description: s.bio || undefined,
    image: absolute(s.avatarUrl) ?? absolute(s.bannerUrl),
    telephone: s.whatsapp || undefined,
    address: hasAddress
      ? clean({
          "@type": "PostalAddress",
          addressLocality: s.city || undefined,
          addressRegion: s.state || undefined,
          addressCountry: "BR",
        })
      : undefined,
  });
}

/* ── FAQ da página Vender ──────────────────────────────────── */

export function faqJsonLd(items: readonly (readonly [string, string])[]): object | null {
  if (!items.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map(([question, answer]) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  };
}

/* ── Trilha das páginas da FIPE ────────────────────────────── */

/** `BreadcrumbList` a partir dos degraus já navegados. `path` é relativo. */
export function breadcrumbJsonLd(
  steps: { name: string; path: string }[]
): object | null {
  if (steps.length < 2) return null;
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: steps.map((s, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: s.name,
      item: `${SITE_URL}${s.path}`,
    })),
  };
}
