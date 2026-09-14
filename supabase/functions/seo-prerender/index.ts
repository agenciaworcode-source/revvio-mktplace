// ============================================================
// seo-prerender — HTML com meta tags para raspadores sociais.
//
// O site é uma SPA: o index.html é igual em toda rota e as tags certas só
// aparecem depois que o React roda. O Google executa JavaScript e enxerga; o
// WhatsApp, o Facebook e afins NÃO executam — então todo link compartilhado
// mostrava o título e a imagem genéricos da home. Sendo o WhatsApp o canal
// principal deste produto, é a perda mais cara do SEO atual.
//
// Esta function devolve, para esses raspadores, um HTML mínimo com as meta
// tags da rota pedida. O nginx roteia por User-Agent — ver nginx.conf.
//
// **Buscador não passa por aqui, de propósito.** Googlebot e Bingbot
// renderizam JS e já leem as tags do <Seo>; mandar HTML diferente para eles
// seria cloaking sem necessidade. A lista de raspadores vive no nginx.
//
// O conteúdo declarado é o mesmo que o visitante vê — título, descrição e foto
// do anúncio —, então não há divergência entre o que o raspador lê e a página.
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SITE_URL = (Deno.env.get("APP_URL") ?? "https://revvender.com.br").replace(
  /\/+$/,
  ""
);
const SITE_NAME = "Revvender";
const IMAGEM_PADRAO = `${SITE_URL}/og-image.jpg`;

// Cliente com a anon key: a leitura atravessa a mesma RLS do site, então esta
// function não consegue expor anúncio de loja suspensa nem veículo removido.
const db = createClient(SUPABASE_URL, ANON_KEY);

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(v ?? 0)
  );

/**
 * Converte a URL pública de um objeto do Storage na URL de transformação, em
 * 1200x630 — a proporção que Facebook e WhatsApp esperam num card.
 *
 * Não é estética: a foto original do anúncio tem ~430 KB, e acima de ~300 KB o
 * WhatsApp costuma desistir de renderizar a imagem e mostra o card só com
 * texto, ou nenhum. A mesma foto transformada cai para ~110 KB.
 *
 * URL que não seja do Storage (a og-image padrão) passa intacta — ela já é
 * 1200x630.
 */
function imagemOg(url: string): string {
  const marca = "/storage/v1/object/public/";
  if (!url.includes(marca)) return url;
  const base = url.replace(marca, "/storage/v1/render/image/public/");
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}width=1200&height=630&resize=cover&quality=75`;
}

function escapar(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type Meta = {
  titulo: string;
  descricao: string;
  imagem: string;
  caminho: string;
  tipo: "website" | "product";
};

const PADRAO: Omit<Meta, "caminho"> = {
  titulo: `${SITE_NAME} — Compre e venda veículos com procedência`,
  descricao:
    "Marketplace de veículos da Revvender: carros, motos e caminhões com procedência e contato direto com a loja.",
  imagem: IMAGEM_PADRAO,
  tipo: "website",
};

/** Rotas sem dado no banco: o texto acompanha o que o <Seo> declara na página. */
const ESTATICAS: Record<string, Omit<Meta, "caminho" | "imagem" | "tipo">> = {
  "/comprar": {
    titulo: "Comprar veículos",
    descricao:
      "Encontre carros, motos e caminhões com procedência no marketplace da Revvender. Filtre por marca, modelo, ano e preço e fale direto com a loja.",
  },
  "/vender": {
    titulo: "Anuncie sua garagem",
    descricao:
      "Crie a sua mini-loja na Revvender e anuncie carros, motos e caminhões. Sem comissão por venda, contato direto com o comprador pelo WhatsApp.",
  },
  "/tabela-fipe": {
    titulo: "Tabela FIPE 2026",
    descricao:
      "Consulte o valor médio de carros pela tabela FIPE. Selecione marca, modelo e ano e veja o preço atualizado.",
  },
  "/politica-de-privacidade": {
    titulo: "Política de Privacidade",
    descricao:
      "Como a plataforma coleta, utiliza e protege os seus dados pessoais, em conformidade com a LGPD.",
  },
  "/termos-e-condicoes": {
    titulo: "Termos e Condições",
    descricao: "Termos de uso da plataforma Revvender.",
  },
};

async function metaDoAnuncio(id: string): Promise<Meta | null> {
  const { data } = await db
    .from("rv_vehicles")
    .select(
      "id, make, model, year, price, mileage, images, status, seller:rv_sellers!rv_vehicles_seller_id_fkey(name, status)"
    )
    .eq("id", id)
    .maybeSingle();

  // Sem linha, veículo indisponível ou loja inativa: cai no padrão, para não
  // gerar prévia de um anúncio que o visitante não conseguiria abrir.
  const seller = (data as { seller?: { name?: string; status?: string } } | null)
    ?.seller;
  if (!data || data.status !== "available" || seller?.status !== "active")
    return null;

  const nome = `${data.make} ${data.model}${data.year ? ` ${data.year}` : ""}`;
  const partes = [
    nome,
    data.mileage != null
      ? `${new Intl.NumberFormat("pt-BR").format(data.mileage)} km`
      : null,
  ].filter(Boolean);

  return {
    titulo: `${nome} — ${brl(data.price)} | ${SITE_NAME}`,
    descricao: `${partes.join(" · ")} — à venda${
      seller?.name ? ` na ${seller.name}` : ""
    } por ${brl(data.price)}.`,
    imagem: data.images?.[0] || IMAGEM_PADRAO,
    caminho: `/veiculo/${data.id}`,
    tipo: "product",
  };
}

async function metaDaLoja(slug: string): Promise<Meta | null> {
  const { data } = await db
    .from("rv_sellers")
    .select("name, slug, bio, city, state, avatar_url, banner_url, status")
    .eq("slug", slug)
    .maybeSingle();

  if (!data || data.status !== "active") return null;

  const local = [data.city, data.state].filter(Boolean).join(", ");
  return {
    titulo: `${data.name} — Loja na ${SITE_NAME}`,
    descricao:
      data.bio ||
      `Veículos à venda na ${data.name}${
        local ? ` em ${local}` : ""
      }. Confira o estoque e fale direto com a loja.`,
    imagem: data.banner_url || data.avatar_url || IMAGEM_PADRAO,
    caminho: `/loja/${data.slug}`,
    tipo: "website",
  };
}

async function resolver(caminho: string): Promise<Meta> {
  const limpo = caminho.split("?")[0].replace(/\/+$/, "") || "/";

  const anuncio = limpo.match(/^\/veiculo\/([^/]+)$/);
  if (anuncio) {
    const m = await metaDoAnuncio(anuncio[1]);
    if (m) return m;
  }

  const loja = limpo.match(/^\/loja\/([^/]+)$/);
  if (loja) {
    const m = await metaDaLoja(loja[1]);
    if (m) return m;
  }

  const fixa = ESTATICAS[limpo];
  if (fixa)
    return {
      ...fixa,
      titulo: `${fixa.titulo} | ${SITE_NAME}`,
      imagem: IMAGEM_PADRAO,
      caminho: limpo,
      tipo: "website",
    };

  return { ...PADRAO, caminho: limpo === "/" ? "/" : limpo };
}

function html(m: Meta): string {
  const url = `${SITE_URL}${m.caminho}`;
  const t = escapar(m.titulo);
  const d = escapar(m.descricao);
  const img = escapar(imagemOg(m.imagem));
  // O corpo repete o que as tags declaram: o raspador lê o mesmo que a página
  // mostra, e uma pessoa que caia aqui por engano tem o link para o site.
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${t}</title>
<meta name="description" content="${d}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="${m.tipo}">
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:locale" content="pt_BR">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:image" content="${img}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:type" content="image/jpeg">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
<meta name="twitter:image" content="${img}">
</head>
<body>
<h1>${t}</h1>
<p>${d}</p>
<img src="${img}" alt="${t}" width="600">
<p><a href="${url}">Abrir na ${SITE_NAME}</a></p>
</body>
</html>`;
}

Deno.serve(async (req) => {
  try {
    const u = new URL(req.url);
    // O nginx acrescenta o caminho original ao nome da function:
    // /seo-prerender/veiculo/27 → /veiculo/27
    const caminho = u.pathname.replace(/^\/seo-prerender/, "") || "/";
    const meta = await resolver(caminho + u.search);

    return new Response(html(meta), {
      headers: {
        "content-type": "text/html; charset=utf-8",
        // O mesmo link costuma ser raspado várias vezes seguidas.
        "cache-control": "public, max-age=300",
      },
    });
  } catch (e) {
    console.error("seo-prerender:", e);
    // Nunca devolve erro: prévia genérica é melhor que link sem prévia.
    return new Response(html({ ...PADRAO, caminho: "/" }), {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});
