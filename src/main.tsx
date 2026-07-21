import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Voltar para a aba disparava um refetch de tudo a cada troca de janela.
      // 1 min de frescor cobre o vai-e-vem normal do usuário; as mutations já
      // invalidam as chaves afetadas, então os dados não ficam velhos.
      staleTime: 60_000,
      // Mantém o cache das telas visitadas por 10 min: voltar para a listagem
      // renderiza na hora (com revalidação em segundo plano) em vez de spinner.
      gcTime: 10 * 60_000,
      refetchOnReconnect: true,
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <AuthProvider>
              <App />
            </AuthProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </HelmetProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
