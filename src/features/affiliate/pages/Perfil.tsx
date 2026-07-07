import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/features/auth/AuthProvider";
import { useUpdateProfile } from "@/features/seller/queries";
import { uploadMedia } from "@/lib/storage";
import { Alert, Button, Card, Field, Input, PageHeader, Spinner } from "@/components/ui-light";

const schema = z.object({
  name: z.string().min(2, "Informe o nome"),
  phone: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export function Perfil() {
  const { seller, lojaId, refreshSeller } = useAuth();
  const update = useUpdateProfile(seller);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: seller?.name ?? "", phone: seller?.phone ?? "" },
  });

  async function onSubmit(values: FormValues) {
    setErr(null);
    setMsg(null);
    try {
      await update.mutateAsync({ name: values.name, phone: values.phone || null });
      await refreshSeller();
      setMsg("Perfil atualizado.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro ao salvar o perfil.");
    }
  }

  async function onAvatar(file?: File) {
    if (!file || !seller || !lojaId) return;
    setErr(null);
    setUploading(true);
    try {
      // O path precisa ficar na pasta da loja: a policy media_insert_own_folder
      // exige (foldername)[1] = current_loja() = coalesce(parent_id, id). Para o
      // afiliado isso é o lojaId (parent_id), não o seu próprio seller.id.
      const url = await uploadMedia("avatars", lojaId, file);
      await update.mutateAsync({ avatar_url: url });
      await refreshSeller();
      setMsg("Foto atualizada.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro ao enviar a foto.");
    } finally {
      setUploading(false);
    }
  }

  if (!seller) {
    return (
      <div className="flex justify-center py-16 text-slate-500">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Meu perfil" subtitle="Seus dados de afiliado" />
      <Card className="flex flex-col gap-4 p-6">
        {msg && <Alert variant="success">{msg}</Alert>}
        {err && <Alert variant="error">{err}</Alert>}

        <div className="flex items-center gap-4">
          <div className="h-16 w-16 overflow-hidden rounded-full bg-slate-100">
            {seller.avatar_url ? (
              <img src={seller.avatar_url} alt={seller.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-xl text-slate-400">
                {seller.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <label className="cursor-pointer text-sm text-emerald-600 hover:underline">
            {uploading ? "Enviando…" : "Trocar foto"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onAvatar(e.target.files?.[0])}
            />
          </label>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <Field label="Nome" htmlFor="name" error={errors.name?.message}>
            <Input id="name" {...register("name")} />
          </Field>
          <Field label="Telefone" htmlFor="phone" error={errors.phone?.message}>
            <Input id="phone" placeholder="(00) 00000-0000" {...register("phone")} />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
