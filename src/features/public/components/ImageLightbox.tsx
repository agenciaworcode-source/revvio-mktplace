import { useEffect, useRef } from "react";
import { Icon } from "./icons";

/* ── Lightbox de fotos em tela cheia ──────────────────────────
   Componente controlado: o pai decide quando montar (index) e
   recebe onClose / onIndex. Sem estado de abertura próprio. */
export function ImageLightbox({
  images,
  index,
  onClose,
  onIndex,
}: {
  images: string[];
  index: number;
  onClose: () => void;
  onIndex: (i: number) => void;
}) {
  const total = images.length;
  const go = (d: number) => onIndex((index + d + total) % total);

  // teclado: ← → navega, Esc fecha
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // trava o scroll do body enquanto aberto
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // mantém a miniatura ativa visível
  const thumbRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    thumbRef.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [index]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Galeria de fotos do veículo"
      onClick={onClose}
      className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm"
    >
      {/* topo: contador + fechar */}
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <span className="rounded-md bg-white/10 px-2.5 py-1 text-sm font-semibold">
          {index + 1} / {total}
        </span>
        <button
          onClick={onClose}
          aria-label="Fechar"
          className="grid h-10 w-10 place-items-center rounded-full text-white/90 hover:bg-white/10"
        >
          <Icon name="x" size={24} />
        </button>
      </div>

      {/* imagem principal */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-2 sm:px-16">
        <img
          src={images[index]}
          alt=""
          onClick={(e) => e.stopPropagation()}
          className="max-h-full max-w-full select-none object-contain"
        />

        {total > 1 && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                go(-1);
              }}
              aria-label="Anterior"
              className="absolute left-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-slate-800 shadow hover:bg-white sm:left-4"
            >
              <Icon name="chevronLeft" size={22} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                go(1);
              }}
              aria-label="Próxima"
              className="absolute right-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-slate-800 shadow hover:bg-white sm:right-4"
            >
              <Icon name="chevronRight" size={22} />
            </button>
          </>
        )}
      </div>

      {/* tira de miniaturas */}
      {total > 1 && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="flex gap-2 overflow-x-auto px-4 py-3"
        >
          {images.map((src, i) => (
            <button
              key={i}
              ref={i === index ? thumbRef : null}
              onClick={() => onIndex(i)}
              aria-label={`Foto ${i + 1}`}
              aria-current={i === index}
              className={`h-16 w-24 shrink-0 overflow-hidden rounded-md ring-2 transition ${
                i === index
                  ? "ring-brand opacity-100"
                  : "ring-transparent opacity-60 hover:opacity-100"
              }`}
            >
              <img src={src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
