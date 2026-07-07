import { Component, type ReactNode } from "react";

interface State {
  error: Error | null;
}

/** Captura erros de render para evitar tela branca; mostra um fallback amigável. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("Erro não tratado na UI:", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
          <span className="text-xs font-bold uppercase tracking-[2px] text-brand">
            REVVIO
          </span>
          <h1 className="text-2xl font-black">Algo deu errado</h1>
          <p className="max-w-md text-sm text-slate-400">
            Ocorreu um erro inesperado. Recarregue a página; se persistir, contate o
            suporte.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-brand-dark"
          >
            Recarregar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
