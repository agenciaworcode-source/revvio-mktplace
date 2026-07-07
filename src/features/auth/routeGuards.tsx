import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "./AuthProvider";
import type { AppRole } from "@/lib/database.types";

function Loading() {
  return <div className="p-8 text-slate-400">Carregando…</div>;
}

/** Exige sessão autenticada. */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

/** Exige um dos papéis. A segurança real é o RLS; isto é só UX/navegação. */
export function RoleRoute({
  roles,
  children,
}: {
  roles: AppRole[];
  children: ReactNode;
}) {
  const { user, seller, loading, role, isAdmin } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;

  // admin acessa qualquer área autorizada
  if (isAdmin) return <>{children}</>;

  if (!seller) return <Navigate to="/cadastro-vendedor" replace />;
  if (seller.status === "pending")
    return <Navigate to="/aguardando-aprovacao" replace />;
  if (seller.status === "suspended")
    return <Navigate to="/conta-suspensa" replace />;

  if (!role || !roles.includes(role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
