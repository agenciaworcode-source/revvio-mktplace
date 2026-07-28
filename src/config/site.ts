/**
 * Identificação pública do site — domínio, e-mail e nome da marca.
 *
 * Este arquivo é lido tanto pelo app quanto pelo `vite.config.ts`, que usa os
 * valores para gerar as meta tags do `index.html`, o `robots.txt` e o
 * `sitemap.xml` no build. Não importe nada de `src/` aqui: o Vite carrega
 * este módulo fora do contexto do navegador.
 *
 * Para trocar o domínio basta definir `VITE_SITE_URL` no ambiente (Coolify) —
 * os valores abaixo são só o padrão de quando a variável não existe.
 */

/** Usado quando `VITE_SITE_URL` não está definida. */
export const DEFAULT_SITE_URL = "https://loja.revvio.com.br";

export const CONTACT_EMAIL = "contato@revvio.com.br";

export const SITE_NAME = "Revvender";

/** Tira a barra final para as URLs montadas não saírem com barra dupla. */
export function normalizeSiteUrl(url: string | undefined): string {
  return (url || DEFAULT_SITE_URL).trim().replace(/\/+$/, "");
}

/** Rotas públicas fixas do sitemap. As dinâmicas (/veiculo/:id, /loja/:slug)
 *  dependem da Edge Function prevista na Fase 2 do plano de SEO. */
export const SITEMAP_ROUTES: {
  path: string;
  changefreq: string;
  priority: string;
}[] = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/comprar", changefreq: "daily", priority: "0.9" },
  { path: "/vender", changefreq: "weekly", priority: "0.8" },
  { path: "/politica-de-privacidade", changefreq: "yearly", priority: "0.3" },
  { path: "/termos-e-condicoes", changefreq: "yearly", priority: "0.3" },
];

/** Rotas autenticadas ou sem valor de indexação. */
export const ROBOTS_DISALLOW = [
  "/painel",
  "/dashboard",
  "/minha-conta",
  "/login",
  "/cadastro",
  "/cadastro-vendedor",
  "/definir-senha",
];
