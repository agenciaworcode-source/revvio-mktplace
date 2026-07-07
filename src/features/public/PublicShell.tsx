import type { ReactNode } from "react";
import { PublicHeader } from "./components/PublicHeader";
import { PublicFooter } from "./components/PublicFooter";

export function PublicShell({
  current = "home",
  children,
}: {
  current?: "home" | "comprar" | "vender";
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-white font-sans">
      <PublicHeader current={current} />
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  );
}
