import type { Vehicle } from "@/lib/database.types";
import { formatCurrency, formatNumber } from "@/lib/format";
import { bodyLabels, fuelLabels, transmissionLabels } from "@/features/public/vehicleLabels";

/**
 * Monta o texto de anúncio para WhatsApp a partir de um veículo.
 * Cada linha só aparece se o campo correspondente existir (omite o que não
 * está cadastrado). O resultado é editável pelo garagista antes de copiar.
 */
export function buildWhatsappCopy(v: Vehicle, sellerName?: string | null): string {
  const linhas: string[] = [];
  const sep = "- - - - - - - - - - - - - - - - - - -";
  const bar = "▃▃▃▃▃▃▃▃▃▃▃▃▃▃";

  if (sellerName) linhas.push(`🚀 ${sellerName.toUpperCase()} 🚀`, "");

  linhas.push(`🚗 ${[v.make, v.model].filter(Boolean).join(" ")}`);

  // ── Especificações ──
  const specs: string[] = [];
  if (v.year) specs.push(`📅 ANO/MOD: ${v.year}`);
  if (v.mileage != null) specs.push(`🕧 KM: ${formatNumber(v.mileage)}`);
  if (v.fuel) specs.push(`⛽ COMBUSTÍVEL: ${fuelLabels[v.fuel] ?? v.fuel}`);
  if (v.transmission)
    specs.push(`🕹️ CÂMBIO: ${transmissionLabels[v.transmission] ?? v.transmission}`);
  if (v.color) specs.push(`🎨 COR: ${v.color}`);
  if (v.body_type) specs.push(`🚘 CARROCERIA: ${bodyLabels[v.body_type] ?? v.body_type}`);
  if (v.armored) specs.push("🛡️ BLINDADO: Sim");
  if (v.documentacao) specs.push(`🧾 DOCUMENTAÇÃO: ${v.documentacao}`);
  if (v.ipva) specs.push(`✅ IPVA: ${v.ipva}`);
  if (v.origem) specs.push(`🌎 ORIGEM: ${v.origem}`);
  if (v.primeiro_dono != null)
    specs.push(`👤 PRIMEIRO DONO: ${v.primeiro_dono ? "Sim" : "Não"}`);
  if (v.leilao != null) specs.push(`🔨 LEILÃO: ${v.leilao ? "Sim" : "Não"}`);
  if (v.garantia) specs.push(`🛡️ GARANTIA: ${v.garantia}`);

  if (specs.length) linhas.push(sep, ...specs);

  // ── Opcionais e observações ──
  const extras: string[] = [];
  if (v.options?.length) extras.push(`✅ OPCIONAIS: ${v.options.join(", ")}`);
  if (v.description?.trim()) extras.push(`📝 OBSERVAÇÕES: ${v.description.trim()}`);
  if (extras.length) linhas.push(sep, ...extras);

  // ── Preço ──
  linhas.push(bar);
  if (v.fipe_price) linhas.push(`📈 FIPE: ${formatCurrency(v.fipe_price)}`);
  linhas.push(`📉 POR: ${formatCurrency(v.price)}`);
  linhas.push("🔥🔥🔥🔥🔥🔥🔥🔥🔥", "🚨 CHAMA NA PROPOSTA 🚨", bar);

  return linhas.join("\n");
}
