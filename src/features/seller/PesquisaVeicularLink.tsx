import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/features/public/components/icons";

const PESQUISA_URL = "https://revvio.com.br";
const POPOVER_W = 296;

/**
 * Atalho da sidebar para a pesquisa veicular, que roda fora do sistema.
 *
 * O "?" abre a explicação no hover (desktop) e no clique (touch). O balão vai
 * para o body via portal: dentro da sidebar ele seria cortado pelo
 * `overflow-y-auto`, e o `transform` do drawer prenderia o `position: fixed`.
 */
export function PesquisaVeicularLink() {
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number>();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  function show() {
    window.clearTimeout(closeTimer.current);
    const r = btnRef.current?.getBoundingClientRect();
    if (r) {
      const vw = window.innerWidth;
      // Ao lado da sidebar quando cabe; senão logo abaixo do botão.
      const side = r.right + 12 + POPOVER_W <= vw - 16;
      setPos(
        side
          ? { top: Math.max(16, r.top - 12), left: r.right + 12 }
          : {
              top: r.bottom + 8,
              left: Math.min(Math.max(16, r.right - POPOVER_W), vw - POPOVER_W - 16),
            },
      );
    }
    setOpen(true);
  }

  // Pequeno atraso para dar tempo de levar o mouse do "?" até o balão.
  function scheduleClose() {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 150);
  }

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !popRef.current?.contains(t)) close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  return (
    <div className="mt-3 flex items-center gap-1.5">
      <a
        href={PESQUISA_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-w-0 flex-1 items-center gap-3 rounded-[11px] bg-emerald-500 px-3.5 py-[11px] text-sm font-bold text-white shadow-[0_6px_16px_rgba(48,153,116,0.35)] transition-colors hover:bg-emerald-600"
      >
        <Icon name="search" size={19} />
        <span className="truncate">Pesquisa veicular</span>
        <Icon name="externalLink" size={14} className="ml-auto opacity-80" />
      </a>
      <button
        ref={btnRef}
        type="button"
        onClick={() => (open ? setOpen(false) : show())}
        onMouseEnter={show}
        onMouseLeave={scheduleClose}
        className="grid h-[42px] w-9 flex-shrink-0 place-items-center rounded-[11px] text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-200"
        aria-label="O que é a pesquisa veicular?"
        aria-expanded={open}
        aria-controls="pesquisa-veicular-ajuda"
      >
        <Icon name="help" size={19} />
      </button>

      {open &&
        createPortal(
          <div
            ref={popRef}
            id="pesquisa-veicular-ajuda"
            role="tooltip"
            onMouseEnter={() => window.clearTimeout(closeTimer.current)}
            onMouseLeave={scheduleClose}
            className="fixed z-[60] rounded-xl border border-slate-200 bg-white p-4 text-left font-sans shadow-[0_12px_32px_rgba(15,23,42,0.18)]"
            style={{ top: pos.top, left: pos.left, width: POPOVER_W }}
          >
            <div className="mb-1.5 text-sm font-extrabold text-slate-900">
              Pesquisa veicular
            </div>
            <p className="mb-2.5 text-[13px] leading-relaxed text-slate-600">
              Consulte o histórico de um veículo pela placa antes de comprar ou
              anunciar:
            </p>
            <ul className="mb-3 flex flex-col gap-1.5 text-[13px] text-slate-700">
              {[
                "Passagem por leilão",
                "Registro de sinistro",
                "Ocorrência de roubo e furto",
                "Informações gerais do veículo",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Icon name="check" size={15} className="mt-0.5 text-emerald-500" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-[12px] text-slate-400">
              Abre em uma nova aba, no site revvio.com.br.
            </p>
          </div>,
          document.body,
        )}
    </div>
  );
}
