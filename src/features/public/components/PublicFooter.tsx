import { useState } from "react";
import { Link } from "react-router-dom";
import { BrandLogo } from "./BrandLogo";
import { Icon } from "./icons";
import { useAuth } from "@/features/auth/AuthProvider";
import { BuyerAuthModal } from "@/features/auth/components/BuyerAuthModal";
import {
  useLogClickEvent,
  PLATFORM_OWNER_SELLER_ID,
  type ClickKind,
} from "@/features/tracking/queries";

const COLS: { title: string; links: { label: string; to: string; ext?: boolean }[] }[] = [
  {
    title: "Menu",
    links: [
      { label: "Comprar", to: "/comprar" },
      { label: "Vender", to: "/vender" },
      { label: "Entrar", to: "/login" },
    ],
  },
  {
    title: "Anunciante",
    links: [
      { label: "Cadastrar minha loja", to: "/cadastro-vendedor" },
      { label: "Planos", to: "/vender" },
      { label: "Área do anunciante", to: "/login" },
    ],
  },
  {
    title: "Links úteis",
    links: [
      { label: "Tabela FIPE", to: "https://veiculos.fipe.org.br", ext: true },
      { label: "DETRAN", to: "https://www.gov.br/pt-br/servicos-estaduais", ext: true },
      { label: "CNH Digital", to: "https://www.gov.br/pt-br/temas/carteira-de-motorista", ext: true },
    ],
  },
];

const SOCIAL: { name: string; icon: string; href: string }[] = [
  { name: "Instagram", icon: "instagram", href: "https://www.instagram.com/revvio.oficial/" },
];

const LINK_CLASS =
  "inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-brand";

function LinkContent({ label }: { label: string }) {
  return (
    <>
      <Icon name="chevronRight" size={14} className="text-brand" />
      {label}
    </>
  );
}

export function PublicFooter() {
  const { user } = useAuth();
  const logClick = useLogClickEvent();
  const [pending, setPending] = useState<{ kind: ClickKind; url: string } | null>(null);

  function openSocial(kind: ClickKind, url: string) {
    // Canais do rodapé global pertencem ao dono da plataforma.
    logClick(kind, PLATFORM_OWNER_SELLER_ID);
    window.open(url, "_blank", "noopener");
  }
  function handleSocial(e: React.MouseEvent, kind: ClickKind, url: string) {
    e.preventDefault();
    if (!user) {
      setPending({ kind, url });
      return;
    }
    openSocial(kind, url);
  }

  return (
    <footer className="bg-cloud">
      {/* barra verde (identidade Revvio) */}
      <div className="h-[3px] w-full bg-brand" />

      {/* container 1 — 4 colunas (altura 420px) */}
      <div className="mx-auto grid min-h-[420px] max-w-[1280px] content-center gap-10 px-5 py-12 sm:px-7 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <BrandLogo height={26} theme="dark" />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-500">
            Portal de compra e venda de veículos com procedência e contato direto com a loja.
          </p>
          <a
            href="mailto:contato@revvio.com.br"
            className="mt-4 flex items-center gap-2 text-sm text-slate-500 hover:text-brand"
          >
            <Icon name="mail" size={15} className="text-brand" /> contato@revvio.com.br
          </a>
          <a
            href="https://wa.me/5514981800854"
            target="_blank"
            rel="noreferrer"
            className="mt-1.5 flex items-center gap-2 text-sm text-slate-500 hover:text-brand"
          >
            <Icon name="whatsapp" size={15} className="text-brand" /> (14) 98180-0854
          </a>
          <p className="mt-1.5 flex items-start gap-2 text-sm text-slate-500">
            <Icon name="mapPin" size={15} className="mt-0.5 shrink-0 text-brand" />
            Av. Ipiranga, 207 — Centro, Marília — SP, 17509-210
          </p>
          <p className="mt-1.5 flex items-center gap-2 text-sm text-slate-500">
            <Icon name="clock" size={15} className="text-brand" /> Seg. a sex., das 9h às 18h
          </p>
          <div className="mt-5 flex gap-2.5">
            {SOCIAL.map((s) => {
              const kind: ClickKind =
                s.icon === "whatsapp" ? "store_whatsapp" : "store_instagram";
              const external = s.href.startsWith("http");
              return (
                <a
                  key={s.name}
                  href={s.href}
                  aria-label={s.name}
                  {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
                  onClick={external ? (e) => handleSocial(e, kind, s.href) : undefined}
                  className="grid h-9 w-9 place-items-center rounded-full bg-white text-slate-500 shadow-sm hover:text-brand"
                >
                  <Icon name={s.icon} size={17} />
                </a>
              );
            })}
          </div>
        </div>
        {COLS.map((col) => (
          <div key={col.title}>
            <h4 className="text-[11.5px] font-bold uppercase tracking-wider text-slate-900">
              {col.title}
            </h4>
            {/* linha na cor principal sob o título */}
            <span className="mt-2 block h-[3px] w-7 rounded-full bg-brand" />
            <ul className="mt-4 flex flex-col gap-2.5">
              {col.links.map((l) => (
                <li key={l.label}>
                  {l.ext ? (
                    <a href={l.to} target="_blank" rel="noreferrer" className={LINK_CLASS}>
                      <LinkContent label={l.label} />
                    </a>
                  ) : (
                    <Link to={l.to} className={LINK_CLASS}>
                      <LinkContent label={l.label} />
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* container 2 — barra inferior (cinza mais escuro) */}
      <div className="bg-slate-200">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-3 px-5 py-5 text-xs text-slate-500 sm:px-7">
          <div className="flex flex-wrap items-center gap-5">
            <Link to="/politica-de-privacidade" className="hover:text-brand">
              Política de Privacidade
            </Link>
            <Link to="/termos-e-condicoes" className="hover:text-brand">
              Termos e Condições
            </Link>
          </div>
          <span>© 2026 REVVIO — Todos os direitos reservados.</span>
          <span>
            Desenvolvido por{" "}
            <span className="font-bold text-slate-700">MindCorp</span>
          </span>
        </div>
      </div>

      <BuyerAuthModal
        open={!!pending}
        onClose={() => setPending(null)}
        defaultTab="criar"
        onAuthed={() => {
          const p = pending;
          setPending(null);
          if (p) openSocial(p.kind, p.url);
        }}
      />
    </footer>
  );
}
