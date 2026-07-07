import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/features/auth/AuthProvider";
import {
  useTeam,
  useInviteVendedor,
  useSetVendedorRate,
  useSetVendedorStatus,
  useUpdateVendedor,
  useDeleteVendedor,
} from "../queries";
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
  Spinner,
} from "@/components/ui-light";
import type { Seller } from "@/lib/database.types";

const schema = z.object({
  name: z.string().min(2, "Informe o nome"),
  email: z.string().email("E-mail inválido"),
  commission_rate: z.coerce.number().min(0).max(100),
});
type FormValues = z.infer<typeof schema>;

function InviteForm({ lojaId, onClose }: { lojaId?: string; onClose: () => void }) {
  const invite = useInviteVendedor(lojaId);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { commission_rate: 5 },
  });

  async function onSubmit(values: FormValues) {
    setError(null);
    try {
      await invite.mutateAsync(values);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao convidar o vendedor.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      {error && <Alert variant="error">{error}</Alert>}
      <Field label="Nome" htmlFor="name" error={errors.name?.message}>
        <Input id="name" placeholder="Nome do vendedor" {...register("name")} />
      </Field>
      <Field label="E-mail" htmlFor="email" error={errors.email?.message}>
        <Input id="email" type="email" placeholder="vendedor@email.com" {...register("email")} />
      </Field>
      <Field label="Comissão (%)" htmlFor="rate" error={errors.commission_rate?.message}>
        <Input id="rate" type="number" step="0.01" {...register("commission_rate")} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" type="button" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" loading={invite.isPending}>
          Enviar convite
        </Button>
      </div>
    </form>
  );
}

/* ── Editar dados cadastrais do vendedor ────────────────── */
function EditVendedorModal({ member, lojaId, onClose }: { member: Seller; lojaId?: string; onClose: () => void }) {
  const update = useUpdateVendedor(lojaId);
  const [name, setName] = useState(member.name);
  const [phone, setPhone] = useState(member.phone ?? "");
  const [whatsapp, setWhatsapp] = useState(member.whatsapp ?? "");

  async function save() {
    try {
      await update.mutateAsync({
        id: member.id,
        name: name.trim(),
        phone: phone.trim() || null,
        whatsapp: whatsapp.trim() || null,
      });
      onClose();
    } catch {
      /* erro via update.isError */
    }
  }

  return (
    <Modal open onClose={onClose} title="Editar vendedor" closeOnBackdrop={false}>
      <div className="flex flex-col gap-4">
        <Field label="Nome">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="E-mail">
          <Input value={member.email ?? ""} disabled />
        </Field>
        <Field label="Telefone">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(00) 00000-0000" />
        </Field>
        <Field label="WhatsApp">
          <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="(00) 00000-0000" />
        </Field>
        {update.isError && (
          <Alert variant="error">
            {update.error instanceof Error ? update.error.message : "Erro ao salvar."}
          </Alert>
        )}
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={update.isPending}>
            Cancelar
          </Button>
          <Button onClick={save} loading={update.isPending} disabled={!name.trim()}>
            Salvar
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ── Excluir vendedor ───────────────────────────────────── */
function DeleteVendedorModal({ member, lojaId, onClose }: { member: Seller; lojaId?: string; onClose: () => void }) {
  const del = useDeleteVendedor(lojaId);

  async function confirm() {
    try {
      await del.mutateAsync(member.id);
      onClose();
    } catch {
      /* erro via del.isError */
    }
  }

  return (
    <Modal open onClose={onClose} title="Excluir vendedor">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-slate-600">
          Excluir o vendedor <strong className="text-slate-900">{member.name}</strong>? Essa ação
          não pode ser desfeita. Vendedores com vendas registradas não podem ser excluídos.
        </p>
        {del.isError && (
          <Alert variant="error">
            {del.error instanceof Error ? del.error.message : "Não foi possível excluir."}
          </Alert>
        )}
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={del.isPending}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={confirm} loading={del.isPending}>
            Excluir
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function Equipe() {
  const { lojaId } = useAuth();
  const { data, isLoading } = useTeam(lojaId ?? undefined);
  const setRate = useSetVendedorRate(lojaId ?? undefined);
  const setStatus = useSetVendedorStatus(lojaId ?? undefined);
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState<Seller | null>(null);
  const [deleting, setDeleting] = useState<Seller | null>(null);

  return (
    <div>
      <PageHeader
        title="Vendedores"
        subtitle="Vendedores da sua loja. A comissão de cada venda usa a taxa do vendedor."
        action={<Button onClick={() => setInviting(true)}>Convidar vendedor</Button>}
      />

      {isLoading ? (
        <div className="flex justify-center py-16 text-slate-500">
          <Spinner />
        </div>
      ) : !data || data.length === 0 ? (
        <EmptyState
          title="Nenhum vendedor ainda"
          description="Convide um vendedor para começar a registrar vendas em nome dele."
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Vendedor</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Comissão (%)</th>
                <th className="px-5 py-3 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((v) => (
                <tr key={v.id}>
                  <td className="px-5 py-3">
                    <div className="font-medium text-slate-900">{v.name}</div>
                    <div className="text-xs text-slate-400">{v.email ?? "—"}</div>
                  </td>
                  <td className="px-5 py-3">
                    <Badge tone={v.status === "active" ? "green" : "red"}>
                      {v.status === "active" ? "Ativo" : "Suspenso"}
                    </Badge>
                  </td>
                  <td className="px-5 py-3">
                    <Input
                      type="number"
                      step="0.01"
                      defaultValue={String(v.commission_rate)}
                      className="w-24"
                      onBlur={(e) => {
                        const rate = Number(e.target.value);
                        if (rate !== Number(v.commission_rate))
                          setRate.mutate({ id: v.id, rate });
                      }}
                    />
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex justify-end gap-1.5">
                      <Button
                        variant="outline"
                        className="px-3 py-1 text-xs"
                        onClick={() => setEditing(v)}
                      >
                        Editar
                      </Button>
                      <Button
                        variant="outline"
                        className="px-3 py-1 text-xs"
                        disabled={setStatus.isPending}
                        onClick={() =>
                          setStatus.mutate({
                            id: v.id,
                            status: v.status === "active" ? "suspended" : "active",
                          })
                        }
                      >
                        {v.status === "active" ? "Suspender" : "Reativar"}
                      </Button>
                      <Button
                        variant="danger"
                        className="px-3 py-1 text-xs"
                        onClick={() => setDeleting(v)}
                      >
                        Excluir
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Modal open={inviting} onClose={() => setInviting(false)} title="Convidar vendedor" closeOnBackdrop={false}>
        <InviteForm lojaId={lojaId ?? undefined} onClose={() => setInviting(false)} />
      </Modal>

      {editing && (
        <EditVendedorModal member={editing} lojaId={lojaId ?? undefined} onClose={() => setEditing(null)} />
      )}
      {deleting && (
        <DeleteVendedorModal member={deleting} lojaId={lojaId ?? undefined} onClose={() => setDeleting(null)} />
      )}
    </div>
  );
}
