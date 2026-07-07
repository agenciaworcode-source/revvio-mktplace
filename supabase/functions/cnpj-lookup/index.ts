import { corsHeaders, json } from "../_shared/cors.ts";
import { lookupCnpj, validateCnpj } from "../_shared/cnpj.ts";

// Consulta pública de CNPJ (sem JWT) usada pelo cadastro do garagista para
// auto-preencher nome/cidade e barrar empresas inativas ou fora do ramo.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const digits = String(body.cnpj ?? "").replace(/\D/g, "");
    if (digits.length !== 14) return json({ ok: false, error: "CNPJ inválido." });

    const result = await lookupCnpj(digits);
    if (result.status === "unavailable")
      return json({ ok: false, error: "Não foi possível consultar o CNPJ agora. Tente novamente." });
    if (result.status === "not_found")
      return json({ ok: false, error: "CNPJ não encontrado na Receita." });

    const v = validateCnpj(result.data);
    if (!v.ok) {
      const error =
        v.reason === "inactive"
          ? `Este CNPJ está ${v.situacao}. Apenas empresas ativas podem se cadastrar.`
          : "A atividade da empresa não é elegível. O cadastro é exclusivo para lojas do ramo automotivo.";
      return json({ ok: false, error });
    }

    return json({
      ok: true,
      name: v.name,
      city: v.city,
      razaoSocial: result.data.razao_social ?? "",
      fantasia: result.data.nome_fantasia ?? "",
      municipio: result.data.municipio ?? "",
      uf: result.data.uf ?? "",
    });
  } catch {
    return json({ ok: false, error: "Não foi possível consultar o CNPJ agora. Tente novamente." });
  }
});
