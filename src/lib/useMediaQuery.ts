import { useEffect, useState } from "react";

/**
 * Estado reativo de uma media query. Útil quando esconder por CSS não basta —
 * ex.: montar um componente com efeitos colaterais (assinatura realtime) só de
 * um lado do breakpoint, em vez de duplicá-lo e escondê-lo com `hidden`.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/** Breakpoint `lg` do Tailwind — divisor entre painel com sidebar e drawer. */
export const LG_QUERY = "(min-width: 1024px)";
