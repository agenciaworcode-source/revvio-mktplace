// Cliente mínimo da API do Resend (https://resend.com/docs).
// Chave no secret RESEND_API_KEY; remetente em RESEND_FROM.

const FROM = Deno.env.get("RESEND_FROM") ?? "REVVIO <no-reply@revvio.com.br>";

export async function sendEmail(input: {
  to: string | string[];
  subject: string;
  html: string;
}): Promise<{ id: string }> {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) throw new Error("RESEND_API_KEY não configurada.");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, ...input }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Resend ${res.status}: ${detail}`);
  }
  return res.json();
}
