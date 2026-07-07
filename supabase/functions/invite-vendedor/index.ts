import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { renderTemplate } from "../_shared/email-templates.ts";
import { sendEmail } from "../_shared/resend.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = Deno.env.get("APP_URL") ?? "https://loja.revvio.com.br";

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
      .select("id, role, parent_id, name")
      .eq("user_id", auth.user.id)
      .single();
    if (cErr || !caller) return json({ error: "Perfil não encontrado." }, 403);
    if (caller.role !== "garagista" && caller.role !== "admin")
      return json({ error: "Apenas o garagista pode cadastrar vendedores." }, 403);

    const loja = caller.parent_id ?? caller.id; // a loja do chamador

    // 2. payload
    const body = await req.json().catch(() => ({}));
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const rate = Number(body.commission_rate ?? 0);
    if (!name || !email) return json({ error: "Nome e e-mail são obrigatórios." }, 400);
    if (Number.isNaN(rate) || rate < 0 || rate > 100)
      return json({ error: "Taxa de comissão inválida (0–100)." }, 400);

    // 3. cria o usuário do Auth (sem senha; e-mail confirmado)
    const created = await db.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    if (created.error || !created.data?.user) {
      const msg = created.error?.message ?? "Erro ao criar o usuário.";
      const code = /already|exist|registered/i.test(msg) ? 409 : 400;
      return json(
        { error: code === 409 ? "Este e-mail já tem conta." : msg },
        code
      );
    }
    const userId = created.data.user.id;

    // 4. cria a linha do vendedor vinculada à loja do chamador
    const { data: vendedor, error: vErr } = await db
      .from("rv_sellers")
      .insert({
        user_id: userId,
        name,
        email,
        role: "vendedor",
        status: "active",
        parent_id: loja,
        commission_rate: rate,
      })
      .select("id")
      .single();
    if (vErr) {
      await db.auth.admin.deleteUser(userId); // desfaz o usuário órfão
      return json({ error: vErr.message }, 400);
    }

    // 5. link para o vendedor definir a senha (token_hash → /definir-senha, à
    //    prova de scanner: o verifyOtp roda no JS da página)
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
      console.error("Falha ao gerar link de senha do vendedor:", e);
    }

    // 6. e-mail de boas-vindas (Resend, best-effort)
    try {
      const rendered = renderTemplate("vendedor_welcome", {
        name,
        loja: caller.name ?? "",
        set_password_url: setPasswordUrl,
      });
      if (rendered)
        await sendEmail({ to: email, subject: rendered.subject, html: rendered.html });
    } catch (e) {
      console.error("Falha ao enviar e-mail do vendedor:", e);
    }

    return json({ ok: true, vendedorId: vendedor.id });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erro interno." }, 500);
  }
});
