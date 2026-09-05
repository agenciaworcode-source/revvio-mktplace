// Criação da conta do garagista a partir de rv_pending_signups.
//
// Compartilhado porque agora há dois gatilhos: o webhook do ASAAS (quando o
// pagamento confirma) e o cadastro em plano gratuito (que libera na hora, sem
// passar por cobrança). O que acontece depois — auth user, seller ativo e link
// de definição de senha — é idêntico nos dois casos.
import { type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const APP_URL = Deno.env.get("APP_URL") ?? "https://loja.revvio.com.br";

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

export type Created = {
  seller: { id: string; email: string };
  welcome: { email: string; name: string; setPasswordUrl: string | null };
};

// Criação adiada: pagamento confirmado e ainda não há seller para esse customer.
// Lê rv_pending_signups, cria o auth user (sem senha) + o seller (active) e
// devolve os dados do e-mail de boas-vindas (com link para definir a senha).
export async function createAccountFromPending(
  db: SupabaseClient,
  where: { customerId: string } | { email: string }
): Promise<Created | null> {
  // O fluxo pago acha o pending pelo customer do ASAAS; o plano gratuito não
  // tem customer nenhum, então localiza pelo e-mail do cadastro.
  const q = db.from("rv_pending_signups").select("*");
  const { data: pend } = await ("customerId" in where
    ? q.eq("asaas_customer_id", where.customerId)
    : q.eq("email", where.email)
  ).maybeSingle();
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
