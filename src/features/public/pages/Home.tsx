import { PublicShell } from "../PublicShell";
import { HomeHero } from "../components/home/HomeHero";
import { HomeAnunciar } from "../components/home/HomeAnunciar";
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
      <HomeHero bannerUrl={settings?.home_banner_url} />
      <HomeAnunciar />
      <HomeMarcas />
      <HomeQuemSomos />
    </PublicShell>
  );
}
