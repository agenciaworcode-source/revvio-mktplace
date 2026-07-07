// Agregação client-side de métricas de afiliado, compartilhada entre a visão
// do garagista (escopo da loja) e a do admin (global). Puro: sem I/O.

export type AffiliateMetrics = {
  shares: number;
  clicks: number;
  salesCount: number;
  salesVolume: number;
  commissionPending: number;
  commissionPaid: number;
};

export function emptyMetrics(): AffiliateMetrics {
  return {
    shares: 0,
    clicks: 0,
    salesCount: 0,
    salesVolume: 0,
    commissionPending: 0,
    commissionPaid: 0,
  };
}

export type AggInput = {
  sales: { affiliate_id: string | null; sale_price: number | string }[];
  commissions: { affiliate_id: string | null; amount: number | string; status: string }[];
  clicks: { affiliate_id: string | null; kind: string }[];
};

/** Soma métricas por affiliate_id. Linhas com affiliate_id nulo são ignoradas. */
export function buildAffiliateMetrics(input: AggInput): Map<string, AffiliateMetrics> {
  const m = new Map<string, AffiliateMetrics>();
  const get = (id: string): AffiliateMetrics => {
    let x = m.get(id);
    if (!x) {
      x = emptyMetrics();
      m.set(id, x);
    }
    return x;
  };
  for (const s of input.sales) {
    if (!s.affiliate_id) continue;
    const x = get(s.affiliate_id);
    x.salesCount += 1;
    x.salesVolume += Number(s.sale_price);
  }
  for (const c of input.commissions) {
    if (!c.affiliate_id) continue;
    const x = get(c.affiliate_id);
    if (c.status === "paid") x.commissionPaid += Number(c.amount);
    else x.commissionPending += Number(c.amount);
  }
  for (const e of input.clicks) {
    if (!e.affiliate_id) continue;
    const x = get(e.affiliate_id);
    if (e.kind === "affiliate_share") x.shares += 1;
    else if (e.kind === "affiliate_link_visit") x.clicks += 1;
  }
  return m;
}
