import { supabase } from "@/lib/supabase";
import { randomSuffix, slugify } from "@/lib/slug";

export interface SellerProfileInput {
  userId: string;
  name: string;
  email: string;
  phone?: string | null;
  cpf_cnpj?: string | null;
  city?: string | null;
  pricing_plan_key?: string | null;
  plan_cycle?: "monthly" | "annual" | null;
}

/**
 * Cria a linha em rv_sellers para o usuário logado.
 * status=pending e role=seller vêm dos defaults do schema (RLS bloqueia override).
 * Trata colisão de slug (coluna UNIQUE) tentando sufixos aleatórios.
 */
export async function createSellerProfile(input: SellerProfileInput) {
  const base = slugify(input.name) || "vendedor";

  // Idempotente: se o perfil já existe (ex.: corrida entre o cadastro e o
  // AuthProvider, ou re-login), apenas retorna o slug existente.
  const existing = await supabase
    .from("rv_sellers")
    .select("slug")
    .eq("user_id", input.userId)
    .maybeSingle();
  if (existing.data) return { slug: existing.data.slug };

  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${randomSuffix()}`;
    const { error } = await supabase.from("rv_sellers").insert({
      user_id: input.userId,
      name: input.name,
      slug,
      email: input.email,
      phone: input.phone ?? null,
      cpf_cnpj: input.cpf_cnpj ?? null,
      city: input.city ?? null,
      pricing_plan_key: input.pricing_plan_key ?? null,
      plan_cycle: input.plan_cycle ?? null,
    });

    if (!error) return { slug };

    const isUnique = error.code === "23505" || /duplicate key/i.test(error.message);
    // colisão de slug → tenta outro sufixo
    if (isUnique && /slug/i.test(error.message)) continue;
    // colisão de user_id → o perfil já foi criado em paralelo; busca e retorna
    if (isUnique) {
      const again = await supabase
        .from("rv_sellers")
        .select("slug")
        .eq("user_id", input.userId)
        .maybeSingle();
      if (again.data) return { slug: again.data.slug };
    }

    throw error;
  }

  throw new Error("Não foi possível gerar um endereço único para a mini-loja.");
}
