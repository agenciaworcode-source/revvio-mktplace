import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { Spinner } from "./ui";

export { Spinner };

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/* O Tailwind emite `.p-6` depois de `.p-0`/`.p-4`, então um `className="p-0"`
   passado por quem chama perdia para o padrão do componente. Só aplicamos o
   padding padrão quando o chamador não definiu o seu. */
const PADDING_RE = /(?:^|\s)(?:[a-z0-9-]+:)*-?p[trblxyse]?-/;
function hasPadding(className?: string): boolean {
  return !!className && PADDING_RE.test(className);
}

/* ── Button ─────────────────────────────────────────────── */
type ButtonVariant = "primary" | "ghost" | "danger" | "outline";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  fullWidth?: boolean;
}

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "bg-brand text-white hover:bg-brand-dark disabled:opacity-50 font-bold shadow-[0_6px_16px_rgba(16,185,129,.24)]",
  outline:
    "border border-[#e3e5e9] bg-white text-slate-700 hover:bg-slate-50 font-bold",
  ghost: "text-slate-600 hover:bg-slate-100 font-semibold",
  danger: "bg-red-500 text-white hover:bg-red-600 font-bold",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = "primary", loading, fullWidth, className, children, disabled, ...rest },
    ref
  ) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-[10px] px-4 py-2.5 text-sm",
        "transition-colors disabled:cursor-not-allowed",
        buttonVariants[variant],
        fullWidth && "w-full",
        className
      )}
      {...rest}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  )
);
Button.displayName = "Button";

/* ── Input / Textarea / Select ──────────────────────────── */
const fieldBase =
  "w-full rounded-lg border border-[#e3e5e9] bg-[#fbfbfc] px-3 py-2.5 text-sm " +
  "text-slate-900 placeholder:text-[#b0b7c0] outline-none transition-colors " +
  "focus:border-brand focus:ring-1 focus:ring-brand disabled:opacity-50";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...rest }, ref) => (
    <input ref={ref} className={cx(fieldBase, className)} {...rest} />
  )
);
Input.displayName = "Input";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...rest }, ref) => (
  <textarea ref={ref} className={cx(fieldBase, "resize-y", className)} {...rest} />
));
Textarea.displayName = "Textarea";

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...rest }, ref) => (
  <select ref={ref} className={cx(fieldBase, "cursor-pointer", className)} {...rest}>
    {children}
  </select>
));
Select.displayName = "Select";

/* ── Field (label + erro) ───────────────────────────────── */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-semibold text-slate-700">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-slate-400">{hint}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

/* ── Card ───────────────────────────────────────────────── */
export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cx(
        "rounded-2xl border border-hair bg-white shadow-[0_1px_2px_rgba(16,24,40,.04)]",
        !hasPadding(className) && "p-4 sm:p-6",
        className
      )}
    >
      {children}
    </div>
  );
}

/* ── Alert ──────────────────────────────────────────────── */
type AlertVariant = "info" | "error" | "success" | "warning";

const alertVariants: Record<AlertVariant, string> = {
  info: "border-sky-200 bg-sky-50 text-sky-700",
  error: "border-red-200 bg-red-50 text-red-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
};

export function Alert({
  variant = "info",
  children,
}: {
  variant?: AlertVariant;
  children: ReactNode;
}) {
  return (
    <div className={cx("rounded-lg border px-4 py-3 text-sm", alertVariants[variant])}>
      {children}
    </div>
  );
}

/* ── Badge ──────────────────────────────────────────────── */
type BadgeTone = "neutral" | "green" | "amber" | "red" | "sky";

const badgeTones: Record<BadgeTone, string> = {
  neutral: "bg-slate-100 text-slate-600",
  green: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  amber: "bg-amber-50 text-amber-700 border border-amber-200",
  red: "bg-red-50 text-red-700 border border-red-200",
  sky: "bg-sky-50 text-sky-700 border border-sky-200",
};

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: BadgeTone;
  children: ReactNode;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        badgeTones[tone]
      )}
    >
      {children}
    </span>
  );
}

/* ── StatCard ───────────────────────────────────────────── */
export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-hair bg-white px-4 py-4 shadow-[0_1px_2px_rgba(16,24,40,.04)] sm:px-[22px] sm:py-5">
      <p className="text-[12px] font-semibold text-slate-500 sm:text-[13px]">{label}</p>
      <p className="mt-2 break-words text-[21px] font-extrabold tracking-[-.5px] text-slate-950 sm:text-[26px]">
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

/* ── PageHeader ─────────────────────────────────────────── */
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3 sm:mb-7 sm:gap-4">
      <div className="min-w-0">
        <h1 className="text-[22px] font-extrabold tracking-[-.6px] text-slate-950 sm:text-[28px] sm:tracking-[-1px]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1.5 text-[13.5px] text-slate-400 sm:text-[14.5px]">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}

/* ── EmptyState ─────────────────────────────────────────── */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-hair bg-white px-6 py-16 text-center">
      <p className="text-base font-bold text-slate-800">{title}</p>
      {description && (
        <p className="mx-auto mt-1 max-w-sm text-sm text-slate-400">{description}</p>
      )}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

/* ── Modal ──────────────────────────────────────────────── */
export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
  closeOnBackdrop = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
  /** Fecha ao clicar fora. Desligue em formulários p/ não perder o preenchimento. */
  closeOnBackdrop?: boolean;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overscroll-contain bg-black/40 p-3 sm:p-8"
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div
        className={cx(
          "my-auto w-full rounded-2xl border border-hair bg-white shadow-2xl",
          wide ? "max-w-4xl" : "max-w-2xl"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-hair px-4 py-3.5 sm:px-6 sm:py-4">
          <h2 className="text-base font-bold text-slate-950 sm:text-lg">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="-mr-1 grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>
        <div className="p-4 sm:p-6">{children}</div>
      </div>
    </div>
  );
}
