/**
 * Monta um link wa.me a partir de um telefone brasileiro (com ou sem DDI/máscara)
 * e uma mensagem opcional pré-preenchida. Retorna null se não houver número.
 */
export function whatsappLink(
  phone: string | null | undefined,
  message?: string
): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
  const text = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${withCountry}${text}`;
}
