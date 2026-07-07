import { Helmet } from "react-helmet-async";

/** Origem canônica do site em produção. */
export const SITE_URL = "https://loja.revvio.com.br";
const DEFAULT_IMAGE = `${SITE_URL}/og-image.jpg`;

/**
 * SEO por página (client-side, via react-helmet-async).
 * Ajuda o Google (que renderiza JS) e a UX da aba do navegador.
 * Obs: scrapers sociais (WhatsApp/Facebook) NÃO rodam JS — o preview
 * social dos links compartilhados depende da Fase 3 (prerender p/ bots).
 */
export function Seo({
  title,
  description,
  path,
  image,
  type = "website",
  noindex = false,
}: {
  /** Título específico da página; recebe o sufixo " | Revvio". */
  title: string;
  description?: string;
  /** Caminho da rota (ex.: "/comprar") — vira canonical e og:url. */
  path?: string;
  /** URL absoluta ou caminho local; default = og-image padrão. */
  image?: string;
  type?: "website" | "article" | "product";
  noindex?: boolean;
}) {
  const fullTitle = title.toLowerCase().includes("revvio") ? title : `${title} | Revvio`;
  const url = path ? `${SITE_URL}${path}` : undefined;
  const img = image
    ? image.startsWith("http")
      ? image
      : `${SITE_URL}${image}`
    : DEFAULT_IMAGE;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      {description && <meta name="description" content={description} />}
      {url && <link rel="canonical" href={url} />}
      {noindex && <meta name="robots" content="noindex, nofollow" />}

      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      {description && <meta property="og:description" content={description} />}
      {url && <meta property="og:url" content={url} />}
      <meta property="og:image" content={img} />

      <meta name="twitter:title" content={fullTitle} />
      {description && <meta name="twitter:description" content={description} />}
      <meta name="twitter:image" content={img} />
    </Helmet>
  );
}
