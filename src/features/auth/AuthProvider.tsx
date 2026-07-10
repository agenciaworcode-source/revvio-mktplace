import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { createSellerProfile } from "./createSellerProfile";
import { fetchBuyer } from "./buyer";
import type { AppRole, Buyer, Seller } from "@/lib/database.types";

interface AuthState {
  user: User | null;
  session: Session | null;
  seller: Seller | null;
  buyer: Buyer | null;
  isBuyer: boolean;
  loading: boolean;
  isAdmin: boolean;
  isActiveSeller: boolean;
  role: AppRole | null;
  lojaId: string | null;
  personId: string | null;
  isGaragista: boolean;
  isVendedor: boolean;
  isAfiliado: boolean;
  signOut: () => Promise<void>;
  refreshSeller: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

async function fetchSeller(userId: string): Promise<Seller | null> {
  const { data, error } = await supabase
    .from("rv_sellers")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("Erro ao carregar seller:", error.message);
    return null;
  }
  return (data as Seller) ?? null;
}

/**
 * Garante o perfil do vendedor. Quando a confirmação de e-mail está LIGADA,
 * o `signUp` não cria a linha em rv_sellers (não há sessão). No primeiro login
 * após confirmar, recriamos o perfil a partir dos metadados salvos no cadastro.
 */
async function ensureSeller(user: User): Promise<Seller | null> {
  const existing = await fetchSeller(user.id);
  if (existing) return existing;

  const meta = user.user_metadata ?? {};
  if (!meta.name) return null; // não veio do fluxo de cadastro de vendedor

  try {
    await createSellerProfile({
      userId: user.id,
      name: meta.name,
      email: user.email ?? meta.email ?? "",
      phone: meta.phone ?? null,
      cpf_cnpj: meta.cpf_cnpj ?? null,
      city: meta.city ?? null,
    });
  } catch (e) {
    console.error("Erro ao garantir perfil do vendedor:", e);
    return null;
  }
  return fetchSeller(user.id);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [seller, setSeller] = useState<Seller | null>(null);
  const [buyer, setBuyer] = useState<Buyer | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadSeller(user: User | undefined | null) {
    if (!user) {
      setSeller(null);
      setBuyer(null);
      return;
    }
    const s = await ensureSeller(user);
    setSeller(s);
    setBuyer(s ? null : await fetchBuyer(user.id));
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadSeller(data.session?.user);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, s) => {
      setSession(s);
      // No sign-in/sign-out o seller carrega de forma assíncrona; mantemos
      // 'loading' ligado durante o fetch para os guards não redirecionarem
      // antes do perfil resolver (senão o garagista cai em /cadastro → /vender).
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "INITIAL_SESSION") {
        setLoading(true);
        await loadSeller(s?.user);
        setLoading(false);
      } else {
        // TOKEN_REFRESHED / USER_UPDATED: atualiza sem piscar 'loading'.
        await loadSeller(s?.user);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user: session?.user ?? null,
      session,
      seller,
      buyer,
      isBuyer: !!buyer,
      loading,
      isAdmin: seller?.role === "admin",
      isActiveSeller: seller?.role === "garagista" && seller?.status === "active",
      isGaragista: seller?.role === "garagista",
      isVendedor: seller?.role === "vendedor",
      isAfiliado: seller?.role === "afiliado",
      role: seller?.role ?? null,
      personId: seller?.id ?? null,
      lojaId: seller ? seller.parent_id ?? seller.id : null,
      signOut: async () => {
        // scope 'local' não depende do endpoint remoto de revogação, que
        // falhava de forma intermitente (timeout/5xx) e lançava exceção antes
        // de limpar a sessão — deixando o usuário logado ("hora sai, hora não").
        try {
          const { error } = await supabase.auth.signOut({ scope: "local" });
          if (error) throw error;
        } catch (e) {
          console.error("Erro ao sair; limpando sessão local mesmo assim:", e);
          // Garante o logout local mesmo se a chamada de rede falhar.
          try {
            for (const k of Object.keys(window.localStorage)) {
              if (k.startsWith("sb-") && k.endsWith("-auth-token")) {
                window.localStorage.removeItem(k);
              }
            }
          } catch {
            /* ignore */
          }
        } finally {
          setSession(null);
          setSeller(null);
          setBuyer(null);
        }
      },
      refreshSeller: () => loadSeller(session?.user),
    }),
    [session, seller, buyer, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  return ctx;
}
