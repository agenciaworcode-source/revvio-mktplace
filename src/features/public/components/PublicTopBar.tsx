import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthProvider";
import { BrandLogo } from "./BrandLogo";
import { Icon } from "./icons";

const navItems = [
  { to: "/", label: "Comprar" },
  { to: "/vender", label: "Vender" },
];

/** Barra preta superior das telas públicas (padrão do protótipo). */
export function PublicTopBar({ current = "comprar" }: { current?: "comprar" | "vender" }) {
  const { user, isAdmin, seller, signOut } = useAuth();
  const navigate = useNavigate();
  const painelHref = isAdmin ? "/dashboard" : seller ? "/painel" : "/app";

  async function handleSignOut() {
    await signOut();
    navigate("/login", { replace: true });
  }

  return (
    <header className="sticky top-0 z-40 bg-ink">
      <div className="mx-auto flex h-[66px] max-w-[1280px] items-center justify-between px-5 sm:px-7">
        <div className="flex items-center gap-9">
          <Link to="/">
            <BrandLogo height={26} theme="light" />
          </Link>
          <nav className="hidden gap-6 sm:flex">
            {navItems.map((item) => {
              const active =
                (item.label === "Comprar" && current === "comprar") ||
                (item.label === "Vender" && current === "vender");
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  className={
                    active
                      ? "text-sm font-bold text-white"
                      : "text-sm font-medium text-slate-400 hover:text-white"
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Link
                to={painelHref}
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3.5 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10"
              >
                <Icon name="grid" size={15} /> Painel
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
                className="hidden text-sm font-medium text-slate-300 hover:text-white sm:block"
              >
                Quero vender
              </Link>
              <Link
                to="/login"
                className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10"
              >
                Entrar
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
