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

/** E-mail já pertence a uma conta — o chamador deve oferecer o login. */
export class BuyerEmailInUseError extends Error {
  constructor() {
    super("Este e-mail já tem conta.");
    this.name = "BuyerEmailInUseError";
  }
}

export type BuyerSignUpResult =
  | { status: "signed-in"; buyer: Buyer }
  /** Projeto com "Confirm email" ligado: só dá para entrar após confirmar. */
  | { status: "needs-email-confirmation" };

/**
 * Cria a conta do comprador e **já deixa a sessão ativa**, para ele seguir
 * direto do cadastro para o WhatsApp sem passar por uma tela de login.
 *
 * Quando o projeto tem "Confirm email" ligado, o `signUp` não devolve sessão;
 * tentamos entrar na hora com as mesmas credenciais. Isso também é o que faz o
 * insert em `rv_buyers` passar pela RLS (`id = auth.uid()` exige sessão).
 */
export async function signUpBuyer(input: {
  name: string;
  email: string;
  phone: string;
  city: string;
  password: string;
}): Promise<BuyerSignUpResult> {
  const email = input.email.trim();

  // NÃO enviar `name` em user_metadata: ensureSeller() criaria um vendedor.
  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.password,
  });
  if (error) {
    if (/already registered|user already/i.test(error.message)) {
      throw new BuyerEmailInUseError();
    }
    throw error;
  }

  // Com confirmação de e-mail ligada o Supabase não erra em e-mail repetido:
  // devolve um usuário sem `identities` para não revelar quem já é cadastrado.
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    throw new BuyerEmailInUseError();
  }

  let session = data.session;
  if (!session) {
    const { data: signedIn, error: signInError } =
      await supabase.auth.signInWithPassword({ email, password: input.password });
    if (signInError) {
      if (/not confirmed/i.test(signInError.message)) {
        return { status: "needs-email-confirmation" };
      }
      throw signInError;
    }
    session = signedIn.session;
  }

  const userId = session?.user.id;
  if (!userId) throw new Error("Não foi possível criar a conta.");

  // upsert: uma tentativa anterior pode ter criado o usuário de auth sem
  // conseguir gravar o perfil (ex.: falha de rede) — reenviar não deve quebrar.
  const { data: row, error: upsertError } = await supabase
    .from("rv_buyers")
    .upsert(
      {
        id: userId,
        name: input.name.trim(),
        phone: input.phone || null,
        city: input.city.trim() || null,
        email,
      },
      { onConflict: "id" }
    )
    .select()
    .single();
  if (upsertError) throw upsertError;

  return { status: "signed-in", buyer: row as Buyer };
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
