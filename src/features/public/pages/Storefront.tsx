import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PublicTopBar } from "../components/PublicTopBar";
import { MarketplaceCard } from "../components/MarketplaceCard";
import { Icon } from "../components/icons";
import { useStorefront } from "../queries";
import { whatsappLink } from "@/lib/whatsapp";
import { Spinner } from "@/components/ui";
import { useAuth } from "@/features/auth/AuthProvider";
import { BuyerAuthModal } from "@/features/auth/components/BuyerAuthModal";
import { useLogClickEvent, type ClickKind } from "@/features/tracking/queries";

function StoreStat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="text-center">
      <div className="text-[19px] font-extrabold tracking-[-.5px] text-slate-950">{value}</div>
      <div className="mt-0.5 text-xs text-slate-400">{label}</div>
    </div>
  );
}

export function Storefront() {
  const { slug } = useParams();
  const { data, isLoading } = useStorefront(slug);
  const { user } = useAuth();
  const logClick = useLogClickEvent();
  const [pending, setPending] = useState<{ kind: ClickKind; url: string } | null>(null);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white font-sans">
        <PublicTopBar />
        <div className="flex justify-center py-24 text-slate-400">
          <Spinner />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-white font-sans">
        <PublicTopBar />
        <div className="mx-auto max-w-[1180px] px-7 py-24 text-center">
          <p className="text-lg font-bold text-slate-800">Loja não encontrada</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-400">
            Esta mini-loja não existe ou o vendedor não está ativo.
          </p>
          <Link
            to="/comprar"
            className="mt-5 inline-block rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white hover:bg-brand-dark"
          >
            Ir ao marketplace
          </Link>
        </div>
      </div>
    );
  }

  const { seller, vehicles, soldCount } = data;
  const wa = whatsappLink(seller.whatsapp, `Olá ${seller.name}! Vi sua loja na REVVIO.`);
  const instaUrl = seller.instagram
    ? `https://instagram.com/${seller.instagram.replace(/^@/, "")}`
    : null;
  const since = seller.created_at ? new Date(seller.created_at).getFullYear() : null;
  const location = [seller.city, seller.state].filter(Boolean).join(", ");
  const featured = vehicles.slice(0, 3);

  function openChannel(kind: ClickKind, url: string) {
    logClick(kind, seller.id);
    window.open(url, "_blank", "noopener");
  }
  function handleChannel(e: React.MouseEvent, kind: ClickKind, url: string) {
    e.preventDefault();
    if (!user) {
      setPending({ kind, url });
      return;
    }
    openChannel(kind, url);
  }

  return (
    <div className="min-h-screen bg-white font-sans">
      <PublicTopBar />

      {/* Breadcrumb */}
      <div className="mx-auto max-w-[1180px] px-7 pt-[18px] text-[13.5px] text-slate-400">
        <Link to="/" className="hover:text-slate-600">
          Home
        </Link>
        <span className="mx-2">›</span>
        <Link to="/" className="hover:text-slate-600">
          Lojas
        </Link>
        <span className="mx-2">›</span>
        <span className="font-semibold text-slate-700">{seller.name}</span>
      </div>

      {/* Banner + perfil */}
      <div className="mx-auto mt-3.5 max-w-[1180px] px-7">
        <div className="relative h-[230px] overflow-hidden rounded-[18px] bg-[#0c1322]">
          {seller.banner_url && (
            <img
              src={seller.banner_url}
              alt=""
              className="h-full w-full object-cover opacity-65"
            />
          )}
          <div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(180deg, rgba(8,9,12,.1), rgba(8,9,12,.82))",
            }}
          />
          {/* Nome da loja sobre o banner — fundo translúcido p/ destacar em
              qualquer imagem de fundo. */}
          <span className="absolute left-4 top-4 inline-flex max-w-[70%] items-center gap-2 rounded-xl border border-white/15 bg-black/45 px-3.5 py-2 backdrop-blur-md">
            <span className="truncate text-[15px] font-extrabold tracking-[-.3px] text-white">
              {seller.name}
            </span>
            <Icon name="badge" size={16} className="shrink-0 text-emerald-400" />
          </span>
          <span className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/[0.14] px-3 py-1.5 text-[12.5px] font-bold text-white backdrop-blur">
            <Icon name="badge" size={15} className="text-emerald-400" /> Loja parceira
          </span>
        </div>

        <div className="relative mx-6 -mt-[36px] flex flex-wrap items-end gap-[22px]">
          {seller.avatar_url ? (
            <img
              src={seller.avatar_url}
              alt=""
              className="h-[108px] w-[108px] rounded-[22px] border-4 border-white object-cover shadow-[0_8px_24px_rgba(16,24,40,.18)]"
            />
          ) : (
            <span className="grid h-[108px] w-[108px] place-items-center rounded-[22px] border-4 border-white bg-slate-100 text-4xl font-bold text-slate-400 shadow-[0_8px_24px_rgba(16,24,40,.18)]">
              {seller.name.charAt(0).toUpperCase()}
            </span>
          )}
          <div className="min-w-[280px] flex-1 pb-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="m-0 text-[26px] font-extrabold tracking-[-.8px] text-slate-950">
                {seller.name}
              </h1>
              <Icon name="badge" size={22} className="text-brand" />
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-4 text-[13.5px] text-slate-500">
              {location && (
                <span className="inline-flex items-center gap-1.5">
                  <Icon name="mapPin" size={15} /> {location}
                </span>
              )}
              {since && (
                <span className="inline-flex items-center gap-1.5">Desde {since}</span>
              )}
            </div>
          </div>
          <div className="flex gap-2.5 pb-1.5">
            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => handleChannel(e, "store_whatsapp", wa)}
                className="inline-flex items-center gap-2 rounded-[11px] bg-[#25D366] px-5 py-3 text-[14.5px] font-bold text-white shadow-[0_6px_16px_rgba(37,211,102,.32)]"
              >
                <Icon name="whatsapp" size={18} /> WhatsApp
              </a>
            )}
            {instaUrl && (
              <a
                href={instaUrl}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => handleChannel(e, "store_instagram", instaUrl)}
                className="grid w-[46px] place-items-center rounded-[11px] border border-[#e3e5e9] bg-white text-slate-600 hover:bg-slate-50"
              >
                <Icon name="instagram" size={19} />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Sobre + stats */}
      <div className="mx-auto mt-6 grid max-w-[1180px] grid-cols-1 items-start gap-6 px-7 lg:grid-cols-[1fr_340px]">
        <div className="rounded-2xl border border-hair bg-white px-6 py-[22px] shadow-[0_1px_2px_rgba(16,24,40,.04)]">
          <div className="mb-2.5 text-[13px] font-extrabold uppercase tracking-wide text-slate-400">
            Sobre a loja
          </div>
          <p className="m-0 text-[15px] leading-[1.7] text-slate-600">
            {seller.bio || "Esta loja ainda não adicionou uma descrição."}
          </p>
        </div>
        <div className="rounded-2xl border border-hair bg-white px-6 py-[22px] shadow-[0_1px_2px_rgba(16,24,40,.04)]">
          <div className="flex justify-around">
            <StoreStat value={vehicles.length} label="No estoque" />
            <div className="w-px bg-[#f1f3f5]" />
            <StoreStat value={soldCount} label="Vendidos" />
            <div className="w-px bg-[#f1f3f5]" />
            <StoreStat value="—" label="Nota" />
          </div>
          <div className="mt-[18px] flex flex-col gap-2.5 border-t border-[#f1f3f5] pt-4 text-sm text-slate-600">
            {seller.whatsapp && (
              <div className="flex items-center gap-2.5">
                <Icon name="phone" size={16} className="text-brand" /> {seller.whatsapp}
              </div>
            )}
            {seller.instagram && (
              <div className="flex items-center gap-2.5">
                <Icon name="instagram" size={16} className="text-brand" /> {seller.instagram}
              </div>
            )}
            {location && (
              <div className="flex items-center gap-2.5">
                <Icon name="mapPin" size={16} className="text-brand" /> {location}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Veículos em destaque */}
      {featured.length > 0 && (
        <div className="mx-auto mt-10 max-w-[1180px] px-7">
          <div className="mb-[18px] flex items-center gap-2.5">
            <Icon name="star" size={20} style={{ color: "#f59e0b" }} />
            <h2 className="m-0 text-[21px] font-extrabold tracking-[-.6px] text-slate-950">
              Veículos em destaque
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((v) => (
              <MarketplaceCard key={v.id} vehicle={v} />
            ))}
          </div>
        </div>
      )}

      {/* Todo o estoque */}
      <div className="mx-auto mt-11 max-w-[1180px] px-7 pb-[70px]">
        <div className="mb-[18px] flex items-center justify-between">
          <h2 className="m-0 text-[21px] font-extrabold tracking-[-.6px] text-slate-950">
            Todo o estoque{" "}
            <span className="text-base font-semibold text-slate-400">· {vehicles.length}</span>
          </h2>
          <Link
            to="/comprar"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-brand hover:opacity-75"
          >
            Ver no marketplace <Icon name="arrowRight" size={15} />
          </Link>
        </div>
        {vehicles.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-hair py-16 text-center text-slate-400">
            Este vendedor ainda não tem veículos disponíveis.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {vehicles.map((v) => (
              <MarketplaceCard key={v.id} vehicle={v} />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-ink py-7 text-center text-[13px] text-slate-500">
        <div className="mb-2.5 font-display text-lg font-extrabold tracking-tight text-white">
          REVV<span className="text-brand">IO</span>
        </div>
        Mini-loja oficial · powered by REVVIO Marketplace
      </footer>

      <BuyerAuthModal
        open={!!pending}
        onClose={() => setPending(null)}
        defaultTab="criar"
        onAuthed={() => {
          const p = pending;
          setPending(null);
          if (p) openChannel(p.kind, p.url);
        }}
      />
    </div>
  );
}
