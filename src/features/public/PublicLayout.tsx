import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthProvider";
import { Button } from "@/components/ui";

export function PublicLayout({ children }: { children: ReactNode }) {
  const { user, isAdmin, seller } = useAuth();

  const painelHref = isAdmin ? "/dashboard" : seller ? "/painel" : "/app";

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link to="/" className="text-xl font-black tracking-tight">
            REVV<span className="text-brand">IO</span>
          </Link>
          <div className="flex items-center gap-3">
            {user ? (
              <Link to={painelHref}>
                <Button variant="outline">Meu painel</Button>
              </Link>
            ) : (
              <>
                <Link
                  to="/cadastro-vendedor"
                  className="hidden text-sm font-medium text-slate-300 hover:text-white sm:block"
                >
                  Quero vender
                </Link>
                <Link to="/login">
                  <Button variant="outline">Entrar</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>

      <footer className="border-t border-slate-800 py-8 text-center text-xs text-slate-500">
        REVVIO · Marketplace Multi-Vendedores
      </footer>
    </div>
  );
}
