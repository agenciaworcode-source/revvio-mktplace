import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { renderTemplate } from "../_shared/email-templates.ts";
import { sendEmail } from "../_shared/resend.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = Deno.env.get("APP_URL") ?? "https://loja.revvio.com.br";

// código curto do afiliado p/ o link público (?ref=). base36, 8 chars.
function genRefCode(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let s = "";
  for (let i = 0; i < 8; i++) s += (bytes[i] % 36).toString(36);
  return s;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // 1. identidade do chamador
    const authHeader = req.headers.get("Authorization") ?? "";
    const asUser = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: auth, error: uErr } = await asUser.auth.getUser();
    if (uErr || !auth?.user) return json({ error: "Não autenticado." }, 401);

    const db = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: caller, error: cErr } = await db
      .from("rv_sellers")
      .select("id, role, parent_id, name, pricing_plan_key")
      .eq("user_id", auth.user.id)
      .single();
    if (cErr || !caller) return json({ error: "Perfil não encontrado." }, 403);
    if (caller.role !== "garagista" && caller.role !== "admin")
      return json({ error: "Apenas o garagista pode cadastrar afiliados." }, 403);

    const loja = caller.parent_id ?? caller.id;

    // 2. gating pelo plano do garagista
    let enabled = false;
    if (caller.pricing_plan_key) {
      const { data: plan } = await db
        .from("rv_pricing_plans")
        .select("affiliates_enabled")
        .eq("key", caller.pricing_plan_key)
        .maybeSingle();
      enabled = !!plan?.affiliates_enabled;
    }
    if (!enabled && caller.role !== "admin")
      return json({ error: "Seu plano não inclui o recurso de afiliados." }, 403);

    // 3. payload
    const body = await req.json().catch(() => ({}));
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const rate = Number(body.commission_rate ?? 0);
    if (!name || !email) return json({ error: "Nome e e-mail são obrigatórios." }, 400);
    if (Number.isNaN(rate) || rate < 0 || rate > 100)
      return json({ error: "Taxa de comissão inválida (0–100)." }, 400);

    // 4. cria o usuário do Auth (sem senha; e-mail confirmado)
    const created = await db.auth.admin.createUser({ email, email_confirm: true });
    if (created.error || !created.data?.user) {
      const msg = created.error?.message ?? "Erro ao criar o usuário.";
      const code = /already|exist|registered/i.test(msg) ? 409 : 400;
      return json({ error: code === 409 ? "Este e-mail já tem conta." : msg }, code);
    }
    const userId = created.data.user.id;

    // 5. cria a linha do afiliado (ref_code único, com retry em colisão)
    let affiliateId: string | null = null;
    let lastErr: string | null = null;
    for (let attempt = 0; attempt < 5 && !affiliateId; attempt++) {
      const { data: aff, error: aErr } = await db
        .from("rv_sellers")
        .insert({
          user_id: userId,
          name,
          email,
          role: "afiliado",
          status: "active",
          parent_id: loja,
          commission_rate: rate,
          ref_code: genRefCode(),
        })
        .select("id")
        .single();
      if (aff) {
        affiliateId = aff.id;
        break;
      }
      const msg = aErr?.message ?? "Erro ao criar o afiliado.";
      lastErr = msg;
      // 23505 = unique_violation; se for o ref_code, tenta outro código
      if (!/duplicate key|unique|23505/i.test(msg)) break;
    }
    if (!affiliateId) {
      await db.auth.admin.deleteUser(userId); // desfaz o usuário órfão
      return json({ error: lastErr ?? "Erro ao criar o afiliado." }, 400);
    }

    // 6. link para definir a senha (token_hash → /definir-senha)
    let setPasswordUrl = `${APP_URL}/login`;
    try {
      const link = await db.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo: `${APP_URL}/definir-senha` },
      });
      const props = link.data?.properties;
      if (props?.hashed_token)
        setPasswordUrl = `${APP_URL}/definir-senha?token_hash=${props.hashed_token}&type=recovery`;
      else if (props?.action_link) setPasswordUrl = props.action_link;
    } catch (e) {
      console.error("Falha ao gerar link de senha do afiliado:", e);
    }

    // 7. e-mail de boas-vindas (best-effort)
    try {
      const rendered = renderTemplate("afiliado_welcome", {
        name,
        loja: caller.name ?? "",
        set_password_url: setPasswordUrl,
      });
      if (rendered)
        await sendEmail({ to: email, subject: rendered.subject, html: rendered.html });
    } catch (e) {
      console.error("Falha ao enviar e-mail do afiliado:", e);
    }

    return json({ ok: true, affiliateId });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erro interno." }, 500);
  }
});
