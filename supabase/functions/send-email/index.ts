import { corsHeaders, json } from "../_shared/cors.ts";
import { renderTemplate } from "../_shared/email-templates.ts";
import { sendEmail } from "../_shared/resend.ts";

// Função genérica de envio. Chamada pelos triggers do banco (pg_net) e por
// outras Edge Functions, autenticada por um segredo compartilhado.
const TRIGGER_SECRET = Deno.env.get("EMAIL_TRIGGER_SECRET");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // valida o segredo compartilhado (se configurado)
  if (TRIGGER_SECRET && req.headers.get("x-email-secret") !== TRIGGER_SECRET) {
    return json({ error: "Não autorizado." }, 401);
  }

  try {
    const { template, to, data = {} } = await req.json();
    if (!template || !to) return json({ error: "template e to são obrigatórios." }, 400);

    const rendered = renderTemplate(template, data);
    if (!rendered) return json({ error: `Template desconhecido: ${template}` }, 400);

    const result = await sendEmail({
      to,
      subject: rendered.subject,
      html: rendered.html,
    });
    return json({ ok: true, id: result.id });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erro interno." }, 500);
  }
});
