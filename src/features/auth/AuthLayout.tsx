import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui";

/** Moldura centralizada das telas de auth/status (login, cadastro, etc.). */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4 py-10">
      <Link to="/" className="flex flex-col items-center gap-1">
        <span className="text-2xl font-black tracking-tight">
          REVV<span className="text-brand">IO</span>
        </span>
        <span className="text-[10px] font-bold uppercase tracking-[3px] text-slate-500">
          Marketplace
        </span>
      </Link>

      <Card className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold text-white">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
        </div>
        {children}
      </Card>

      {footer && <div className="text-sm text-slate-400">{footer}</div>}
    </div>
  );
}
