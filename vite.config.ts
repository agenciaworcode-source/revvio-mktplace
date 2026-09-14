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
type SitemapEntry = {
  path: string;
  changefreq: string;
  priority: string;
  lastmod?: string;
};

/**
 * Busca as rotas com conteúdo — anúncios e mini-lojas — para o sitemap.
 *
 * Usa a **anon key**, de propósito: a consulta atravessa a mesma RLS do site,
 * então o sitemap não consegue anunciar uma URL que o público não abriria.
 *
 * O `!inner` com o nome explícito da FK é obrigatório: `rv_vehicles` tem duas
 * relações com `rv_sellers` (`seller_id` e `created_by`) e o PostgREST recusa a
 * consulta ambígua com PGRST201.
 *
 * **Nunca derruba o build.** Sem rede, sem credencial ou com erro do PostgREST,
 * devolve lista vazia e avisa — o deploy sai com o sitemap das rotas fixas, que
 * é bem melhor que um deploy que não acontece.
 */
async function rotasDinamicas(
  supabaseUrl: string | undefined,
  anonKey: string | undefined
): Promise<SitemapEntry[]> {
  if (!supabaseUrl || !anonKey) {
    console.warn(
      "[sitemap] VITE_SUPABASE_URL/ANON_KEY ausentes — só as rotas fixas."
    );
    return [];
  }

  const get = async (query: string) => {
    const res = await fetch(`${supabaseUrl}/rest/v1/${query}`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    return (await res.json()) as Record<string, string>[];
  };

  const dia = (iso?: string) => (iso ? iso.slice(0, 10) : undefined);

  try {
    const [veiculos, lojas] = await Promise.all([
      get(
        "rv_vehicles?select=id,updated_at,seller:rv_sellers!rv_vehicles_seller_id_fkey!inner(status)" +
          "&status=eq.available&seller.status=eq.active"
      ),
      get("rv_sellers?select=slug,updated_at&status=eq.active&slug=not.is.null"),
    ]);

    const entradas: SitemapEntry[] = [
      ...veiculos.map((v) => ({
        path: `/veiculo/${v.id}`,
        changefreq: "weekly",
        priority: "0.8",
        lastmod: dia(v.updated_at),
      })),
      ...lojas.map((l) => ({
        path: `/loja/${l.slug}`,
        changefreq: "weekly",
        priority: "0.7",
        lastmod: dia(l.updated_at),
      })),
    ];
    console.log(
      `[sitemap] ${veiculos.length} anúncios + ${lojas.length} mini-lojas.`
    );
    return entradas;
  } catch (e) {
    console.warn(
      `[sitemap] falha ao consultar o Supabase (${
        e instanceof Error ? e.message : e
      }) — só as rotas fixas.`
    );
    return [];
  }
}

function seoUrls(
  siteUrl: string,
  supabaseUrl?: string,
  anonKey?: string
): Plugin {
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
    async generateBundle() {
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

      const dinamicas = await rotasDinamicas(supabaseUrl, anonKey);
      const todas: SitemapEntry[] = [...SITEMAP_ROUTES, ...dinamicas];

      const sitemap = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        "<!--",
        "  Gerado no build: rotas fixas de src/config/site.ts + anúncios e",
        "  mini-lojas consultados no Supabase com a anon key (mesma RLS do site).",
        "  Sem rede, saem só as fixas — o build nunca falha por causa disto.",
        "-->",
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ...todas.flatMap((r) => [
          "  <url>",
          `    <loc>${siteUrl}${r.path}</loc>`,
          ...(r.lastmod ? [`    <lastmod>${r.lastmod}</lastmod>`] : []),
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
    plugins: [
      react(),
      seoUrls(siteUrl, env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY),
    ],
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
