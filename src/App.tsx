import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthProvider";
import { ProtectedRoute, RoleRoute } from "@/features/auth/routeGuards";
import { Placeholder } from "@/components/Placeholder";
import { AFFILIATES_ENABLED } from "@/config/features";

/* Páginas carregadas sob demanda (code-splitting por rota). */
const Login = lazy(() =>
  import("@/features/auth/pages/Login").then((m) => ({ default: m.Login }))
);
const CadastroVendedor = lazy(() =>
  import("@/features/auth/pages/CadastroVendedor").then((m) => ({
    default: m.CadastroVendedor,
  }))
);
const CadastroComprador = lazy(() =>
  import("@/features/auth/pages/CadastroComprador").then((m) => ({
    default: m.CadastroComprador,
  }))
);
const MinhaConta = lazy(() =>
  import("@/features/auth/pages/MinhaConta").then((m) => ({ default: m.MinhaConta }))
);
const DefinirSenha = lazy(() =>
  import("@/features/auth/pages/DefinirSenha").then((m) => ({
    default: m.DefinirSenha,
  }))
);
const PagamentoConfirmado = lazy(() =>
  import("@/features/auth/pages/PagamentoConfirmado").then((m) => ({
    default: m.PagamentoConfirmado,
  }))
);
const AguardandoAprovacao = lazy(() =>
  import("@/features/auth/pages/StatusPages").then((m) => ({
    default: m.AguardandoAprovacao,
  }))
);
const ContaSuspensa = lazy(() =>
  import("@/features/auth/pages/StatusPages").then((m) => ({
    default: m.ContaSuspensa,
  }))
);
const Marketplace = lazy(() =>
  import("@/features/public/pages/Marketplace").then((m) => ({ default: m.Marketplace }))
);
const Home = lazy(() =>
  import("@/features/public/pages/Home").then((m) => ({ default: m.Home }))
);
const Vender = lazy(() =>
  import("@/features/public/pages/Vender").then((m) => ({ default: m.Vender }))
);
const PoliticaPrivacidade = lazy(() =>
  import("@/features/public/pages/PoliticaPrivacidade").then((m) => ({
    default: m.PoliticaPrivacidade,
  }))
);
const TermosCondicoes = lazy(() =>
  import("@/features/public/pages/TermosCondicoes").then((m) => ({
    default: m.TermosCondicoes,
  }))
);
const VehicleDetails = lazy(() =>
  import("@/features/public/pages/VehicleDetails").then((m) => ({
    default: m.VehicleDetails,
  }))
);
const Storefront = lazy(() =>
  import("@/features/public/pages/Storefront").then((m) => ({ default: m.Storefront }))
);
const PainelLayout = lazy(() =>
  import("@/features/seller/PainelLayout").then((m) => ({ default: m.PainelLayout }))
);
const SellerDashboard = lazy(() =>
  import("@/features/seller/pages/Dashboard").then((m) => ({ default: m.Dashboard }))
);
const SellerVehicles = lazy(() =>
  import("@/features/seller/pages/Vehicles").then((m) => ({ default: m.Vehicles }))
);
const SellerEquipe = lazy(() =>
  import("@/features/seller/pages/Equipe").then((m) => ({ default: m.Equipe }))
);
const SellerAfiliados = lazy(() =>
  import("@/features/seller/pages/Afiliados").then((m) => ({ default: m.Afiliados }))
);
const SellerSales = lazy(() =>
  import("@/features/seller/pages/Sales").then((m) => ({ default: m.Sales }))
);
const SellerFinancial = lazy(() =>
  import("@/features/seller/pages/Financial").then((m) => ({ default: m.Financial }))
);
const SellerProfile = lazy(() =>
  import("@/features/seller/pages/Profile").then((m) => ({ default: m.Profile }))
);
const SellerWhatsappGenerator = lazy(() =>
  import("@/features/seller/pages/WhatsappGenerator").then((m) => ({
    default: m.WhatsappGenerator,
  }))
);
const SellerLeads = lazy(() =>
  import("@/features/seller/pages/Leads").then((m) => ({ default: m.Leads }))
);
const AdminLayout = lazy(() =>
  import("@/features/admin/AdminLayout").then((m) => ({ default: m.AdminLayout }))
);
const AdminDashboard = lazy(() =>
  import("@/features/admin/pages/Dashboard").then((m) => ({ default: m.Dashboard }))
);
const Sellers = lazy(() =>
  import("@/features/admin/pages/Sellers").then((m) => ({ default: m.Sellers }))
);
const AdminLeads = lazy(() =>
  import("@/features/admin/pages/Leads").then((m) => ({ default: m.Leads }))
);
const SellerDetail = lazy(() =>
  import("@/features/admin/pages/SellerDetail").then((m) => ({ default: m.SellerDetail }))
);
const AdminFinancial = lazy(() =>
  import("@/features/admin/pages/Financial").then((m) => ({ default: m.Financial }))
);
const AdminPlans = lazy(() =>
  import("@/features/admin/pages/Plans").then((m) => ({ default: m.Plans }))
);
const AdminVehicles = lazy(() =>
  import("@/features/admin/pages/Vehicles").then((m) => ({ default: m.Vehicles }))
);
const AdminMovimentacoes = lazy(() =>
  import("@/features/admin/pages/Movimentacoes").then((m) => ({ default: m.Movimentacoes }))
);
const AdminAfiliados = lazy(() =>
  import("@/features/admin/pages/Afiliados").then((m) => ({ default: m.Afiliados }))
);
const AdminStores = lazy(() =>
  import("@/features/admin/pages/Stores").then((m) => ({ default: m.Stores }))
);
const AdminAparencia = lazy(() =>
  import("@/features/admin/pages/Aparencia").then((m) => ({ default: m.Aparencia }))
);
const AffiliateLayout = lazy(() =>
  import("@/features/affiliate/AffiliateLayout").then((m) => ({ default: m.AffiliateLayout }))
);
const AfiliadoCarros = lazy(() =>
  import("@/features/affiliate/pages/Carros").then((m) => ({ default: m.Carros }))
);
const AfiliadoDesempenho = lazy(() =>
  import("@/features/affiliate/pages/Desempenho").then((m) => ({ default: m.Desempenho }))
);
const AfiliadoPerfil = lazy(() =>
  import("@/features/affiliate/pages/Perfil").then((m) => ({ default: m.Perfil }))
);

/** Restringe rotas do painel ao gestor da loja (garagista/admin). */
function ManagerOnly({ children }: { children: ReactNode }) {
  const { loading, isGaragista, isAdmin } = useAuth();
  if (loading) return <div className="p-8 text-slate-400">Carregando…</div>;
  if (!isGaragista && !isAdmin) return <Navigate to="/painel" replace />;
  return <>{children}</>;
}

/** Após login, manda cada papel para o lugar certo. */
function RoleRedirect() {
  const { loading, user, seller, isAdmin, isBuyer } = useAuth();
  if (loading) return <div className="p-8 text-slate-400">Carregando…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (isAdmin) return <Navigate to="/dashboard" replace />;
  if (!seller) return <Navigate to={isBuyer ? "/" : "/cadastro-vendedor"} replace />;
  if (seller.status === "pending")
    return <Navigate to="/aguardando-aprovacao" replace />;
  if (seller.status === "suspended")
    return <Navigate to="/conta-suspensa" replace />;
  if (AFFILIATES_ENABLED && seller.role === "afiliado")
    return <Navigate to="/afiliado" replace />;
  return <Navigate to="/painel" replace />; // garagista ou vendedor
}

export default function App() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-400">Carregando…</div>}>
      <Routes>
        {/* ── Público ───────────────────────────── */}
        <Route path="/" element={<Home />} />
        <Route path="/comprar" element={<Marketplace />} />
        <Route path="/vender" element={<Vender />} />
        <Route path="/politica-de-privacidade" element={<PoliticaPrivacidade />} />
        <Route path="/termos-e-condicoes" element={<TermosCondicoes />} />
        <Route path="/veiculo/:id" element={<VehicleDetails />} />
        <Route path="/loja/:slug" element={<Storefront />} />
        <Route path="/login" element={<Login />} />
        <Route path="/cadastro" element={<CadastroComprador />} />
        <Route path="/minha-conta" element={<MinhaConta />} />
        <Route path="/cadastro-vendedor" element={<CadastroVendedor />} />
        <Route path="/definir-senha" element={<DefinirSenha />} />
        <Route path="/pagamento-confirmado" element={<PagamentoConfirmado />} />
        <Route path="/aguardando-aprovacao" element={<AguardandoAprovacao />} />
        <Route path="/conta-suspensa" element={<ContaSuspensa />} />

        {/* Redireciona por papel após login */}
        <Route path="/app" element={<RoleRedirect />} />

        {/* ── Painel do Vendedor ────────────────── */}
        <Route
          path="/painel"
          element={
            <RoleRoute roles={["garagista", "vendedor"]}>
              <PainelLayout />
            </RoleRoute>
          }
        >
          <Route index element={<SellerDashboard />} />
          <Route path="leads" element={<SellerLeads />} />
          <Route path="veiculos" element={<SellerVehicles />} />
          <Route path="vendedores" element={<SellerEquipe />} />
          {AFFILIATES_ENABLED && (
            <Route path="afiliados" element={<SellerAfiliados />} />
          )}
          <Route path="vendas" element={<SellerSales />} />
          <Route
            path="financeiro"
            element={
              <ManagerOnly>
                <SellerFinancial />
              </ManagerOnly>
            }
          />
          <Route path="gerador-whatsapp" element={<SellerWhatsappGenerator />} />
          <Route path="perfil" element={<SellerProfile />} />
        </Route>

        {/* ── Afiliado ──────────────────────────── */}
        {AFFILIATES_ENABLED && (
          <Route
            path="/afiliado"
            element={
              <RoleRoute roles={["afiliado"]}>
                <AffiliateLayout />
              </RoleRoute>
            }
          >
            <Route index element={<AfiliadoCarros />} />
            <Route path="desempenho" element={<AfiliadoDesempenho />} />
            <Route path="perfil" element={<AfiliadoPerfil />} />
          </Route>
        )}

        {/* ── Admin ─────────────────────────────── */}
        <Route
          path="/dashboard"
          element={
            <RoleRoute roles={["admin"]}>
              <AdminLayout />
            </RoleRoute>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="sellers" element={<Sellers />} />
          <Route path="sellers/:id" element={<SellerDetail />} />
          <Route path="leads" element={<AdminLeads />} />
          <Route path="financial" element={<AdminFinancial />} />
          <Route path="planos" element={<AdminPlans />} />
          <Route path="veiculos" element={<AdminVehicles />} />
          <Route path="movimentacoes" element={<AdminMovimentacoes />} />
          {AFFILIATES_ENABLED && (
            <Route path="afiliados" element={<AdminAfiliados />} />
          )}
          <Route path="mini-lojas" element={<AdminStores />} />
          <Route path="aparencia" element={<AdminAparencia />} />
        </Route>

        {/* Exemplo de rota só-autenticado genérica */}
        <Route
          path="/conta"
          element={
            <ProtectedRoute>
              <Placeholder title="Minha Conta" />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Placeholder title="404 — Página não encontrada" />} />
      </Routes>
    </Suspense>
  );
}
