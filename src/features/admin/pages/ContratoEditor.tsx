import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  Select,
  Spinner,
  Textarea,
} from "@/components/ui-light";
import { Icon } from "@/features/public/components/icons";
import { maskCpfCnpj } from "@/lib/masks";
import { formatCurrency } from "@/lib/format";
import { useLeads } from "@/features/leads/queries";
import type { LeadWithVehicle } from "@/features/leads/types";
import type { Seller } from "@/lib/database.types";
import {
  useAdminSellers,
  useAdminVehicles,
  type AdminVehicle,
} from "../queries";
import {
  useContract,
  useCreateContract,
  useUpdateContract,
  useUploadContractPhoto,
  useContractPhotoUrl,
} from "../contracts/queries";
import {
  CONTRACT_TEMPLATES,
  CONTRACT_TYPE_OPTIONS,
  EMPTY_FIELDS,
  PARTY_LABELS,
  COMMISSION_RATE,
  interpolate,
  parseMoney,
  type ContractFields,
  type ContractType,
} from "../contracts/templates";
import { CameraCapture } from "../contracts/CameraCapture";

/** 4160.5 → "4.160,50" (string editável no input de valor) */
function moneyToInput(n: number): string {
  return n
    ? n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "";
}

/** "Cidade/UF" a partir do cadastro da loja (endereço completo se editar depois). */
function sellerAddress(s: Seller): string {
  return [s.city, s.state].filter(Boolean).join("/");
}

export function ContratoEditor() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const navigate = useNavigate();

  const contractQ = useContract(id);
  const createMut = useCreateContract();
  const updateMut = useUpdateContract();
  const uploadMut = useUploadContractPhoto();

  // catálogo do sistema para autopreenchimento
  const vehiclesQ = useAdminVehicles();
  const sellersQ = useAdminSellers();
  const leadsQ = useLeads();

  const [type, setType] = useState<ContractType>("intermediacao");
  const [fields, setFields] = useState<ContractFields>(EMPTY_FIELDS);
  const [template, setTemplate] = useState(CONTRACT_TEMPLATES.intermediacao);
  const [templateDirty, setTemplateDirty] = useState(false);
  const [commissionTouched, setCommissionTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);

  // seleções dos combos de autopreenchimento (só UI; o contrato guarda os textos)
  const [pickVehicle, setPickVehicle] = useState("");
  const [pickSeller, setPickSeller] = useState("");
  const [pickLead, setPickLead] = useState("");

  // hidrata o estado uma única vez quando o contrato carrega (modo edição)
  const hydrated = useRef(false);
  useEffect(() => {
    const c = contractQ.data;
    if (!c || hydrated.current) return;
    hydrated.current = true;
    setType(c.contract_type);
    setFields({
      vendedor_name: c.vendedor_name,
      vendedor_cpf_cnpj: c.vendedor_cpf_cnpj,
      vendedor_address: c.vendedor_address,
      comprador_name: c.comprador_name ?? "",
      comprador_cpf_cnpj: c.comprador_cpf_cnpj ?? "",
      comprador_address: c.comprador_address ?? "",
      vehicle_brand_model: c.vehicle_brand_model,
      vehicle_year_model: c.vehicle_year_model,
      vehicle_plate: c.vehicle_plate,
      vehicle_renavam: c.vehicle_renavam,
      vehicle_chassi: c.vehicle_chassi ?? "",
      sale_value: moneyToInput(Number(c.sale_value)),
      commission_value: moneyToInput(Number(c.commission_value)),
    });
    setTemplate(c.template_content || c.full_text_content);
    setTemplateDirty(true);
    setCommissionTouched(true);
  }, [contractQ.data]);

  const photoUrlQ = useContractPhotoUrl(contractQ.data?.signed_photo_path);

  const partyLabels = PARTY_LABELS[type];
  const issuedAt = useMemo(
    () => (contractQ.data ? new Date(contractQ.data.created_at) : new Date()),
    [contractQ.data]
  );
  const preview = useMemo(
    () => interpolate(template, fields, issuedAt),
    [template, fields, issuedAt]
  );

  /** Mescla campos recalculando a comissão de 4% enquanto não editada à mão. */
  function applyFields(patch: Partial<ContractFields>) {
    setFields((f) => {
      const next = { ...f, ...patch };
      if (
        patch.sale_value !== undefined &&
        !commissionTouched &&
        type === "intermediacao"
      ) {
        next.commission_value = moneyToInput(
          Math.round(parseMoney(patch.sale_value) * COMMISSION_RATE * 100) / 100
        );
      }
      return next;
    });
  }

  function set<K extends keyof ContractFields>(key: K, value: string) {
    applyFields({ [key]: value } as Partial<ContractFields>);
  }

  /* ── Autopreenchimento a partir do sistema ──────────────── */

  function fillFromSeller(s: Seller) {
    applyFields({
      vendedor_name: s.name,
      vendedor_cpf_cnpj: s.cpf_cnpj ? maskCpfCnpj(s.cpf_cnpj) : "",
      vendedor_address: sellerAddress(s),
    });
  }

  function fillFromVehicle(v: AdminVehicle) {
    applyFields({
      vehicle_brand_model: `${v.make} ${v.model}`.trim(),
      vehicle_year_model: v.year ? String(v.year) : "",
      sale_value: moneyToInput(Number(v.price)),
    });
    // a loja dona do veículo entra como vendedora
    const owner = sellersQ.data?.find((s) => s.id === v.seller_id);
    if (owner) {
      fillFromSeller(owner);
      setPickSeller(owner.id);
    }
  }

  function fillFromLead(l: LeadWithVehicle) {
    applyFields({
      comprador_name: l.name,
      comprador_address: l.city ?? "",
    });
    // lead atrelado a um carro puxa também veículo + loja vendedora
    if (l.vehicle_id) {
      const v = vehiclesQ.data?.find((veh) => veh.id === l.vehicle_id);
      if (v) {
        fillFromVehicle(v);
        setPickVehicle(String(v.id));
      }
    }
  }

  function changeType(next: ContractType) {
    if (
      templateDirty &&
      !window.confirm(
        "Trocar o tipo de documento recarrega o modelo padrão e descarta as edições feitas nas cláusulas. Continuar?"
      )
    )
      return;
    setType(next);
    setTemplate(CONTRACT_TEMPLATES[next]);
    setTemplateDirty(false);
  }

  function validate(): string | null {
    if (!fields.vendedor_name.trim()) return "Informe o nome do vendedor.";
    if (!fields.vendedor_cpf_cnpj.trim()) return "Informe o CPF/CNPJ do vendedor.";
    if (partyLabels.comprador) {
      if (!fields.comprador_name.trim())
        return `Informe o nome do ${partyLabels.comprador.toLowerCase()}.`;
      if (!fields.comprador_cpf_cnpj.trim())
        return `Informe o CPF/CNPJ do ${partyLabels.comprador.toLowerCase()}.`;
    }
    if (type !== "procuracao" && parseMoney(fields.sale_value) <= 0)
      return "Informe o valor total da venda.";
    return null;
  }

  async function save() {
    const problem = validate();
    setError(problem);
    if (problem) return;

    // valores financeiros sempre gravados como numérico (relatório contábil)
    const input = {
      contract_type: type,
      vendedor_name: fields.vendedor_name.trim(),
      vendedor_cpf_cnpj: fields.vendedor_cpf_cnpj.trim(),
      vendedor_address: fields.vendedor_address.trim(),
      comprador_name: fields.comprador_name.trim() || null,
      comprador_cpf_cnpj: fields.comprador_cpf_cnpj.trim() || null,
      comprador_address: fields.comprador_address.trim() || null,
      vehicle_brand_model: fields.vehicle_brand_model.trim(),
      vehicle_year_model: fields.vehicle_year_model.trim(),
      vehicle_plate: fields.vehicle_plate.trim().toUpperCase(),
      vehicle_renavam: fields.vehicle_renavam.trim(),
      vehicle_chassi: fields.vehicle_chassi.trim() || null,
      sale_value: parseMoney(fields.sale_value),
      commission_value: parseMoney(fields.commission_value),
      template_content: template,
      full_text_content: preview,
    };

    try {
      if (isNew) {
        const created = await createMut.mutateAsync(input);
        navigate(`/dashboard/contratos/${created.id}`, { replace: true });
      } else {
        await updateMut.mutateAsync({ id: id!, ...input });
      }
      setSavedMsg(true);
      window.setTimeout(() => setSavedMsg(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar o contrato.");
    }
  }

  if (!isNew && contractQ.isLoading) {
    return (
      <div className="flex justify-center py-16 text-slate-500">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }
  if (!isNew && !contractQ.isLoading && !contractQ.data) {
    return <Alert variant="error">Contrato não encontrado.</Alert>;
  }

  const saving = createMut.isPending || updateMut.isPending;
  const vehicles = vehiclesQ.data ?? [];
  const sellers = (sellersQ.data ?? []).filter((s) => s.role !== "admin");
  const leads = leadsQ.data ?? [];

  return (
    <div>
      <PageHeader
        title={isNew ? "Novo contrato" : "Editar contrato"}
        subtitle="Preencha os dados — o documento é montado em tempo real ao lado"
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => navigate("/dashboard/contratos")}>
              Voltar
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Icon name="download" size={16} /> Imprimir / PDF
            </Button>
            <Button loading={saving} onClick={save}>
              <Icon name="check" size={16} /> Salvar e gerar contrato
            </Button>
          </div>
        }
      />

      {error && (
        <div className="mb-4">
          <Alert variant="error">{error}</Alert>
        </div>
      )}
      {savedMsg && (
        <div className="mb-4">
          <Alert variant="success">Contrato salvo com sucesso.</Alert>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        {/* ── Coluna do formulário ─────────────────────────── */}
        <div className="flex flex-col gap-6">
          <Card className="flex flex-col gap-4">
            <p className="text-sm font-bold text-slate-800">
              Preencher com dados do sistema
            </p>
            <p className="-mt-2 text-xs text-slate-400">
              Selecione um veículo, lead ou loja já cadastrados para preencher o
              contrato — depois ajuste apenas o que mudou na negociação.
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Veículo">
                <Select
                  value={pickVehicle}
                  onChange={(e) => {
                    setPickVehicle(e.target.value);
                    const v = vehicles.find((x) => String(x.id) === e.target.value);
                    if (v) fillFromVehicle(v);
                  }}
                >
                  <option value="">Selecionar…</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.make} {v.model}
                      {v.year ? ` (${v.year})` : ""} — {formatCurrency(v.price)}
                      {v.seller?.name ? ` · ${v.seller.name}` : ""}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Lead (comprador)">
                <Select
                  value={pickLead}
                  onChange={(e) => {
                    setPickLead(e.target.value);
                    const l = leads.find((x) => x.id === e.target.value);
                    if (l) fillFromLead(l);
                  }}
                >
                  <option value="">Selecionar…</option>
                  {leads.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                      {l.vehicle ? ` — ${l.vehicle.make} ${l.vehicle.model}` : ""}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Loja / vendedor">
                <Select
                  value={pickSeller}
                  onChange={(e) => {
                    setPickSeller(e.target.value);
                    const s = sellers.find((x) => x.id === e.target.value);
                    if (s) fillFromSeller(s);
                  }}
                >
                  <option value="">Selecionar…</option>
                  {sellers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.city ? ` · ${s.city}` : ""}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </Card>

          <Card className="flex flex-col gap-4">
            <Field label="Tipo de documento">
              <Select
                value={type}
                onChange={(e) => changeType(e.target.value as ContractType)}
              >
                {CONTRACT_TYPE_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>

            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
              {partyLabels.vendedor}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome completo">
                <Input
                  value={fields.vendedor_name}
                  onChange={(e) => set("vendedor_name", e.target.value)}
                />
              </Field>
              <Field label="CPF/CNPJ">
                <Input
                  value={fields.vendedor_cpf_cnpj}
                  onChange={(e) => set("vendedor_cpf_cnpj", maskCpfCnpj(e.target.value))}
                />
              </Field>
            </div>
            <Field label="Endereço">
              <Input
                value={fields.vendedor_address}
                onChange={(e) => set("vendedor_address", e.target.value)}
              />
            </Field>

            {partyLabels.comprador && (
              <>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  {partyLabels.comprador}
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Nome completo">
                    <Input
                      value={fields.comprador_name}
                      onChange={(e) => set("comprador_name", e.target.value)}
                    />
                  </Field>
                  <Field label="CPF/CNPJ">
                    <Input
                      value={fields.comprador_cpf_cnpj}
                      onChange={(e) =>
                        set("comprador_cpf_cnpj", maskCpfCnpj(e.target.value))
                      }
                    />
                  </Field>
                </div>
                <Field label="Endereço">
                  <Input
                    value={fields.comprador_address}
                    onChange={(e) => set("comprador_address", e.target.value)}
                  />
                </Field>
              </>
            )}

            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Veículo
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Marca/Modelo">
                <Input
                  value={fields.vehicle_brand_model}
                  onChange={(e) => set("vehicle_brand_model", e.target.value)}
                />
              </Field>
              <Field label="Ano/Modelo">
                <Input
                  value={fields.vehicle_year_model}
                  onChange={(e) => set("vehicle_year_model", e.target.value)}
                />
              </Field>
              <Field label="Placa">
                <Input
                  value={fields.vehicle_plate}
                  onChange={(e) => set("vehicle_plate", e.target.value.toUpperCase())}
                />
              </Field>
              <Field label="RENAVAM">
                <Input
                  value={fields.vehicle_renavam}
                  onChange={(e) => set("vehicle_renavam", e.target.value)}
                />
              </Field>
              <Field label="Chassi (opcional)">
                <Input
                  value={fields.vehicle_chassi}
                  onChange={(e) => set("vehicle_chassi", e.target.value.toUpperCase())}
                />
              </Field>
            </div>

            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Valores (relatório contábil)
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Valor total da venda (R$)">
                <Input
                  inputMode="decimal"
                  placeholder="0,00"
                  value={fields.sale_value}
                  onChange={(e) => set("sale_value", e.target.value)}
                />
              </Field>
              <Field
                label="Comissão retida (R$)"
                hint={
                  type === "intermediacao" && !commissionTouched
                    ? "Calculada automaticamente: 4% da venda"
                    : undefined
                }
              >
                <Input
                  inputMode="decimal"
                  placeholder="0,00"
                  value={fields.commission_value}
                  onChange={(e) => {
                    setCommissionTouched(true);
                    set("commission_value", e.target.value);
                  }}
                />
              </Field>
            </div>
          </Card>

          <Card className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-slate-800">Editor de cláusulas</p>
              <Button
                variant="ghost"
                onClick={() => {
                  if (
                    window.confirm(
                      "Restaurar o modelo padrão descarta todas as edições. Continuar?"
                    )
                  ) {
                    setTemplate(CONTRACT_TEMPLATES[type]);
                    setTemplateDirty(false);
                  }
                }}
              >
                Restaurar modelo padrão
              </Button>
            </div>
            <p className="text-xs text-slate-400">
              Edite qualquer parágrafo ou acrescente cláusulas. As tags entre
              colchetes (ex.: [vendedor_name], [vehicle_plate], [sale_value]) são
              substituídas pelos campos do formulário na prévia ao lado.
            </p>
            <Textarea
              rows={22}
              className="font-mono text-[13px] leading-relaxed"
              value={template}
              onChange={(e) => {
                setTemplate(e.target.value);
                setTemplateDirty(true);
              }}
            />
          </Card>

          {/* ── Foto do contrato assinado (só câmera) ──────── */}
          {!isNew && (
            <Card className="flex flex-col gap-3">
              <p className="text-sm font-bold text-slate-800">
                Contrato assinado (captura por câmera)
              </p>
              <p className="text-xs text-slate-400">
                Por segurança, a imagem do documento assinado só pode ser
                registrada fotografando em tempo real — não há upload de
                arquivos da galeria.
              </p>
              {photoUrlQ.data && (
                <img
                  src={photoUrlQ.data}
                  alt="Contrato assinado"
                  className="max-h-72 w-fit rounded-lg border border-hair object-contain"
                />
              )}
              <div>
                <Button variant="outline" onClick={() => setCameraOpen(true)}>
                  <Icon name="camera" size={16} />
                  {contractQ.data?.signed_photo_path
                    ? "Fotografar novamente"
                    : "Fotografar contrato assinado"}
                </Button>
              </div>
            </Card>
          )}
        </div>

        {/* ── Prévia (tela) ────────────────────────────────── */}
        <div>
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
            Prévia do documento
          </div>
          <div className="rounded-2xl border border-hair bg-white p-10 shadow-[0_1px_2px_rgba(16,24,40,.04)]">
            <div className="whitespace-pre-wrap font-serif text-[13.5px] leading-[1.7] text-slate-900">
              {preview}
            </div>
          </div>
        </div>
      </div>

      {/* Folha de impressão: portal direto no <body>, fora do layout do painel
          (que tem scroll/sticky e cortava a folha, saindo tudo em branco). */}
      {createPortal(
        <div
          id="contract-print-sheet"
          className="hidden whitespace-pre-wrap font-serif text-[13pt] leading-[1.7] text-black print:block"
        >
          {preview}
        </div>,
        document.body
      )}

      <CameraCapture
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        uploading={uploadMut.isPending}
        onCapture={async (blob) => {
          try {
            await uploadMut.mutateAsync({
              contractId: id!,
              blob,
              previousPath: contractQ.data?.signed_photo_path ?? null,
            });
            setCameraOpen(false);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Erro ao enviar a foto.");
            setCameraOpen(false);
          }
        }}
      />
    </div>
  );
}
