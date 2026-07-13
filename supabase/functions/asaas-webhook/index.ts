import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { renderTemplate } from "../_shared/email-templates.ts";
import { sendEmail } from "../_shared/resend.ts";

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

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 40) || "garagem"
  );
}
const rand = () => Math.random().toString(36).slice(2, 7);

type Created = {
  seller: { id: string; email: string };
  welcome: { email: string; name: string; setPasswordUrl: string | null };
};

// Criação adiada: pagamento confirmado e ainda não há seller para esse customer.
// Lê rv_pending_signups, cria o auth user (sem senha) + o seller (active) e
// devolve os dados do e-mail de boas-vindas (com link para definir a senha).
async function createAccountFromPending(
  db: SupabaseClient,
  customerId: string
): Promise<Created | null> {
  const { data: pend } = await db
    .from("rv_pending_signups")
    .select("*")
    .eq("asaas_customer_id", customerId)
    .maybeSingle();
  if (!pend) return null;

  // idempotência: conta já criada para esse e-mail
  const { data: already } = await db
    .from("rv_sellers")
    .select("id, email")
    .eq("email", pend.email)
    .maybeSingle();
  if (already) {
    await db.from("rv_pending_signups").delete().eq("id", pend.id);
    return null;
  }

  // auth user (sem senha; sem metadata.name p/ não acionar o auto-create do app)
  let userId: string | null = null;
  const created = await db.auth.admin.createUser({
    email: pend.email,
    email_confirm: true,
  });
  if (created.data?.user) {
    userId = created.data.user.id;
  } else {
    // já existe → localiza pelo e-mail
    const list = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
    userId = list.data?.users.find((u) => u.email === pend.email)?.id ?? null;
  }
  if (!userId) throw new Error("Não foi possível criar/obter o usuário do Auth.");

  // seller (loja) com slug único
  const base = slugify(pend.name);
  let sellerId: string | null = null;
  for (let i = 0; i < 5; i++) {
    const slug = i === 0 ? base : `${base}-${rand()}`;
    const ins = await db
      .from("rv_sellers")
      .insert({
        user_id: userId,
        name: pend.name,
        slug,
        email: pend.email,
        phone: pend.phone,
        cpf_cnpj: pend.cpf_cnpj,
        city: pend.city,
        role: "garagista",
        status: "active",
        pricing_plan_key: pend.pricing_plan_key,
        plan_cycle: pend.plan_cycle,
        asaas_customer_id: pend.asaas_customer_id,
        asaas_subscription_id: pend.asaas_subscription_id,
      })
      .select("id")
      .single();
    if (!ins.error) {
      sellerId = ins.data.id as string;
      break;
    }
    const dup = ins.error.code === "23505" || /duplicate key/i.test(ins.error.message);
    if (dup && /slug/i.test(ins.error.message)) continue;
    throw new Error(ins.error.message);
  }
  if (!sellerId) throw new Error("Não foi possível gerar o endereço da mini-loja.");

  // link para o garagista definir a senha. Usamos o token_hash num link para o
  // NOSSO app (/definir-senha), que chama verifyOtp via JS — assim scanners de
  // e-mail (Gmail) não consomem o token de uso único antes do clique do usuário.
  let setPasswordUrl: string | null = null;
  try {
    const link = await db.auth.admin.generateLink({
      type: "recovery",
      email: pend.email,
      options: { redirectTo: `${APP_URL}/definir-senha` },
    });
    const props = link.data?.properties;
    const tokenHash = props?.hashed_token;
    setPasswordUrl = tokenHash
      ? `${APP_URL}/definir-senha?token_hash=${tokenHash}&type=recovery`
      : props?.action_link ?? null;
  } catch (e) {
    console.error("Falha ao gerar link de senha:", e);
  }

  await db.from("rv_pending_signups").delete().eq("id", pend.id);

  return {
    seller: { id: sellerId, email: pend.email },
    welcome: { email: pend.email, name: pend.name, setPasswordUrl },
  };
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
      const acc = await createAccountFromPending(db, payment.customer);
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
