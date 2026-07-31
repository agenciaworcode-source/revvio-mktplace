import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../icons";
import type { HomeSlide, SiteSettings } from "../../queries";

const FALLBACK_IMG =
  "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1600&h=548&q=75";

/** Link externo (http/https/mailto/tel) sai em nova aba; o resto é rota interna. */
function isExterno(url: string): boolean {
  return /^(https?:|mailto:|tel:)/i.test(url.trim());
}

function CtaButton({
  label,
  url,
  variant,
}: {
  label: string;
  url: string;
  variant: "primary" | "outline";
}) {
  const cls =
    variant === "primary"
      ? "bg-brand text-white hover:bg-brand-dark shadow-[0_8px_22px_theme(colors.brand.DEFAULT/0.35)]"
      : "border border-white/70 bg-white/10 text-white backdrop-blur hover:bg-white/20";
  const className = `inline-flex items-center justify-center rounded-xl px-5 py-3 text-[14px] font-bold transition-colors sm:px-6 ${cls}`;
  const alvo = url.trim();
  return isExterno(alvo) ? (
    <a href={alvo} target="_blank" rel="noreferrer noopener" className={className}>
      {label}
    </a>
  ) : (
    <Link to={alvo || "/"} className={className}>
      {label}
    </Link>
  );
}

function Slide({ slide, ativo }: { slide: HomeSlide; ativo: boolean }) {
  const desktop = slide.image_url;
  const mobile = slide.image_mobile_url;
  const temTexto = !!(slide.title || slide.subtitle || slide.cta_label || slide.cta2_label);

  return (
    <div
      className={`absolute inset-0 transition-opacity duration-700 ${
        ativo ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
      aria-hidden={!ativo}
    >
      {/* Uma imagem por tamanho de tela: o celular só baixa a dele. */}
      <picture className="block h-full w-full">
        {mobile && <source media="(max-width: 639px)" srcSet={mobile} />}
        <img
          src={desktop ?? mobile ?? FALLBACK_IMG}
          alt={slide.title ?? ""}
          className="h-full w-full object-cover"
        />
      </picture>

      {temTexto && (
        <>
          {/* Véu só quando há texto — banner sem texto fica com a cor original. */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
          <div className="absolute inset-0 flex items-center">
            <div className="mx-auto w-full max-w-[1100px] px-5 pb-24 sm:px-7 sm:pb-28">
              <div className="max-w-[560px]">
                {slide.title && (
                  <h2 className="font-display text-[clamp(26px,5vw,44px)] font-extrabold leading-[1.1] tracking-tight text-white drop-shadow">
                    {slide.title}
                  </h2>
                )}
                {slide.subtitle && (
                  <p className="mt-3 max-w-[460px] text-[15px] leading-relaxed text-white/90 sm:text-[17px]">
                    {slide.subtitle}
                  </p>
                )}
                {(slide.cta_label || slide.cta2_label) && (
                  <div className="mt-6 flex flex-wrap gap-3">
                    {slide.cta_label && slide.cta_url && (
                      <CtaButton
                        label={slide.cta_label}
                        url={slide.cta_url}
                        variant="primary"
                      />
                    )}
                    {slide.cta2_label && slide.cta2_url && (
                      <CtaButton
                        label={slide.cta2_label}
                        url={slide.cta2_url}
                        variant="outline"
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Carrossel do topo da home. Os slides vêm de `rv_home_slides` (geridos em
 * Aparência); sem nenhum slide ativo, cai no banner único antigo e, por fim,
 * numa foto de banco de imagens.
 */
export function HomeCarousel({
  slides,
  config,
}: {
  slides: HomeSlide[];
  config: SiteSettings;
}) {
  const lista: HomeSlide[] = slides.length
    ? slides
    : [
        {
          id: "fallback",
          image_url: config.home_banner_url,
          image_mobile_url: null,
          title: null,
          subtitle: null,
          cta_label: null,
          cta_url: null,
          cta2_label: null,
          cta2_url: null,
          sort_order: 0,
          active: true,
        },
      ];

  const [i, setI] = useState(0);
  const [pausado, setPausado] = useState(false);
  const total = lista.length;

  const ir = useCallback((n: number) => setI(((n % total) + total) % total), [total]);
  const proximo = useCallback(() => ir(i + 1), [i, ir]);
  const anterior = useCallback(() => ir(i - 1), [i, ir]);

  // Índice fora da faixa depois de o admin apagar um slide.
  useEffect(() => {
    if (i >= total) setI(0);
  }, [i, total]);

  // Autoplay: respeita o "reduzir movimento" do sistema e pausa no hover/foco.
  const reduzMovimento = useRef(false);
  useEffect(() => {
    reduzMovimento.current =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  }, []);

  useEffect(() => {
    if (!config.carousel_autoplay || pausado || total < 2 || reduzMovimento.current) return;
    const ms = Math.max(2000, config.carousel_interval_ms || 6000);
    const t = window.setTimeout(proximo, ms);
    return () => window.clearTimeout(t);
  }, [config.carousel_autoplay, config.carousel_interval_ms, pausado, total, proximo, i]);

  const mostraControles = total > 1;

  return (
    <div
      className="relative h-[460px] w-full overflow-hidden sm:h-[548px]"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onFocusCapture={() => setPausado(true)}
      onBlurCapture={() => setPausado(false)}
      role="region"
      aria-roledescription="carrossel"
      aria-label="Destaques"
    >
      {lista.map((s, idx) => (
        <Slide key={s.id} slide={s} ativo={idx === i} />
      ))}

      {mostraControles && config.carousel_show_arrows && (
        <>
          <button
            type="button"
            onClick={anterior}
            aria-label="Slide anterior"
            className="absolute left-3 top-1/2 z-20 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/30 bg-black/35 text-white backdrop-blur transition-colors hover:bg-black/60 sm:left-6"
          >
            <Icon name="chevronLeft" size={22} />
          </button>
          <button
            type="button"
            onClick={proximo}
            aria-label="Próximo slide"
            className="absolute right-3 top-1/2 z-20 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/30 bg-black/35 text-white backdrop-blur transition-colors hover:bg-black/60 sm:right-6"
          >
            <Icon name="chevronRight" size={22} />
          </button>
        </>
      )}

      {mostraControles && config.carousel_show_dots && (
        // Acima da Busca Rápida, que cobre a metade de baixo do banner.
        <div className="absolute bottom-[132px] left-1/2 z-20 flex -translate-x-1/2 gap-2 sm:bottom-[150px]">
          {lista.map((s, idx) => (
            <button
              key={s.id}
              type="button"
              onClick={() => ir(idx)}
              aria-label={`Ir para o slide ${idx + 1}`}
              aria-current={idx === i}
              className={`h-2.5 rounded-full transition-all ${
                idx === i ? "w-7 bg-white" : "w-2.5 bg-white/50 hover:bg-white/80"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
