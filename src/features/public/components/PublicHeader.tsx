import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthProvider";
import { BrandLogo } from "./BrandLogo";
import { Icon } from "./icons";

const NAV = [
  { to: "/comprar", label: "Comprar", key: "comprar" as const },
  { to: "/vender", label: "Vender", key: "vender" as const },
];

export function PublicHeader({
  current = "home",
}: {
  current?: "home" | "comprar" | "vender";
}) {
  const { user, isAdmin, seller, isBuyer, signOut } = useAuth();
  const navigate = useNavigate();
  const painelHref = isAdmin ? "/dashboard" : seller ? "/painel" : "/minha-conta";
  const painelLabel = isBuyer ? "Minha conta" : "Painel";

  async function handleSignOut() {
    await signOut();
    navigate("/login", { replace: true });
  }

  return (
    <header className="sticky top-0 z-40">
      {/* faixa de contato */}
      <div className="bg-ink text-slate-300">
        <div className="mx-auto flex h-9 max-w-[1280px] items-center gap-6 px-5 text-[12.5px] sm:px-7">
          <a href="mailto:contato@revvio.com.br" className="inline-flex items-center gap-1.5 hover:text-white">
            <Icon name="mail" size={14} /> contato@revvio.com.br
          </a>
          <a
            href="https://wa.me/5514981800854"
            target="_blank"
            rel="noreferrer"
            className="hidden items-center gap-1.5 hover:text-white sm:inline-flex"
          >
            <Icon name="whatsapp" size={14} /> (14) 98180-0854
          </a>
          <span className="ml-auto hidden items-center gap-1.5 md:inline-flex">
            <Icon name="mapPin" size={14} /> Av. Ipiranga, 207 · Centro, Marília — SP
          </span>
        </div>
        <div className="h-[2px] w-full bg-brand" />
      </div>

      {/* header branco */}
      <div className="border-b border-hair bg-white">
        <div className="mx-auto flex h-[68px] max-w-[1280px] items-center justify-between px-5 sm:px-7">
          <Link to="/" className="flex items-center">
            <BrandLogo height={26} theme="dark" />
          </Link>
          <nav className="hidden items-center gap-7 sm:flex">
            {NAV.map((n) => (
              <Link
                key={n.key}
                to={n.to}
                className={
                  current === n.key
                    ? "text-sm font-bold text-slate-900"
                    : "text-sm font-semibold text-slate-500 hover:text-slate-900"
                }
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <Link
                  to={painelHref}
                  className="inline-flex items-center gap-2 rounded-lg border border-hair px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Icon name="grid" size={15} /> {painelLabel}
                </Link>
                <button
                  onClick={handleSignOut}
                  className="rounded-lg bg-red-500 px-4 py-2 text-sm font-bold text-white hover:bg-red-600"
                >
                  Sair
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/cadastro-vendedor"
                  className="hidden rounded-lg border border-brand px-4 py-2 text-sm font-bold text-brand hover:bg-brand/5 sm:block"
                >
                  Área do anunciante
                </Link>
                <Link
                  to="/login"
                  className="rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white hover:bg-brand-dark"
                >
                  Entrar
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
