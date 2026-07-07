const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** 12345.6 → "R$ 12.345,60" */
export function formatCurrency(value: number | null | undefined): string {
  return brl.format(Number(value ?? 0));
}

/** 12345 → "12.345" */
export function formatNumber(value: number | null | undefined): string {
  return new Intl.NumberFormat("pt-BR").format(Number(value ?? 0));
}

/** "2026-06-16" | ISO → "16/06/2026" */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}
