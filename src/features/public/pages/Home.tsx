import { PublicShell } from "../PublicShell";
import { HomeHero } from "../components/home/HomeHero";
import { HomeMarcas } from "../components/home/HomeMarcas";
import { HomeQuemSomos } from "../components/home/HomeQuemSomos";
import { useSiteSettings } from "../queries";
import { Seo } from "@/components/Seo";

export function Home() {
  const { data: settings } = useSiteSettings();
  return (
    <PublicShell current="home">
      <Seo
        title="Revvio — Compre e venda veículos com procedência"
        description="Marketplace de veículos da Revvio: carros, motos e caminhões com procedência e contato direto com a loja. Anuncie e venda com facilidade."
        path="/"
      />
      {/* A home é do comprador: os planos ficam só em /vender, o funil do garagista. */}
      <HomeHero bannerUrl={settings?.home_banner_url} />
      <HomeMarcas />
      <HomeQuemSomos />
    </PublicShell>
  );
}
