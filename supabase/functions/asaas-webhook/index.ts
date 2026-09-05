import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { renderTemplate } from "../_shared/email-templates.ts";
import { sendEmail } from "../_shared/resend.ts";
import { createAccountFromPending, type Created } from "../_shared/onboarding.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Obrigatório: a function é pública (verify_jwt = false), então o token é a única
// barreira contra um POST forjado criando conta grátis ou cobrança falsa.
const WEBHOOK_TOKEN = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
if (!WEBHOOK_TOKEN) throw new Error("ASAAS_WEBHOOK_TOKEN não configurada.");
const APP_URL = Deno.env.get("APP_URL") ?? "https://loja.revvio.com.br";

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(v ?? 0)
  );

// evento ASAAS → template de e-mail transacional
const eventTemplate: Record<string, string> = {
  PAYMENT_CREATED: "charge_created",
  PAYMENT_CONFIRMED: "payment_confirmed",
  PAYMENT_RECEIVED: "payment_confirmed",
  PAYMENT_OVERDUE: "charge_overdue",
};

// envio best-effort: nunca derruba o processamento do webhook
async function tryEmail(to: string | null, template: string, data: Record<string, unknown>) {
  if (!to) return;
  const rendered = renderTemplate(template, data);
  if (!rendered) return;
  try {
    await sendEmail({ to, subject: rendered.subject, html: rendered.html });
  } catch (e) {
    console.error("Falha ao enviar e-mail do webhook:", e);
  }
}


// ASAAS envia { event, payment } a cada mudança de status de cobrança.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (req.headers.get("asaas-access-token") !== WEBHOOK_TOKEN) {
    return json({ error: "Token inválido." }, 401);
  }

  try {
    const body = await req.json();
    const payment = body?.payment;
    if (!payment?.id) return json({ ok: true, skipped: "sem payment" });

    const db = createClient(SUPABASE_URL, SERVICE_KEY);
    const isPaid =
      body.event === "PAYMENT_CONFIRMED" || body.event === "PAYMENT_RECEIVED";

    // seller já existente para esse customer
    let seller: { id: string; email: string } | null = null;
    {
      const { data } = await db
        .from("rv_sellers")
        .select("id, email")
        .eq("asaas_customer_id", payment.customer)
        .maybeSingle();
      seller = data ?? null;
    }

    // criação adiada: paga e ainda sem seller → cria a conta a partir do pending
    let welcome: Created["welcome"] | null = null;
    if (isPaid && !seller) {
      const acc = await createAccountFromPending(db, { customerId: payment.customer });
      if (acc) {
        seller = acc.seller;
        welcome = acc.welcome;
      }
    }

    // upsert da cobrança (agora com seller_id, se houver)
    const row = {
      seller_id: seller?.id ?? null,
      asaas_id: payment.id,
      asaas_subscription_id: payment.subscription ?? null,
      description: payment.description ?? null,
      value: payment.value,
      billing_type: payment.billingType ?? null,
      status: payment.status,
      due_date: payment.dueDate ?? null,
      invoice_url: payment.invoiceUrl ?? null,
    };
    const { data: existing } = await db
      .from("rv_charges")
      .select("id")
      .eq("asaas_id", payment.id)
      .maybeSingle();
    if (existing) await db.from("rv_charges").update(row).eq("id", existing.id);
    else if (seller) await db.from("rv_charges").insert(row);

    // legado: seller já existia como pending → ativa
    if (isPaid && seller && !welcome) {
      await db
        .from("rv_sellers")
        .update({ status: "active" })
        .eq("id", seller.id)
        .neq("status", "active");
    }

    // e-mail: boas-vindas (conta recém-criada) tem prioridade sobre o transacional
    if (welcome) {
      await tryEmail(welcome.email, "garagista_welcome", {
        name: welcome.name,
        set_password_url: welcome.setPasswordUrl ?? `${APP_URL}/login`,
      });
    } else {
      const template = eventTemplate[body.event];
      if (template && seller?.email) {
        await tryEmail(seller.email, template, {
          description: payment.description ?? "cobrança",
          value: brl(payment.value),
          due_date: payment.dueDate ?? "",
          invoice_url: payment.invoiceUrl ?? "",
        });
      }
    }

    return json({ ok: true, event: body.event });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erro interno." }, 500);
  }
});
