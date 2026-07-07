// Registry de templates de e-mail transacional. Cada um recebe `data` (jsonb do
// trigger / webhook) e devolve { subject, html }. Veja docs/emails-transacionais.md.

const APP_URL = Deno.env.get("APP_URL") ?? "http://localhost:5173";
const BRAND = "#10b981";

type Data = Record<string, unknown>;
type Template = (d: Data) => { subject: string; html: string };

function str(d: Data, k: string, fallback = ""): string {
  const v = d[k];
  return v == null ? fallback : String(v);
}

/** Moldura HTML comum (dark, identidade REVVIO). */
function layout(opts: {
  heading: string;
  body: string;
  cta?: { label: string; href: string };
}): string {
  const button = opts.cta
    ? `<a href="${opts.cta.href}" style="display:inline-block;background:${BRAND};color:#0f172a;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:10px;font-size:14px">${opts.cta.label}</a>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#0f172a;font-family:system-ui,Segoe UI,sans-serif;color:#e2e8f0">
  <div style="max-width:520px;margin:0 auto;padding:32px 24px">
    <div style="font-size:22px;font-weight:800;letter-spacing:-.5px;margin-bottom:24px">REVV<span style="color:${BRAND}">IO</span></div>
    <div style="background:#1e293b;border:1px solid #334155;border-radius:16px;padding:28px">
      <h1 style="font-size:19px;margin:0 0 12px;color:#fff">${opts.heading}</h1>
      <div style="font-size:14px;line-height:1.6;color:#cbd5e1">${opts.body}</div>
      ${button ? `<div style="margin-top:22px">${button}</div>` : ""}
    </div>
    <p style="font-size:12px;color:#64748b;margin-top:20px;text-align:center">REVVIO · Marketplace Multi-Vendedores</p>
  </div></body></html>`;
}

export const templates: Record<string, Template> = {
  // #7 — cadastro recebido (→ garagista) · fluxo pay-first
  seller_registered: (d) => ({
    subject: "Recebemos seu cadastro — conclua o pagamento — REVVIO",
    html: layout({
      heading: `Olá, ${str(d, "name", "garagista")}!`,
      body: "Recebemos seu cadastro. Para liberar o acesso à plataforma, <strong>conclua o pagamento do plano escolhido</strong>. Assim que o pagamento for confirmado, sua mini-loja é ativada automaticamente.",
      cta: { label: "Concluir pagamento", href: `${APP_URL}/checkout` },
    }),
  }),

  // #8 — novo garagista cadastrado (→ admin)
  admin_new_seller: (d) => ({
    subject: "Novo garagista cadastrado",
    html: layout({
      heading: "Novo cadastro de garagista",
      body: `<strong>${str(d, "name")}</strong> (${str(d, "email")}) se cadastrou e aguarda a confirmação do pagamento.`,
      cta: { label: "Ver garagista", href: `${APP_URL}/dashboard/sellers/${str(d, "seller_id")}` },
    }),
  }),

  // boas-vindas (→ garagista) · enviado pelo webhook quando a conta é criada
  // após o pagamento; traz o link para definir a senha e acessar.
  garagista_welcome: (d) => ({
    subject: "Pagamento confirmado 🎉 — defina sua senha — REVVIO",
    html: layout({
      heading: `Bem-vindo à REVVIO, ${str(d, "name", "garagista")}!`,
      body: "Seu <strong>pagamento foi confirmado</strong> e sua mini-loja foi criada. Para acessar, defina sua senha no botão abaixo.",
      cta: { label: "Definir senha e acessar", href: str(d, "set_password_url", `${APP_URL}/login`) },
    }),
  }),

  // boas-vindas do vendedor (→ vendedor) · enviado pela invite-vendedor
  // quando o garagista convida; traz o link para definir a senha e acessar.
  vendedor_welcome: (d) => ({
    subject: "Você foi convidado para a REVVIO — defina sua senha",
    html: layout({
      heading: `Olá, ${str(d, "name", "vendedor")}!`,
      body: `Você foi convidado como <strong>vendedor</strong>${
        str(d, "loja") ? ` da loja <strong>${str(d, "loja")}</strong>` : ""
      } na REVVIO. Para acessar e começar a registrar vendas, defina sua senha no botão abaixo.`,
      cta: { label: "Definir senha e acessar", href: str(d, "set_password_url", `${APP_URL}/login`) },
    }),
  }),

  // boas-vindas do afiliado (→ afiliado) · enviado pela invite-affiliate
  // quando o garagista convida; traz o link para definir a senha e acessar.
  afiliado_welcome: (d) => ({
    subject: "Você foi convidado como afiliado na REVVIO — defina sua senha",
    html: layout({
      heading: `Olá, ${str(d, "name", "afiliado")}!`,
      body: `Você foi convidado como <strong>afiliado</strong>${
        str(d, "loja") ? ` da loja <strong>${str(d, "loja")}</strong>` : ""
      } na REVVIO. Como afiliado, você divulga os veículos da loja com o seu link próprio e acompanha o seu desempenho. Para acessar, defina sua senha no botão abaixo.`,
      cta: { label: "Definir senha e acessar", href: str(d, "set_password_url", `${APP_URL}/login`) },
    }),
  }),

  // afiliado sinalizou uma venda (→ garagista)
  affiliate_sale_signal: (d) => ({
    subject: "Um afiliado sinalizou uma venda — REVVIO",
    html: layout({
      heading: "Venda sinalizada por afiliado",
      body: `<p>O afiliado <strong>${str(d, "affiliate")}</strong> avisou que ajudou numa venda${
        str(d, "vehicle") ? ` do <strong>${str(d, "vehicle")}</strong>` : ""
      }.</p>${
        str(d, "note") ? `<p style="margin-top:8px">Observação: "${str(d, "note")}"</p>` : ""
      }<p style="margin-top:8px">Abra o painel para registrar a venda e atribuí-la a este afiliado.</p>`,
      cta: { label: "Abrir Afiliados", href: `${APP_URL}/painel/afiliados` },
    }),
  }),

  // #9 — pagamento confirmado, acesso liberado (→ garagista) · dispara no webhook (pending→active)
  seller_approved: (d) => ({
    subject: "Pagamento confirmado, acesso liberado 🎉 — REVVIO",
    html: layout({
      heading: `Tudo certo, ${str(d, "name", "garagista")}!`,
      body: "Seu <strong>pagamento foi confirmado</strong> e o acesso à plataforma está liberado. Você já pode publicar veículos, montar sua equipe e registrar vendas.",
      cta: { label: "Acessar meu painel", href: `${APP_URL}/painel` },
    }),
  }),

  // #10 — rejeitado / suspenso (→ garagista)
  seller_suspended: () => ({
    subject: "Atualização do seu acesso — REVVIO",
    html: layout({
      heading: "Acesso suspenso",
      body: "Seu acesso à plataforma foi <strong>suspenso</strong> pelo administrador. Entre em contato com a gestão para regularizar sua situação.",
    }),
  }),

  // #11 — reativado (→ garagista)
  seller_reactivated: (d) => ({
    subject: "Seu acesso foi reativado — REVVIO",
    html: layout({
      heading: `Bem-vindo de volta, ${str(d, "name", "vendedor")}!`,
      body: "Seu acesso foi <strong>reativado</strong>. Tudo voltou ao normal no seu painel.",
      cta: { label: "Acessar meu painel", href: `${APP_URL}/painel` },
    }),
  }),

  // #12 — veículo cadastrado (→ admin)
  admin_new_vehicle: (d) => ({
    subject: "Novo veículo cadastrado",
    html: layout({
      heading: "Novo veículo na plataforma",
      body: `<strong>${str(d, "seller_name")}</strong> cadastrou: ${str(d, "make")} ${str(d, "model")} ${str(d, "year")}.`,
    }),
  }),

  // #13 — venda registrada (→ garagista)
  sale_confirmation: (d) => ({
    subject: "Venda registrada — REVVIO",
    html: layout({
      heading: "Venda registrada com sucesso",
      body: `Venda de <strong>${str(d, "vehicle")}</strong> para ${str(d, "buyer_name")} por ${str(d, "sale_price")}. A comissão da plataforma foi gerada automaticamente.`,
      cta: { label: "Ver financeiro", href: `${APP_URL}/painel/financeiro` },
    }),
  }),

  // #16/D — nova cobrança gerada (→ garagista)
  charge_created: (d) => ({
    subject: "Nova cobrança disponível — REVVIO",
    html: layout({
      heading: "Você tem uma nova cobrança",
      body: `Referente a: ${str(d, "description", "plano")}. Valor ${str(d, "value")} · vencimento ${str(d, "due_date")}.`,
      cta: { label: "Ver fatura", href: str(d, "invoice_url", APP_URL) },
    }),
  }),

  // #17 — pagamento confirmado (→ garagista)
  payment_confirmed: (d) => ({
    subject: "Pagamento confirmado — REVVIO",
    html: layout({
      heading: "Recebemos seu pagamento ✅",
      body: `Confirmamos o pagamento de ${str(d, "value")} referente a ${str(d, "description", "sua cobrança")}. Obrigado!`,
    }),
  }),

  // #18/D — cobrança vencida (→ garagista)
  charge_overdue: (d) => ({
    subject: "Cobrança vencida — REVVIO",
    html: layout({
      heading: "Sua cobrança está vencida",
      body: `A cobrança de ${str(d, "value")} (${str(d, "description", "plano")}) venceu em ${str(d, "due_date")}. Regularize para manter sua conta ativa.`,
      cta: { label: "Pagar agora", href: str(d, "invoice_url", APP_URL) },
    }),
  }),
};

export function renderTemplate(
  key: string,
  data: Data
): { subject: string; html: string } | null {
  const t = templates[key];
  return t ? t(data) : null;
}
