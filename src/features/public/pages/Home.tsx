import { PublicShell } from "../PublicShell";
import { HomeHero } from "../components/home/HomeHero";
import { HomeAnunciar } from "../components/home/HomeAnunciar";
import { HomeMarcas } from "../components/home/HomeMarcas";
import { HomeQuemSomos } from "../components/home/HomeQuemSomos";
import { useSiteSettings } from "../queries";

export function Home() {
  const { data: settings } = useSiteSettings();
  return (
    <PublicShell current="home">
      <HomeHero bannerUrl={settings?.home_banner_url} />
      <HomeAnunciar />
      <HomeMarcas />
      <HomeQuemSomos />
    </PublicShell>
  );
}
