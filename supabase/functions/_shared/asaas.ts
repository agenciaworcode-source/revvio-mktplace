// Cliente mínimo da API do ASAAS (https://docs.asaas.com).
// A chave vem do secret ASAAS_API_KEY; ASAAS_ENV define sandbox|production.

// Sem default: um ASAAS_ENV ausente ou com typo cairia no sandbox em silêncio,
// e as cobranças reais nunca existiriam. Falha alto, na subida da function.
const BASE_BY_ENV: Record<string, string> = {
  production: "https://api.asaas.com/v3",
  sandbox: "https://sandbox.asaas.com/api/v3",
};
const ENV = Deno.env.get("ASAAS_ENV") ?? "";
const BASE = BASE_BY_ENV[ENV];
if (!BASE)
  throw new Error(
    `ASAAS_ENV inválida: "${ENV}". Use "sandbox" ou "production".`
  );

function apiKey(): string {
  const key = Deno.env.get("ASAAS_API_KEY");
  if (!key) throw new Error("ASAAS_API_KEY não configurada no projeto.");
  return key;
}

async function asaasFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      access_token: apiKey(),
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (data?.errors?.[0]?.description as string) ??
      `ASAAS ${res.status}: ${res.statusText}`;
    throw new Error(msg);
  }
  return data as T;
}

export interface AsaasCustomer {
  id: string;
  name: string;
}

export function createCustomer(input: {
  name: string;
  cpfCnpj: string;
  email?: string | null;
  mobilePhone?: string | null;
}): Promise<AsaasCustomer> {
  return asaasFetch<AsaasCustomer>("/customers", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface AsaasSubscription {
  id: string;
}

export function createSubscription(input: {
  customer: string;
  billingType: string;
  value: number;
  nextDueDate: string;
  cycle: string; // MONTHLY
  description?: string;
  callback?: { successUrl: string; autoRedirect?: boolean };
}): Promise<AsaasSubscription> {
  return asaasFetch<AsaasSubscription>("/subscriptions", {
    method: "POST",
    body: JSON.stringify({ cycle: "MONTHLY", ...input }),
  });
}

export function cancelSubscription(id: string): Promise<unknown> {
  return asaasFetch(`/subscriptions/${id}`, { method: "DELETE" });
}

export interface AsaasPayment {
  id: string;
  status: string;
  value: number;
  dueDate: string;
  billingType: string;
  invoiceUrl?: string;
}

export function createPayment(input: {
  customer: string;
  billingType: string;
  value: number;
  dueDate: string;
  description?: string;
}): Promise<AsaasPayment> {
  return asaasFetch<AsaasPayment>("/payments", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getSubscriptionPayments(subId: string): Promise<AsaasPayment[]> {
  const res = await asaasFetch<{ data: AsaasPayment[] }>(`/subscriptions/${subId}/payments`);
  return res.data ?? [];
}

/** Primeiro pagamento da assinatura (menor dueDate) — para pegar o invoiceUrl. */
export async function getSubscriptionFirstPayment(
  subId: string
): Promise<AsaasPayment | null> {
  const payments = await getSubscriptionPayments(subId);
  if (!payments.length) return null;
  return payments
    .slice()
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))[0];
}
