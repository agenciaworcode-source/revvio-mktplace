import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
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
    "bg-brand text-slate-950 hover:bg-brand-dark disabled:opacity-50 font-semibold",
  outline:
    "border border-slate-700 text-slate-100 hover:border-brand hover:text-brand",
  ghost: "text-slate-300 hover:text-white hover:bg-slate-800",
  danger: "bg-red-600 text-white hover:bg-red-700 font-semibold",
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
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm",
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
  "w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm " +
  "text-white placeholder:text-slate-500 outline-none transition-colors " +
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
  <select ref={ref} className={cx(fieldBase, className)} {...rest}>
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
      <label htmlFor={htmlFor} className="text-sm font-medium text-slate-200">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}
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
        "rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl",
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
  info: "border-sky-800 bg-sky-950/50 text-sky-200",
  error: "border-red-800 bg-red-950/50 text-red-200",
  success: "border-brand-dark bg-emerald-950/50 text-emerald-200",
  warning: "border-amber-800 bg-amber-950/50 text-amber-200",
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
  neutral: "bg-slate-800 text-slate-300",
  green: "bg-emerald-950 text-emerald-300 border border-emerald-800",
  amber: "bg-amber-950 text-amber-300 border border-amber-800",
  red: "bg-red-950 text-red-300 border border-red-800",
  sky: "bg-sky-950 text-sky-300 border border-sky-800",
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
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
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
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
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
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
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
    <div className="rounded-2xl border border-dashed border-slate-800 px-6 py-16 text-center">
      <p className="text-base font-semibold text-slate-200">{title}</p>
      {description && (
        <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{description}</p>
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
  closeOnBackdrop = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Fecha ao clicar fora. Desligue em formulários p/ não perder o preenchimento. */
  closeOnBackdrop?: boolean;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:p-8"
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div
        className="my-auto w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

/* ── Spinner ────────────────────────────────────────────── */
export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cx("animate-spin", className ?? "h-5 w-5")}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"
      />
    </svg>
  );
}
