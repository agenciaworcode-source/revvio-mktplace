import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/features/auth/AuthProvider";
import { useUpdateProfile } from "../queries";
import { uploadMedia, type MediaBucket } from "@/lib/storage";
import { ImageCropModal } from "@/components/ImageCropModal";
import { maskPhone } from "@/lib/masks";
import { UFS, fetchCidades } from "@/lib/ibge";

/** Especificações de recorte/saída por tipo de imagem da mini-loja. */
const IMAGE_SPECS = {
  banner: {
    bucket: "banners" as MediaBucket,
    title: "Ajustar banner",
    // mesma proporção da faixa exibida na mini-loja (1180 × 230 ≈ 5,13:1)
    aspect: 1180 / 230,
    outWidth: 1600,
    outHeight: 312,
    cropShape: "rect" as const,
    mime: "image/jpeg" as const,
    hint: "Banner recomendado: 1600 × 312 px (paisagem, ~5:1) · JPG, PNG ou WebP · até ~5 MB.",
  },
  avatar: {
    bucket: "avatars" as MediaBucket,
    title: "Ajustar avatar",
    aspect: 1,
    outWidth: 400,
    outHeight: 400,
    cropShape: "round" as const,
    mime: "image/png" as const,
    hint: "Avatar recomendado: 400 × 400 px (quadrada) · JPG, PNG ou WebP.",
  },
} as const;
type ImageField = keyof typeof IMAGE_SPECS;
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

const BIO_MAX = 600;

const schema = z.object({
  name: z.string().min(2, "Informe o nome / loja"),
  bio: z.string().max(BIO_MAX).optional(),
  city: z.string().optional(),
  state: z.string().max(2, "Use a sigla (ex: SP)").optional(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  instagram: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export function Profile() {
  const { seller, refreshSeller } = useAuth();
  const update = useUpdateProfile(seller);
  const [feedback, setFeedback] = useState<
    { type: "success" | "error"; msg: string } | null
  >(null);
  const [uploadingField, setUploadingField] = useState<"avatar" | "banner" | null>(null);
  const [cropField, setCropField] = useState<ImageField | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);

  function selectImage(field: ImageField, file?: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setFeedback({ type: "error", msg: "Selecione um arquivo de imagem." });
      return;
    }
    setFeedback(null);
    setCropField(field);
    setCropFile(file);
  }

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: seller?.name ?? "",
      bio: seller?.bio ?? "",
      city: seller?.city ?? "",
      state: seller?.state ?? "",
      phone: seller?.phone ? maskPhone(seller.phone) : "",
      whatsapp: seller?.whatsapp ? maskPhone(seller.whatsapp) : "",
      instagram: seller?.instagram ?? "",
    },
  });

  const uf = watch("state");
  const bioLen = (watch("bio") ?? "").length;
  const [cidades, setCidades] = useState<string[]>([]);
  const [loadingCidades, setLoadingCidades] = useState(false);

  // Carrega as cidades da UF selecionada (IBGE). Roda na carga inicial (com a
  // UF salva) e sempre que a UF muda.
  useEffect(() => {
    if (!uf) {
      setCidades([]);
      return;
    }
    let active = true;
    setLoadingCidades(true);
    fetchCidades(uf)
      .then((list) => {
        if (active) setCidades(list);
      })
      .catch(() => {
        if (active) setCidades([]);
      })
      .finally(() => {
        if (active) setLoadingCidades(false);
      });
    return () => {
      active = false;
    };
  }, [uf]);

  // Garante que a cidade já salva apareça como opção mesmo antes/depois do fetch.
  const savedCity = seller?.city ?? "";
  const cidadeOptions =
    savedCity && !cidades.includes(savedCity) ? [savedCity, ...cidades] : cidades;

  if (!seller) {
    return (
      <div className="flex justify-center py-16 text-slate-500">
        <Spinner />
      </div>
    );
  }

  async function onSubmit(values: FormValues) {
    setFeedback(null);
    try {
      await update.mutateAsync({
        name: values.name,
        bio: values.bio || null,
        city: values.city || null,
        state: values.state || null,
        phone: values.phone || null,
        whatsapp: values.whatsapp || null,
        instagram: values.instagram || null,
      });
      await refreshSeller();
      setFeedback({ type: "success", msg: "Perfil atualizado com sucesso." });
    } catch (e) {
      setFeedback({
        type: "error",
        msg: e instanceof Error ? e.message : "Erro ao salvar o perfil.",
      });
    }
  }

  async function handleImage(
    field: "avatar" | "banner",
    bucket: MediaBucket,
    file?: File
  ) {
    if (!file || !seller) return;
    setUploadingField(field);
    setFeedback(null);
    try {
      const url = await uploadMedia(bucket, seller.id, file);
      await update.mutateAsync(
        field === "avatar" ? { avatar_url: url } : { banner_url: url }
      );
      await refreshSeller();
      setFeedback({ type: "success", msg: "Imagem atualizada." });
    } catch (e) {
      setFeedback({
        type: "error",
        msg: e instanceof Error ? e.message : "Falha no upload.",
      });
    } finally {
      setUploadingField(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Perfil / Mini-Loja"
        subtitle="Estes dados aparecem na sua página pública."
        action={
          <a href={`/loja/${seller.slug}`} target="_blank" rel="noreferrer">
            <Button variant="outline">Ver mini-loja ↗</Button>
          </a>
        }
      />

      {feedback && (
        <div className="mb-4">
          <Alert variant={feedback.type}>{feedback.msg}</Alert>
        </div>
      )}

      {/* Banner + avatar */}
      <Card className="mb-6 p-0">
        <div className="relative h-40 overflow-hidden rounded-t-2xl bg-slate-100">
          {seller.banner_url && (
            <img src={seller.banner_url} alt="" className="h-full w-full object-cover" />
          )}
          <label className="absolute right-3 top-3 cursor-pointer rounded-lg bg-black/70 px-3 py-1.5 text-xs font-medium text-white hover:bg-black">
            {uploadingField === "banner" ? "Enviando…" : "Trocar banner"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                selectImage("banner", e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        <div className="flex items-center gap-4 p-5">
          <div className="relative -mt-12 h-20 w-20 shrink-0 overflow-hidden rounded-full border-4 border-slate-900 bg-slate-700">
            {seller.avatar_url ? (
              <img
                src={seller.avatar_url}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-2xl font-bold text-slate-400">
                {seller.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <label className="cursor-pointer text-sm font-medium text-brand hover:underline">
              {uploadingField === "avatar" ? "Enviando…" : "Trocar avatar"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  selectImage("avatar", e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
            <p className="text-xs text-slate-400">
              Banner {IMAGE_SPECS.banner.outWidth}×{IMAGE_SPECS.banner.outHeight}px · Avatar{" "}
              {IMAGE_SPECS.avatar.outWidth}×{IMAGE_SPECS.avatar.outHeight}px · JPG, PNG ou WebP
            </p>
          </div>
        </div>
      </Card>

      {cropField && cropFile && (
        <ImageCropModal
          file={cropFile}
          title={IMAGE_SPECS[cropField].title}
          aspect={IMAGE_SPECS[cropField].aspect}
          outWidth={IMAGE_SPECS[cropField].outWidth}
          outHeight={IMAGE_SPECS[cropField].outHeight}
          cropShape={IMAGE_SPECS[cropField].cropShape}
          mime={IMAGE_SPECS[cropField].mime}
          hint={IMAGE_SPECS[cropField].hint}
          onCancel={() => {
            setCropField(null);
            setCropFile(null);
          }}
          onComplete={(out) => {
            const field = cropField;
            setCropField(null);
            setCropFile(null);
            void handleImage(field, IMAGE_SPECS[field].bucket, out);
          }}
        />
      )}

      <Card>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <Field label="Nome / Loja" error={errors.name?.message}>
            <Input {...register("name")} />
          </Field>

          <Field label="Bio" error={errors.bio?.message}>
            <Textarea rows={3} maxLength={BIO_MAX} {...register("bio")} />
            <div className="mt-1 flex justify-between gap-3 text-[12px] text-slate-400">
              <span>Uma descrição curta que aparece na mini-loja.</span>
              <span className={bioLen >= BIO_MAX ? "font-semibold text-red-500" : ""}>
                {bioLen}/{BIO_MAX}
              </span>
            </div>
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Estado" error={errors.state?.message}>
              <Select
                {...register("state", {
                  onChange: () => setValue("city", ""),
                })}
                defaultValue=""
              >
                <option value="">Selecione o estado…</option>
                {UFS.map((u) => (
                  <option key={u.sigla} value={u.sigla}>
                    {u.nome} ({u.sigla})
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Cidade"
              hint={!uf ? "Selecione o estado primeiro." : undefined}
              error={errors.city?.message}
            >
              <Select {...register("city")} disabled={!uf || loadingCidades} defaultValue="">
                <option value="">
                  {loadingCidades ? "Carregando cidades…" : "Selecione a cidade…"}
                </option>
                {cidadeOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Telefone" error={errors.phone?.message}>
              <Controller
                control={control}
                name="phone"
                render={({ field }) => (
                  <Input
                    inputMode="tel"
                    placeholder="(11) 99999-9999"
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(maskPhone(e.target.value))}
                  />
                )}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="WhatsApp"
              hint="Com DDD — usado no botão de contato."
              error={errors.whatsapp?.message}
            >
              <Controller
                control={control}
                name="whatsapp"
                render={({ field }) => (
                  <Input
                    inputMode="tel"
                    placeholder="(11) 99999-9999"
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(maskPhone(e.target.value))}
                  />
                )}
              />
            </Field>
            <Field label="Instagram" error={errors.instagram?.message}>
              <Input placeholder="@sualoja" {...register("instagram")} />
            </Field>
          </div>

          <div className="mt-2 flex justify-end">
            <Button type="submit" loading={isSubmitting || update.isPending}>
              Salvar perfil
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
