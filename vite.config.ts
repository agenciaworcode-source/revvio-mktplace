import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import {
  normalizeSiteUrl,
  ROBOTS_DISALLOW,
  SITEMAP_ROUTES,
} from "./src/config/site";

/**
 * Injeta o domínio nas meta tags do index.html e gera robots.txt/sitemap.xml.
 *
 * Antes o domínio estava escrito à mão em canonical, og:url, og:image,
 * twitter:image, robots.txt e sitemap.xml — trocar exigia lembrar de 7 lugares
 * e um esquecido só aparece quando o link compartilhado abre errado.
 * Agora tudo sai de VITE_SITE_URL (ou do padrão em src/config/site.ts).
 */
function seoUrls(siteUrl: string): Plugin {
  return {
    name: "revvender-seo-urls",
    // `order: "pre"` é obrigatório: o vite:build-html roda decodeURI() nos
    // href, então o placeholder precisa já ter virado URL antes dele.
    transformIndexHtml: {
      order: "pre",
      handler(html: string) {
        return html.replace(/__SITE_URL__/g, siteUrl);
      },
    },
    generateBundle() {
      const robots = [
        "User-agent: *",
        "Allow: /",
        "",
        "# Áreas autenticadas / sem valor de indexação",
        ...ROBOTS_DISALLOW.map((p) => `Disallow: ${p}`),
        "",
        `Sitemap: ${siteUrl}/sitemap.xml`,
        "",
      ].join("\n");

      const sitemap = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        "<!--",
        "  Gerado no build a partir de src/config/site.ts.",
        "  As URLs dinâmicas (/veiculo/:id, /loja/:slug) dependem da Edge",
        "  Function prevista na Fase 2 do plano de SEO.",
        "-->",
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ...SITEMAP_ROUTES.flatMap((r) => [
          "  <url>",
          `    <loc>${siteUrl}${r.path}</loc>`,
          `    <changefreq>${r.changefreq}</changefreq>`,
          `    <priority>${r.priority}</priority>`,
          "  </url>",
        ]),
        "</urlset>",
        "",
      ].join("\n");

      this.emitFile({ type: "asset", fileName: "robots.txt", source: robots });
      this.emitFile({ type: "asset", fileName: "sitemap.xml", source: sitemap });
    },
  };
}

export default defineConfig(({ mode }) => {
  // O "" no terceiro argumento carrega todas as variáveis, não só as VITE_*.
  const env = loadEnv(mode, process.cwd(), "");
  const siteUrl = normalizeSiteUrl(env.VITE_SITE_URL);

  return {
    plugins: [react(), seoUrls(siteUrl)],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      port: 5173,
    },
  };
});
