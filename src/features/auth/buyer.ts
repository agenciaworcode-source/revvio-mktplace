import { supabase } from "@/lib/supabase";
import type { Buyer } from "@/lib/database.types";

export async function fetchBuyer(userId: string): Promise<Buyer | null> {
  const { data, error } = await supabase
    .from("rv_buyers")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    console.error("Erro ao carregar comprador:", error.message);
    return null;
  }
  return (data as Buyer) ?? null;
}

export async function signUpBuyer(input: {
  name: string;
  email: string;
  phone: string;
  city: string;
  password: string;
}): Promise<void> {
  // NÃO enviar `name` em user_metadata: ensureSeller() criaria um vendedor.
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
  });
  if (error) throw error;
  const userId = data.user?.id;
  if (!userId) throw new Error("Não foi possível criar a conta.");
  const { error: insErr } = await supabase.from("rv_buyers").insert({
    id: userId,
    name: input.name.trim(),
    phone: input.phone || null,
    city: input.city.trim() || null,
    email: input.email.trim(),
  });
  if (insErr) throw insErr;
}

export async function updateBuyerProfile(
  id: string,
  fields: { name: string; phone: string; city: string }
): Promise<void> {
  const { error } = await supabase
    .from("rv_buyers")
    .update({
      name: fields.name.trim(),
      phone: fields.phone || null,
      city: fields.city.trim() || null,
    })
    .eq("id", id);
  if (error) throw error;
}
