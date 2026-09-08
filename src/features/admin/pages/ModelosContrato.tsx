// ============================================================
// Modelos de contrato (Super Admin).
//
// Catálogo dos modelos padrão que aparecem no editor de contratos. É aqui que
// o superadmin acrescenta um modelo novo, tira um de circulação e decide quem
// pode emiti-lo: só a Revvio, só as lojas (garagistas) ou os dois.
//
// A natureza do documento continua vindo do enum do banco — é ela que manda
// nos rótulos das partes, na validação do formulário, no cálculo da comissão
// e na diagramação da folha. Vários modelos podem dividir a mesma natureza
// (dois textos diferentes de compra e venda, por exemplo).
// ============================================================

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Spinner,
  Textarea,
} from "@/components/ui-light";
import { Icon } from "@/features/public/components/icons";
import {
  AUDIENCE_LABEL,
  AUDIENCE_OPTIONS,
  useAdminContractModels,
  useDeleteContractModel,
  useSaveContractModel,
  type ContractAudience,
  type ContractModel,
} from "@/features/contracts/models";
import {
  CONTRACT_TAGS,
  CONTRACT_TYPE_LABEL,
  CONTRACT_TYPE_OPTIONS,
  type ContractType,
} from "@/features/contracts/templates";

interface Draft {
  id?: string;
  name: string;
  contractType: ContractType;
  audience: ContractAudience;
  body: string;
  active: boolean;
  sortOrder: number;
}

const AUDIENCE_TONE: Record<ContractAudience, "sky" | "green" | "neutral"> = {
  admin: "sky",
  garagista: "green",
  ambos: "neutral",
};

function novoDraft(sortOrder: number): Draft {
  return {
    name: "",
    contractType: "compra_venda",
    audience: "garagista",
    body: "",
    active: true,
    sortOrder,
  };
}

function draftDe(m: ContractModel): Draft {
  return {
    id: m.id,
    name: m.name,
    contractType: m.contractType,
    audience: m.audience,
    body: m.body,
    active: m.active,
    sortOrder: m.sortOrder,
  };
}

export function ModelosContrato() {
  const navigate = useNavigate();
  const modelsQ = useAdminContractModels();
  const saveMut = useSaveContractModel();
  const deleteMut = useDeleteContractModel();

  const [draft, setDraft] = useState<Draft | null>(null);
  // Enquanto o texto for uma sugestão do sistema, trocar a natureza recarrega
  // a sugestão. Depois que o admin escreve, ninguém mexe no que ele digitou.
  const [bodyTouched, setBodyTouched] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState<ContractModel | null>(null);

  const models = modelsQ.data ?? [];
  // Loja sem nenhum modelo ativo não consegue emitir contrato — o editor dela
  // abre em branco. Vale avisar antes de o garagista descobrir na hora do uso.
  const semModeloParaLojas = !models.some(
    (m) => m.active && (m.audience === "garagista" || m.audience === "ambos")
  );

  /** Texto de partida ao criar: o modelo já publicado daquela natureza. */
  function sugestaoDeTexto(t: ContractType): string {
    return models.find((m) => m.contractType === t)?.body ?? "";
  }

  function abrirNovo() {
    const proximo = (models.at(-1)?.sortOrder ?? 0) + 10;
    const d = novoDraft(proximo);
    setDraft({ ...d, body: sugestaoDeTexto(d.contractType) });
    setBodyTouched(false);
    setErro(null);
  }

  function abrirEdicao(m: ContractModel) {
    setDraft(draftDe(m));
    setBodyTouched(true);
    setErro(null);
  }

  function mudarNatureza(t: ContractType) {
    setDraft((d) =>
      d ? { ...d, contractType: t, body: bodyTouched ? d.body : sugestaoDeTexto(t) } : d
    );
  }

  async function salvar() {
    if (!draft) return;
    if (!draft.name.trim()) return setErro("Dê um nome ao modelo.");
    if (!draft.body.trim()) return setErro("Escreva o texto do modelo.");
    setErro(null);
    try {
      await saveMut.mutateAsync({
        id: draft.id,
        name: draft.name.trim(),
        contractType: draft.contractType,
        audience: draft.audience,
        body: draft.body,
        active: draft.active,
        sortOrder: draft.sortOrder,
      });
      setDraft(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar o modelo.");
    }
  }

  /** Liga/desliga sem abrir o formulário — é a ação mais frequente da tela. */
  async function alternarSituacao(m: ContractModel) {
    await saveMut.mutateAsync({
      id: m.id,
      name: m.name,
      contractType: m.contractType,
      audience: m.audience,
      body: m.body,
      active: !m.active,
      sortOrder: m.sortOrder,
    });
  }

  async function confirmarExclusao() {
    if (!excluindo) return;
    await deleteMut.mutateAsync(excluindo.id);
    setExcluindo(null);
  }

  return (
    <div>
      <PageHeader
        title="Modelos de contrato"
        subtitle="Modelos padrão oferecidos no editor — da Revvio e das lojas"
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => navigate("/dashboard/contratos")}>
              Voltar
            </Button>
            <Button onClick={abrirNovo}>
              <Icon name="plus" size={17} /> Novo modelo
            </Button>
          </div>
        }
      />

      {semModeloParaLojas && (
        <div className="mb-4">
          <Alert variant="warning">
            Nenhum modelo ativo está liberado para as lojas. Com o catálogo
            assim, o editor de contratos do garagista abre em branco.
          </Alert>
        </div>
      )}

      {modelsQ.isError && (
        <div className="mb-4">
          <Alert variant="error">
            Não foi possível carregar o catálogo de modelos.
          </Alert>
        </div>
      )}

      {modelsQ.isLoading ? (
        <div className="flex justify-center py-12 text-slate-500">
          <Spinner className="h-6 w-6" />
        </div>
      ) : !models.length ? (
        <EmptyState
          title="Nenhum modelo cadastrado"
          description="Publique o primeiro modelo para que os contratos deixem de abrir em branco."
          action={
            <Button onClick={abrirNovo}>
              <Icon name="plus" size={17} /> Novo modelo
            </Button>
          }
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-hair text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3.5">Modelo</th>
                <th className="px-5 py-3.5">Natureza</th>
                <th className="px-5 py-3.5">Disponível para</th>
                <th className="px-5 py-3.5">Situação</th>
                <th className="px-5 py-3.5" />
              </tr>
            </thead>
            <tbody>
              {models.map((m) => (
                <tr
                  key={m.id}
                  className="border-b border-hair last:border-0 hover:bg-slate-50"
                >
                  <td className="px-5 py-3">
                    <button
                      type="button"
                      onClick={() => abrirEdicao(m)}
                      className="text-left font-semibold text-slate-800 hover:text-brand"
                    >
                      {m.name}
                    </button>
                    <p className="text-xs text-slate-400">
                      {m.slug ? "Modelo original da plataforma" : "Criado no painel"}
                    </p>
                  </td>
                  <td className="px-5 py-3 text-slate-500">
                    {CONTRACT_TYPE_LABEL[m.contractType]}
                  </td>
                  <td className="px-5 py-3">
                    <Badge tone={AUDIENCE_TONE[m.audience]}>
                      {AUDIENCE_LABEL[m.audience]}
                    </Badge>
                  </td>
                  <td className="px-5 py-3">
                    <Badge tone={m.active ? "green" : "neutral"}>
                      {m.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        title={m.active ? "Desativar" : "Ativar"}
                        onClick={() => alternarSituacao(m)}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      >
                        <Icon name={m.active ? "eyeOff" : "eye"} size={16} />
                      </button>
                      <button
                        type="button"
                        title="Editar"
                        onClick={() => abrirEdicao(m)}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      >
                        <Icon name="edit" size={16} />
                      </button>
                      <button
                        type="button"
                        title="Excluir"
                        onClick={() => setExcluindo(m)}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Icon name="trash" size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* ── Formulário do modelo ───────────────────────────── */}
      <Modal
        open={!!draft}
        onClose={() => setDraft(null)}
        closeOnBackdrop={false}
        wide
        title={draft?.id ? "Editar modelo" : "Novo modelo"}
      >
        {draft && (
          <div className="flex flex-col gap-4">
            {erro && <Alert variant="error">{erro}</Alert>}

            <Field label="Nome do modelo" hint="É o que aparece no seletor do editor.">
              <Input
                value={draft.name}
                placeholder="Ex.: Contrato de Compra e Venda com Entrada"
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field
                label="Natureza do documento"
                hint="Define partes, campos obrigatórios e comissão."
              >
                <Select
                  value={draft.contractType}
                  onChange={(e) => mudarNatureza(e.target.value as ContractType)}
                >
                  {CONTRACT_TYPE_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {CONTRACT_TYPE_LABEL[t.value]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Disponível para">
                <Select
                  value={draft.audience}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      audience: e.target.value as ContractAudience,
                    })
                  }
                >
                  {AUDIENCE_OPTIONS.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Ordem no seletor">
                <Input
                  type="number"
                  value={draft.sortOrder}
                  onChange={(e) =>
                    setDraft({ ...draft, sortOrder: Number(e.target.value) || 0 })
                  }
                />
              </Field>
            </div>

            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
                className="h-4 w-4 rounded border-stroke text-brand focus:ring-brand"
              />
              Ativo (aparece no editor de contratos)
            </label>

            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold text-slate-700">Texto do modelo</p>
              <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-xs leading-relaxed text-slate-500">
                As tags entre colchetes são substituídas pelos dados preenchidos
                no contrato:{" "}
                <code className="font-mono text-slate-700">
                  {CONTRACT_TAGS.map((t) => `[${t}]`).join(" ")}
                </code>
              </p>
              <Textarea
                rows={18}
                className="font-mono text-[13px] leading-relaxed"
                value={draft.body}
                onChange={(e) => {
                  setBodyTouched(true);
                  setDraft({ ...draft, body: e.target.value });
                }}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDraft(null)}>
                Cancelar
              </Button>
              <Button loading={saveMut.isPending} onClick={salvar}>
                <Icon name="check" size={16} /> Salvar modelo
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Exclusão ───────────────────────────────────────── */}
      <Modal
        open={!!excluindo}
        onClose={() => setExcluindo(null)}
        title="Excluir modelo"
      >
        <p className="text-sm text-slate-600">
          Excluir o modelo <strong>{excluindo?.name}</strong>? Ele some do
          seletor de quem emite contrato. Os contratos já emitidos com ele não
          mudam — cada um guarda o próprio texto.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setExcluindo(null)}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            loading={deleteMut.isPending}
            onClick={confirmarExclusao}
          >
            Excluir
          </Button>
        </div>
      </Modal>
    </div>
  );
}
