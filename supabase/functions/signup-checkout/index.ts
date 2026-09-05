import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import {
  createCustomer,
  createSubscription,
  getSubscriptionFirstPayment,
} from "../_shared/asaas.ts";
import { lookupCnpj, validateCnpj } from "../_shared/cnpj.ts";
import { createAccountFromPending } from "../_shared/onboarding.ts";
import { renderTemplate } from "../_shared/email-templates.ts";
import { sendEmail } from "../_shared/resend.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = Deno.env.get("APP_URL") ?? "https://loja.revvio.com.br";

const today = () => new Date().toISOString().slice(0, 10);

// Cadastro público do garagista: cria a cobrança no ASAAS e guarda os dados
// em rv_pending_signups. A conta (auth user + seller) só é criada pelo webhook
// quando o pagamento confirma.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const phone = body.phone ? String(body.phone) : null;
    const cnpj = body.cnpj ? String(body.cnpj).replace(/\D/g, "") : null;
    const city = body.city ? String(body.city) : null;
    const plan = String(body.plan ?? "").trim();
    const cycle = (body.cycle === "annual" ? "annual" : "monthly") as
      | "monthly"
      | "annual";

    if (!name || !email || !plan) return json({ error: "Dados incompletos." }, 400);
    if (!cnpj || cnpj.length !== 14)
      return json({ error: "CNPJ inválido." }, 400);

    const db = createClient(SUPABASE_URL, SERVICE_KEY);

    // já existe conta com esse e-mail? → manda fazer login (não duplica/paga de novo)
    const { data: existingSeller } = await db
      .from("rv_sellers")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (existingSeller)
      return json({ error: "Este e-mail já tem conta. Faça login." }, 409);

    // plano (tier)
    const { data: tier, error: pErr } = await db
      .from("rv_pricing_plans")
      .select("key, name, price_monthly, price_annual, is_free")
      .eq("key", plan)
      .single();
    if (pErr || !tier) return json({ error: "Plano inválido." }, 400);

    const isFree = tier.is_free === true;
    const value =
      cycle === "annual" ? Number(tier.price_annual) * 12 : Number(tier.price_monthly);
    // Plano pago sem preço quebraria o checkout: o ASAAS recusa a assinatura com
    // "O parâmetro value deve ser informado", e o garagista lia isso como se
    // faltasse algo no formulário dele. O CHECK do banco impede chegar aqui,
    // mas a barreira fica: erro de configuração não vira erro de cobrança.
    if (!isFree && (!Number.isFinite(value) || value <= 0)) {
      console.error(`Plano "${plan}" sem preço válido (${cycle}): ${value}`);
      return json(
        { error: "Este plano está sem preço configurado. Escolha outro plano ou fale com o suporte." },
        409
      );
    }

    // Gate definitivo: re-valida CNPJ/CNAE no servidor (o front pode ser burlado).
    const cnpjResult = await lookupCnpj(cnpj);
    if (cnpjResult.status === "unavailable")
      return json({ error: "Não foi possível consultar o CNPJ agora. Tente novamente." }, 503);
    if (cnpjResult.status === "not_found")
      return json({ error: "CNPJ não encontrado na Receita." }, 400);
    const cnpjCheck = validateCnpj(cnpjResult.data);
    if (!cnpjCheck.ok)
      return json(
        {
          error:
            cnpjCheck.reason === "inactive"
              ? `Este CNPJ está ${cnpjCheck.situacao}. Apenas empresas ativas podem se cadastrar.`
              : "A atividade da empresa não é elegível. O cadastro é exclusivo para lojas do ramo automotivo.",
        },
        400
      );

    // ── Plano gratuito ──────────────────────────────────────────
    // Sem cobrança não há webhook para disparar a criação da conta, então o
    // cadastro libera o acesso aqui mesmo. O pending é gravado do mesmo jeito
    // (sem ids do ASAAS) para reaproveitar a criação de conta do fluxo pago.
    if (isFree) {
      const { error: upErr } = await db.from("rv_pending_signups").upsert(
        {
          name,
          email,
          phone,
          cpf_cnpj: cnpj,
          city,
          pricing_plan_key: plan,
          plan_cycle: cycle,
          asaas_customer_id: null,
          asaas_subscription_id: null,
          asaas_payment_id: null,
          invoice_url: null,
        },
        { onConflict: "email" }
      );
      if (upErr) return json({ error: upErr.message }, 500);

      const acc = await createAccountFromPending(db, { email });
      if (!acc) return json({ error: "Não foi possível criar a conta. Tente novamente." }, 500);

      // O link de senha vai só por e-mail, nunca na resposta: quem preencheu o
      // formulário não é necessariamente o dono do e-mail.
      const rendered = renderTemplate("garagista_welcome", {
        name: acc.welcome.name,
        set_password_url: acc.welcome.setPasswordUrl ?? `${APP_URL}/login`,
      });
      if (rendered) {
        try {
          await sendEmail({
            to: acc.welcome.email,
            subject: rendered.subject,
            html: rendered.html,
          });
        } catch (e) {
          console.error("Falha ao enviar boas-vindas do plano gratuito:", e);
        }
      }

      return json({ free: true, email: acc.welcome.email });
    }

    // reusa um pending anterior (mesmo e-mail) para não criar customer duplicado
    const { data: prev } = await db
      .from("rv_pending_signups")
      .select("asaas_customer_id")
      .eq("email", email)
      .maybeSingle();

    let customerId = prev?.asaas_customer_id as string | null;
    if (!customerId) {
      const customer = await createCustomer({
        name,
        cpfCnpj: cnpj,
        email,
        mobilePhone: phone?.replace(/\D/g, "") || null,
      });
      customerId = customer.id;
    }

    const subInput = {
      customer: customerId!,
      billingType: "UNDEFINED",
      value,
      nextDueDate: today(),
      cycle: cycle === "annual" ? "YEARLY" : "MONTHLY",
      description: `Plano ${tier.name} (${cycle === "annual" ? "anual" : "mensal"}) — Revvio`,
    };
    // O callback redireciona o garagista de volta após pagar, mas o ASAAS exige
    // domínio cadastrado na conta. Se falhar por isso, segue sem o redirect.
    let sub;
    try {
      sub = await createSubscription({
        ...subInput,
        callback: { successUrl: `${APP_URL}/pagamento-confirmado`, autoRedirect: true },
      });
    } catch (e) {
      console.error("Assinatura com callback falhou; tentando sem callback:", e);
      sub = await createSubscription(subInput);
    }

    const payment = await getSubscriptionFirstPayment(sub.id);
    if (!payment) return json({ error: "Cobrança indisponível. Tente novamente." }, 502);

    await db.from("rv_pending_signups").upsert(
      {
        name,
        email,
        phone,
        cpf_cnpj: cnpj,
        city,
        pricing_plan_key: plan,
        plan_cycle: cycle,
        asaas_customer_id: customerId,
        asaas_subscription_id: sub.id,
        asaas_payment_id: payment.id,
        invoice_url: payment.invoiceUrl ?? null,
      },
      { onConflict: "email" }
    );

    return json({ invoiceUrl: payment.invoiceUrl });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erro interno." }, 500);
  }
});
