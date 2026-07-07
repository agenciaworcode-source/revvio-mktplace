import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import {
  cancelSubscription,
  createCustomer,
  createPayment,
  createSubscription,
} from "../_shared/asaas.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // 1. autoriza: só admin pode disparar cobranças
    const authHeader = req.headers.get("Authorization") ?? "";
    const asUser = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: isAdmin, error: adminErr } = await asUser.rpc("is_admin");
    if (adminErr) throw adminErr;
    if (!isAdmin) return json({ error: "Acesso restrito ao administrador." }, 403);

    // 2. cliente service-role para gravações (ignora RLS)
    const db = createClient(SUPABASE_URL, SERVICE_KEY);

    const { action, sellerId, billingType = "PIX" } = await req.json();
    if (!sellerId) return json({ error: "sellerId é obrigatório." }, 400);

    const { data: seller, error: sErr } = await db
      .from("rv_sellers")
      .select("id, name, email, phone, whatsapp, cpf_cnpj, asaas_customer_id")
      .eq("id", sellerId)
      .single();
    if (sErr) throw sErr;

    if (action === "activate-plan") {
      if (!seller.cpf_cnpj)
        return json({ error: "Garagista sem CPF/CNPJ — exigido pelo ASAAS." }, 400);

      // garante o cliente no ASAAS
      let customerId = seller.asaas_customer_id as string | null;
      if (!customerId) {
        const customer = await createCustomer({
          name: seller.name,
          cpfCnpj: seller.cpf_cnpj.replace(/\D/g, ""),
          email: seller.email,
          mobilePhone: (seller.whatsapp ?? seller.phone)?.replace(/\D/g, "") || null,
        });
        customerId = customer.id;
        await db
          .from("rv_sellers")
          .update({ asaas_customer_id: customerId })
          .eq("id", sellerId);
      }

      const { data: plan, error: pErr } = await db
        .from("rv_plans")
        .select("id, name, rv_plan_items(label, value, billing_type)")
        .eq("seller_id", sellerId)
        .single();
      if (pErr) throw pErr;

      const items = (plan.rv_plan_items ?? []) as Array<{
        label: string;
        value: number;
        billing_type: string;
      }>;

      const monthly = items.filter((i) => i.billing_type === "mensal");
      const oneOff = items.filter((i) => i.billing_type === "taxa_unica");
      const results: Record<string, unknown> = {};

      // assinatura mensal = soma dos itens mensais
      const monthlyTotal = monthly.reduce((acc, i) => acc + Number(i.value), 0);
      if (monthlyTotal > 0) {
        const sub = await createSubscription({
          customer: customerId,
          billingType,
          value: monthlyTotal,
          nextDueDate: addDays(7),
          cycle: "MONTHLY",
          description: `Plano ${plan.name}: ${monthly.map((i) => i.label).join(", ")}`,
        });
        await db
          .from("rv_plans")
          .update({ asaas_subscription_id: sub.id, active: true })
          .eq("id", plan.id);
        results.subscriptionId = sub.id;
      }

      // cobranças avulsas (taxa única)
      for (const item of oneOff) {
        const pay = await createPayment({
          customer: customerId,
          billingType,
          value: Number(item.value),
          dueDate: addDays(7),
          description: item.label,
        });
        await db.from("rv_charges").insert({
          seller_id: sellerId,
          plan_id: plan.id,
          asaas_id: pay.id,
          description: item.label,
          value: pay.value,
          billing_type: pay.billingType,
          status: pay.status,
          due_date: pay.dueDate,
          invoice_url: pay.invoiceUrl ?? null,
        });
      }

      return json({ ok: true, customerId, ...results });
    }

    if (action === "cancel-plan") {
      const { data: plan } = await db
        .from("rv_plans")
        .select("id, asaas_subscription_id")
        .eq("seller_id", sellerId)
        .single();
      if (plan?.asaas_subscription_id) {
        await cancelSubscription(plan.asaas_subscription_id);
      }
      await db
        .from("rv_plans")
        .update({ active: false, asaas_subscription_id: null })
        .eq("seller_id", sellerId);
      return json({ ok: true });
    }

    return json({ error: `Ação desconhecida: ${action}` }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erro interno." }, 500);
  }
});
