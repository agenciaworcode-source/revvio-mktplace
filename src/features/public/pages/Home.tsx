import { PublicShell } from "../PublicShell";
import { HomeHero } from "../components/home/HomeHero";
import { HomeMarcas } from "../components/home/HomeMarcas";
import { HomeQuemSomos } from "../components/home/HomeQuemSomos";
import { useSiteSettings, SITE_SETTINGS_PADRAO } from "../queries";
import { Seo } from "@/components/Seo";
import { homeJsonLd } from "@/lib/structuredData";

export function Home() {
  const { data: settings } = useSiteSettings();
  return (
    <PublicShell current="home">
      <Seo
        title="Revvender — Compre e venda veículos com procedência"
        description="Marketplace de veículos da Revvender: carros, motos e caminhões com procedência e contato direto com a loja. Anuncie e venda com facilidade."
        path="/"
        jsonLd={homeJsonLd()}
      />
      {/* O herói é um carrossel de imagens, então a página não tinha nenhum h1 —
          nem para o buscador nem para leitor de tela. Este dá identidade à
          página sem mexer no desenho. */}
      <h1 className="sr-only">
        Revvender — marketplace de carros, motos e caminhões com procedência
      </h1>
      {/* A home é do comprador: os planos ficam só em /vender, o funil do garagista. */}
      <HomeHero settings={settings ?? SITE_SETTINGS_PADRAO} />
      <HomeMarcas />
      <HomeQuemSomos />
    </PublicShell>
  );
}
