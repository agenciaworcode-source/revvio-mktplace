import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/features/auth/AuthProvider";
import {
  useDeleteVehicle,
  useSaveVehicle,
  useLojaSellers,
  useVehicles,
  type VehicleInput,
  type VehicleWithOwner,
} from "../queries";
import { uploadMedia } from "@/lib/storage";
import { formatCurrency, formatNumber } from "@/lib/format";
import {
  bodyLabels,
  fuelLabels,
  transmissionLabels,
  VEHICLE_OPTIONS,
} from "@/features/public/vehicleLabels";
import type { VehicleStatus } from "@/lib/database.types";
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
import { FipeSelector } from "../components/FipeSelector";
import { maskPhone } from "@/lib/masks";
import { ReasonField, REMOVAL_REASONS } from "@/components/ReasonField";
import { useFormDraft } from "@/lib/formDraft";
import type { FipeResult } from "@/lib/fipe";

const statusMeta: Record<VehicleStatus, { label: string; tone: "green" | "amber" | "neutral" }> = {
  available: { label: "Disponível", tone: "green" },
  reserved: { label: "Reservado", tone: "amber" },
  sold: { label: "Vendido", tone: "neutral" },
  removed: { label: "Removido", tone: "neutral" },
};

const emptyToNull = (v: unknown) => (v === "" || v == null ? null : v);

const FUELS = ["flex", "gasolina", "diesel", "etanol", "hibrido", "eletrico", "gnv"] as const;
const TRANSMISSIONS = ["manual", "automatico", "automatizado", "cvt"] as const;
const BODIES = ["hatch", "sedan", "suv", "picape", "utilitario", "cupe", "conversivel", "minivan"] as const;

const schema = z.object({
  make: z.string().min(1, "Obrigatório"),
  model: z.string().min(1, "Obrigatório"),
  year: z.preprocess(
    emptyToNull,
    z.coerce.number().int().min(1900).max(2100).nullable()
  ),
  price: z.coerce.number().gt(0, "Informe o preço"),
  fipe_price: z.preprocess(emptyToNull, z.coerce.number().min(0).nullable()),
  mileage: z.preprocess(emptyToNull, z.coerce.number().int().min(0).nullable()),
  color: z.string().optional(),
  fuel: z.preprocess(emptyToNull, z.enum(FUELS).nullable()),
  transmission: z.preprocess(emptyToNull, z.enum(TRANSMISSIONS).nullable()),
  body_type: z.preprocess(emptyToNull, z.enum(BODIES).nullable()),
  armored: z.boolean().default(false),
  featured: z.boolean().default(false),
  options: z.array(z.string()).default([]),
  status: z.enum(["available", "reserved", "sold"]),
  vendedor_id: z.string().min(1, "Atribua um vendedor"),
  origem: z.string().optional(),
  primeiro_dono: z.preprocess(emptyToNull, z.enum(["sim", "nao"]).nullable()),
  documentacao: z.string().optional(),
  ipva: z.string().optional(),
  garantia: z.string().optional(),
  leilao: z.preprocess(emptyToNull, z.enum(["sim", "nao"]).nullable()),
  owner_name: z.string().optional(),
  owner_phone: z.string().optional(),
  description: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

/** O que é guardado no rascunho: campos + imagens já enviadas + modo FIPE/manual. */
interface VehicleDraft {
  values: FormValues;
  images: string[];
  manual: boolean;
}

function toDefaults(v?: VehicleWithOwner, fallbackVendedorId?: string): FormValues {
  return {
    make: v?.make ?? "",
    model: v?.model ?? "",
    year: v?.year ?? null,
    price: v?.price ?? (0 as number),
    fipe_price: v?.fipe_price ?? null,
    mileage: v?.mileage ?? null,
    color: v?.color ?? "",
    fuel: v?.fuel ?? null,
    transmission: v?.transmission ?? null,
    body_type: v?.body_type ?? null,
    armored: v?.armored ?? false,
    featured: v?.featured ?? false,
    options: v?.options ?? [],
    status: (v?.status === "removed" ? "available" : v?.status) ?? "available",
    vendedor_id: v?.vendedor_id ?? fallbackVendedorId ?? "",
    origem: v?.origem ?? "",
    primeiro_dono: v?.primeiro_dono == null ? null : v.primeiro_dono ? "sim" : "nao",
    documentacao: v?.documentacao ?? "",
    ipva: v?.ipva ?? "",
    garantia: v?.garantia ?? "",
    leilao: v?.leilao == null ? null : v.leilao ? "sim" : "nao",
    owner_name: v?.owner?.owner_name ?? "",
    owner_phone: v?.owner?.owner_phone ?? "",
    description: v?.description ?? "",
  };
}

/** Input com máscara de moeda BRL. Exibe "R$ 7.700.000,00" mas guarda o número (em reais). */
function MoneyInput({
  value,
  onChange,
  placeholder,
  readOnly,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  readOnly?: boolean;
}) {
  return (
    <Input
      inputMode="numeric"
      readOnly={readOnly}
      tabIndex={readOnly ? -1 : undefined}
      className={readOnly ? "cursor-not-allowed bg-slate-50 text-slate-500" : undefined}
      placeholder={placeholder ?? "R$ 0,00"}
      value={value ? formatCurrency(value) : ""}
      onChange={(e) => {
        if (readOnly) return;
        const digits = e.target.value.replace(/\D/g, "");
        onChange(digits ? Number(digits) / 100 : null);
      }}
    />
  );
}

/** Multi-select de opcionais (lista fixa, evita erros de digitação). */
function OptionsSelect({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const toggle = (opt: string) =>
    onChange(value.includes(opt) ? value.filter((o) => o !== opt) : [...value, opt]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-[44px] w-full flex-wrap items-center gap-1.5 rounded-lg border border-[#e3e5e9] bg-[#fbfbfc] px-3 py-2 text-left text-sm focus:border-brand focus:ring-1 focus:ring-brand"
      >
        {value.length === 0 ? (
          <span className="text-[#b0b7c0]">Selecione os opcionais…</span>
        ) : (
          value.map((o) => (
            <span
              key={o}
              className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand"
            >
              {o}
              <span
                role="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggle(o);
                }}
                className="cursor-pointer text-brand/70 hover:text-brand"
              >
                ✕
              </span>
            </span>
          ))
        )}
        <span className="ml-auto text-slate-400">▾</span>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-[#e3e5e9] bg-white p-1 shadow-xl">
          {VEHICLE_OPTIONS.map((opt) => (
            <label
              key={opt}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              <input
                type="checkbox"
                className="h-4 w-4 accent-brand"
                checked={value.includes(opt)}
                onChange={() => toggle(opt)}
              />
              {opt}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export function VehicleForm({
  vehicle,
  onClose,
  lojaId: lojaIdProp,
}: {
  vehicle?: VehicleWithOwner;
  onClose: () => void;
  /** Loja do veículo (modo admin). Quando ausente, usa a loja do usuário logado. */
  lojaId?: string;
}) {
  const { lojaId: authLojaId, seller, personId, isVendedor } = useAuth();
  const lojaId = lojaIdProp ?? authLojaId ?? undefined;
  const save = useSaveVehicle(lojaId);
  // Garagista (dono) + vendedores da loja — funciona tanto p/ o próprio
  // garagista quanto p/ o admin editando a loja de outro.
  const { data: people = [] } = useLojaSellers(lojaId);
  const assignees = people.map((p) => ({
    id: p.id,
    label:
      p.id === lojaId
        ? `${p.name}${seller?.id === p.id ? " (você)" : " (garagista)"}`
        : p.name,
  }));
  // Quem cadastrou o veículo (melhoria #2) — só há valor ao editar.
  const createdByName = vehicle?.created_by
    ? people.find((p) => p.id === vehicle.created_by)?.name ?? "—"
    : null;
  const [images, setImages] = useState<string[]>(vehicle?.images ?? []);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    reset,
    watch,
    formState: { errors, dirtyFields, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    // Ao cadastrar como vendedor, já atribui o veículo a si mesmo por padrão.
    defaultValues: toDefaults(vehicle, isVendedor ? personId ?? undefined : undefined),
  });
  const [manual, setManual] = useState<boolean>(!!vehicle);

  /* ── Rascunho automático ────────────────────────────────────
     O formulário é longo; perder o preenchimento por um reload
     ou um fechamento acidental era o pior atrito do cadastro.
     Chave por veículo (ou "novo" da loja) para não misturar. */
  const draftKey = lojaId ? `vehicle:${lojaId}:${vehicle?.id ?? "novo"}` : null;
  const draft = useFormDraft<VehicleDraft>({
    key: draftKey,
    onRestore: (d) => {
      reset(d.values, { keepDefaultValues: true });
      setImages(d.images);
      setManual(d.manual);
    },
  });

  // Estado que vive fora do react-hook-form entra no rascunho por ref, para o
  // callback do watch() enxergar sempre o valor corrente sem virar dependência.
  const imagesRef = useRef(images);
  imagesRef.current = images;
  const manualRef = useRef(manual);
  manualRef.current = manual;

  // watch(callback) assina as mudanças SEM re-renderizar o formulário — usar
  // watch() como valor faria o form inteiro renderizar a cada tecla digitada.
  const draftSave = draft.save;
  useEffect(() => {
    const sub = watch((values) =>
      draftSave({
        values: values as FormValues,
        images: imagesRef.current,
        manual: manualRef.current,
      })
    );
    return () => sub.unsubscribe();
  }, [watch, draftSave]);

  // Imagens e o modo FIPE/manual mudam fora do watch — empurram o rascunho.
  // A comparação é com o estado da abertura (e não com `length`), senão editar
  // um veículo que já tem fotos gravaria um rascunho sem ninguém ter mexido.
  const opened = useRef({ images, manual });
  useEffect(() => {
    const touched =
      isDirty || images !== opened.current.images || manual !== opened.current.manual;
    if (!touched) return;
    draftSave({ values: getValues(), images, manual });
  }, [images, manual, isDirty, draftSave, getValues]);

  function discardDraft() {
    draft.clear();
    reset(toDefaults(vehicle, isVendedor ? personId ?? undefined : undefined));
    setImages(vehicle?.images ?? []);
    setManual(!!vehicle);
  }

  function applyFipe(r: FipeResult) {
    setValue("make", r.make, { shouldValidate: true });
    setValue("model", r.model, { shouldValidate: true });
    setValue("year", r.year, { shouldValidate: true });
    if (r.fipePrice != null) {
      setValue("fipe_price", r.fipePrice, { shouldValidate: true });
      if (!dirtyFields.price) {
        setValue("price", r.fipePrice, { shouldValidate: true });
      }
    }
    if (r.fuel) setValue("fuel", r.fuel, { shouldValidate: true });
  }

  async function handleFiles(files: FileList | null) {
    if (!files?.length || !lojaId) return;
    setUploading(true);
    setError(null);
    try {
      const urls = await Promise.all(
        Array.from(files).map((f) => uploadMedia("vehicle-images", lojaId, f))
      );
      setImages((prev) => [...prev, ...urls]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha no upload da imagem.");
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(values: FormValues) {
    setError(null);
    const payload: VehicleInput = {
      id: vehicle?.id,
      make: values.make,
      model: values.model,
      year: values.year,
      price: values.price,
      fipe_price: values.fipe_price,
      mileage: values.mileage,
      color: values.color || null,
      fuel: values.fuel,
      transmission: values.transmission,
      body_type: values.body_type,
      armored: values.armored,
      featured: values.featured,
      options: values.options,
      status: values.status,
      vendedor_id: values.vendedor_id,
      origem: values.origem || null,
      primeiro_dono: values.primeiro_dono ? values.primeiro_dono === "sim" : null,
      documentacao: values.documentacao || null,
      ipva: values.ipva || null,
      garantia: values.garantia || null,
      leilao: values.leilao ? values.leilao === "sim" : null,
      owner_name: values.owner_name || null,
      owner_phone: values.owner_phone || null,
      description: values.description || null,
      images,
    };
    try {
      await save.mutateAsync(payload);
      draft.clear(); // gravou no banco: o rascunho não serve mais
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar o veículo.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      {error && <Alert variant="error">{error}</Alert>}

      {draft.restored && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span>
            Recuperamos o preenchimento que você tinha deixado neste formulário.
          </span>
          <button
            type="button"
            onClick={discardDraft}
            className="font-semibold underline underline-offset-2 hover:text-amber-950"
          >
            Descartar e começar do zero
          </button>
        </div>
      )}

      {manual ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Marca" error={errors.make?.message}>
            <Input placeholder="Toyota" {...register("make")} />
          </Field>
          <Field label="Modelo" error={errors.model?.message}>
            <Input placeholder="Corolla" {...register("model")} />
          </Field>
          <Field label="Ano" error={errors.year?.message}>
            <Input type="number" placeholder="2022" {...register("year")} />
          </Field>
          <div className="sm:col-span-3">
            <button
              type="button"
              onClick={() => setManual(false)}
              className="text-xs font-medium text-brand hover:underline"
            >
              Usar a tabela FIPE
            </button>
          </div>
        </div>
      ) : (
        <>
          <FipeSelector onSelect={applyFipe} onUseManual={() => setManual(true)} />
          <input type="hidden" {...register("make")} />
          <input type="hidden" {...register("model")} />
          <input type="hidden" {...register("year")} />
          {(errors.make || errors.model || errors.year) && (
            <Alert variant="error">Selecione marca, modelo e ano na FIPE (ou preencha manualmente).</Alert>
          )}
        </>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Preço (R$)" error={errors.price?.message}>
          <Controller
            control={control}
            name="price"
            render={({ field }) => (
              <MoneyInput
                value={field.value ?? null}
                onChange={field.onChange}
                placeholder="R$ 89.900,00"
              />
            )}
          />
        </Field>
        <Field label="Quilometragem" error={errors.mileage?.message}>
          <Input type="number" placeholder="45000" {...register("mileage")} />
        </Field>
        <Field label="Cor" error={errors.color?.message}>
          <Input placeholder="Prata" {...register("color")} />
        </Field>
        <Field
          label="Preço FIPE (R$)"
          hint="Preenchido pela tabela FIPE. Referência para o selo 'abaixo da FIPE'."
          error={errors.fipe_price?.message}
        >
          <Controller
            control={control}
            name="fipe_price"
            render={({ field }) => (
              <MoneyInput
                readOnly
                value={field.value ?? null}
                onChange={field.onChange}
                placeholder="R$ 95.000,00"
              />
            )}
          />
        </Field>
        <Field label="Status" error={errors.status?.message}>
          <Select {...register("status")}>
            <option value="available">Disponível</option>
            <option value="reserved">Reservado</option>
            <option value="sold">Vendido</option>
          </Select>
        </Field>
        <Field
          label="Vendedor responsável"
          hint="A quem este veículo está atribuído."
          error={errors.vendedor_id?.message}
        >
          <Select {...register("vendedor_id")} defaultValue="">
            <option value="" disabled>
              Selecione um vendedor
            </option>
            {assignees.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </Select>
        </Field>
        {createdByName && (
          <Field
            label="Cadastrado por"
            hint="Quem registrou este veículo na plataforma."
          >
            <Input
              readOnly
              tabIndex={-1}
              value={createdByName}
              className="cursor-not-allowed bg-slate-50 text-slate-500"
            />
          </Field>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Combustível" error={errors.fuel?.message}>
          <Select {...register("fuel")} defaultValue="">
            <option value="">—</option>
            {FUELS.map((f) => (
              <option key={f} value={f}>{fuelLabels[f]}</option>
            ))}
          </Select>
        </Field>
        <Field label="Câmbio" error={errors.transmission?.message}>
          <Select {...register("transmission")} defaultValue="">
            <option value="">—</option>
            {TRANSMISSIONS.map((t) => (
              <option key={t} value={t}>{transmissionLabels[t]}</option>
            ))}
          </Select>
        </Field>
        <Field label="Carroceria" error={errors.body_type?.message}>
          <Select {...register("body_type")} defaultValue="">
            <option value="">—</option>
            {BODIES.map((b) => (
              <option key={b} value={b}>{bodyLabels[b]}</option>
            ))}
          </Select>
        </Field>
      </div>

      <Field
        label="Opcionais"
        hint="Selecione os itens do veículo."
        error={errors.options?.message}
      >
        <Controller
          control={control}
          name="options"
          render={({ field }) => (
            <OptionsSelect value={field.value ?? []} onChange={field.onChange} />
          )}
        />
      </Field>

      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" className="h-4 w-4 accent-brand" {...register("armored")} />
          Blindado
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" className="h-4 w-4 accent-brand" {...register("featured")} />
          Destacar (oferta)
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Proprietário (dono do carro)"
          hint="Diferente de você — é o dono original."
          error={errors.owner_name?.message}
        >
          <Input placeholder="Nome do proprietário" {...register("owner_name")} />
        </Field>
        <Field label="Telefone do proprietário" error={errors.owner_phone?.message}>
          {(() => {
            const ownerPhone = register("owner_phone");
            return (
              <Input
                inputMode="tel"
                placeholder="(11) 99999-9999"
                {...ownerPhone}
                onChange={(e) => {
                  e.target.value = maskPhone(e.target.value);
                  ownerPhone.onChange(e);
                }}
              />
            );
          })()}
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Origem" error={errors.origem?.message}>
          <Select {...register("origem")} defaultValue="">
            <option value="">—</option>
            <option value="nacional">Nacional</option>
            <option value="importado">Importado</option>
          </Select>
        </Field>
        <Field label="Primeiro dono" error={errors.primeiro_dono?.message}>
          <Select {...register("primeiro_dono")} defaultValue="">
            <option value="">—</option>
            <option value="sim">Sim</option>
            <option value="nao">Não</option>
          </Select>
        </Field>
        <Field label="Passagem por leilão" error={errors.leilao?.message}>
          <Select {...register("leilao")} defaultValue="">
            <option value="">—</option>
            <option value="nao">Não</option>
            <option value="sim">Sim</option>
          </Select>
        </Field>
        <Field label="Documentação" error={errors.documentacao?.message}>
          <Input placeholder="Regular" {...register("documentacao")} />
        </Field>
        <Field label="IPVA" error={errors.ipva?.message}>
          <Input placeholder="Pago 2026" {...register("ipva")} />
        </Field>
        <Field label="Garantia" error={errors.garantia?.message}>
          <Input placeholder="Não possui" {...register("garantia")} />
        </Field>
      </div>

      <Field label="Descrição" error={errors.description?.message}>
        <Textarea rows={3} placeholder="Único dono, revisões em dia…" {...register("description")} />
      </Field>

      <Field label="Imagens" hint="Você pode enviar várias.">
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => handleFiles(e.target.files)}
          className="block w-full text-sm text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-slate-900 hover:file:bg-slate-700"
        />
      </Field>

      {uploading && (
        <p className="flex items-center gap-2 text-sm text-slate-400">
          <Spinner className="h-4 w-4" /> Enviando imagens…
        </p>
      )}

      {images.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {images.map((url) => (
            <div key={url} className="relative h-20 w-28 overflow-hidden rounded-lg">
              <img src={url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => setImages((prev) => prev.filter((u) => u !== url))}
                className="absolute right-1 top-1 rounded bg-black/70 px-1.5 text-xs text-slate-900 hover:bg-red-600"
                aria-label="Remover imagem"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center justify-end gap-3">
        {(isDirty || images.length > 0) && (
          <span className="mr-auto text-xs text-slate-400">
            Rascunho salvo automaticamente neste navegador.
          </span>
        )}
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            // "Cancelar" é descarte explícito — só o X / fechar a aba preserva.
            if (
              (isDirty || images.length > 0) &&
              !window.confirm("Descartar o preenchimento deste formulário?")
            )
              return;
            draft.clear();
            onClose();
          }}
        >
          Cancelar
        </Button>
        <Button type="submit" loading={save.isPending} disabled={uploading}>
          {vehicle ? "Salvar alterações" : "Cadastrar veículo"}
        </Button>
      </div>
    </form>
  );
}

export function Vehicles() {
  const { lojaId, personId, isGaragista, isAdmin } = useAuth();
  const manager = isGaragista || isAdmin;
  const { data, isLoading } = useVehicles(lojaId ?? undefined);
  const remove = useDeleteVehicle(lojaId ?? undefined);
  const [editing, setEditing] = useState<VehicleWithOwner | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<VehicleWithOwner | null>(null);
  const [removalReason, setRemovalReason] = useState("");

  const [view, setView] = useState<"cards" | "list">("cards");
  const [status, setStatus] = useState("all");
  const [make, setMake] = useState("all");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");

  const vehicles = useMemo(() => data ?? [], [data]);
  const makes = useMemo(
    () => Array.from(new Set(vehicles.map((v) => v.make).filter(Boolean))).sort(),
    [vehicles]
  );

  const filtered = useMemo(() => {
    const min = priceMin ? Number(priceMin) : null;
    const max = priceMax ? Number(priceMax) : null;
    return vehicles.filter((v) => {
      if (status !== "all" && v.status !== status) return false;
      if (make !== "all" && v.make !== make) return false;
      if (min !== null && v.price < min) return false;
      if (max !== null && v.price > max) return false;
      return true;
    });
  }, [vehicles, status, make, priceMin, priceMax]);

  const hasFilter = status !== "all" || make !== "all" || !!priceMin || !!priceMax;
  const clearFilters = () => {
    setStatus("all");
    setMake("all");
    setPriceMin("");
    setPriceMax("");
  };

  const open = creating || editing !== null;

  async function confirmDelete() {
    if (!deleting || !removalReason.trim()) return;
    try {
      await remove.mutateAsync({ id: deleting.id, reason: removalReason.trim(), personId });
      setDeleting(null);
      setRemovalReason("");
    } catch {
      /* erro exibido no modal via remove.isError */
    }
  }

  return (
    <div>
      <PageHeader
        title="Meus Veículos"
        subtitle="Cadastre e gerencie o seu estoque."
        action={<Button onClick={() => setCreating(true)}>+ Novo veículo</Button>}
      />

      {isLoading ? (
        <div className="flex justify-center py-16 text-slate-500">
          <Spinner />
        </div>
      ) : vehicles.length === 0 ? (
        <EmptyState
          title="Nenhum veículo cadastrado"
          description="Adicione seu primeiro veículo para começar a vender."
          action={<Button onClick={() => setCreating(true)}>+ Novo veículo</Button>}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {/* Barra de filtros + alternância de visualização */}
          <Card className="flex flex-wrap items-end gap-3 p-4">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-bold uppercase tracking-[.5px] text-slate-400">
                Status
              </span>
              <Select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="py-2 text-[13px]"
              >
                <option value="all">Todos</option>
                <option value="available">Disponível</option>
                <option value="reserved">Reservado</option>
                <option value="sold">Vendido</option>
              </Select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-bold uppercase tracking-[.5px] text-slate-400">
                Marca
              </span>
              <Select
                value={make}
                onChange={(e) => setMake(e.target.value)}
                className="py-2 text-[13px]"
              >
                <option value="all">Todas</option>
                {makes.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-bold uppercase tracking-[.5px] text-slate-400">
                Preço (R$)
              </span>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder="Mín."
                  value={priceMin}
                  onChange={(e) => setPriceMin(e.target.value)}
                  className="w-28 py-2 text-[13px]"
                />
                <span className="text-slate-300">–</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder="Máx."
                  value={priceMax}
                  onChange={(e) => setPriceMax(e.target.value)}
                  className="w-28 py-2 text-[13px]"
                />
              </div>
            </label>

            <div className="ml-auto flex items-end gap-3">
              {hasFilter && (
                <button
                  onClick={clearFilters}
                  className="pb-2 text-[13px] font-semibold text-brand hover:underline"
                >
                  Limpar filtros
                </button>
              )}
              {/* Alternância cards / lista */}
              <div className="inline-flex rounded-lg border border-slate-200 p-0.5">
                <button
                  type="button"
                  onClick={() => setView("cards")}
                  className={`rounded-md px-3 py-1.5 text-[13px] font-semibold transition ${
                    view === "cards"
                      ? "bg-brand text-white"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                  aria-pressed={view === "cards"}
                >
                  Cards
                </button>
                <button
                  type="button"
                  onClick={() => setView("list")}
                  className={`rounded-md px-3 py-1.5 text-[13px] font-semibold transition ${
                    view === "list"
                      ? "bg-brand text-white"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                  aria-pressed={view === "list"}
                >
                  Lista
                </button>
              </div>
            </div>
          </Card>

          {filtered.length === 0 ? (
            <Card className="px-6 py-16 text-center text-sm text-slate-400">
              Nenhum veículo corresponde aos filtros.
            </Card>
          ) : view === "cards" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((v) => (
                <Card key={v.id} className="flex flex-col gap-3 p-0">
                  <div className="aspect-video overflow-hidden rounded-t-2xl bg-slate-100">
                    {v.images[0] ? (
                      <img src={v.images[0]} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-slate-600">
                        Sem foto
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 p-4 pt-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">
                          {v.make} {v.model}
                        </p>
                        <p className="text-xs text-slate-500">
                          {v.year ?? "—"}
                          {v.mileage != null && ` · ${formatNumber(v.mileage)} km`}
                        </p>
                      </div>
                      <Badge tone={statusMeta[v.status].tone}>
                        {statusMeta[v.status].label}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-lg font-bold text-brand">{formatCurrency(v.price)}</p>
                      <span
                        className="text-xs font-medium text-slate-500"
                        title={'Cliques no botão "Quero ver o carro"'}
                      >
                        👁 {formatNumber(v.clicks)} {v.clicks === 1 ? "clique" : "cliques"}
                      </span>
                    </div>
                    {manager && (
                      <div className="mt-1 flex gap-2">
                        <Button
                          variant="outline"
                          className="flex-1 py-2"
                          onClick={() => setEditing(v)}
                        >
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          className="px-3 py-2 text-red-400 hover:bg-red-950/40"
                          onClick={() => setDeleting(v)}
                        >
                          Excluir
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Veículo</th>
                    <th className="px-5 py-3 text-center font-medium">Status</th>
                    <th className="px-5 py-3 text-center font-medium">Ano</th>
                    <th className="px-5 py-3 text-center font-medium">Cliques</th>
                    <th className="px-5 py-3 text-right font-medium">Preço</th>
                    <th className="px-5 py-3 text-right font-medium">FIPE</th>
                    {manager && <th className="px-5 py-3 text-right font-medium">Ações</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          {v.images[0] ? (
                            <img
                              src={v.images[0]}
                              alt=""
                              className="h-10 w-14 rounded-lg object-cover"
                            />
                          ) : (
                            <span className="h-10 w-14 rounded-lg bg-slate-100" />
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-900">
                              {v.make} {v.model}
                            </p>
                            <p className="text-xs text-slate-500">
                              {v.year ?? "—"}
                              {v.mileage != null && ` · ${formatNumber(v.mileage)} km`}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <Badge tone={statusMeta[v.status].tone}>
                          {statusMeta[v.status].label}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-center text-slate-600">{v.year ?? "—"}</td>
                      <td className="px-5 py-3 text-center font-semibold text-slate-700">
                        {formatNumber(v.clicks)}
                      </td>
                      <td className="px-5 py-3 text-right font-bold text-brand">
                        {formatCurrency(v.price)}
                      </td>
                      <td className="px-5 py-3 text-right text-slate-400">
                        {v.fipe_price ? (
                          <span className="line-through">{formatCurrency(v.fipe_price)}</span>
                        ) : (
                          "—"
                        )}
                      </td>
                      {manager && (
                        <td className="px-5 py-3">
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" className="px-3 py-1.5" onClick={() => setEditing(v)}>
                              Editar
                            </Button>
                            <Button
                              variant="ghost"
                              className="px-3 py-1.5 text-red-400 hover:bg-red-950/40"
                              onClick={() => setDeleting(v)}
                            >
                              Excluir
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      )}

      <Modal
        wide
        closeOnBackdrop={false}
        open={open}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        title={editing ? "Editar veículo" : "Novo veículo"}
      >
        {open && (
          <VehicleForm
            vehicle={editing ?? undefined}
            onClose={() => {
              setCreating(false);
              setEditing(null);
            }}
          />
        )}
      </Modal>

      {deleting && (
        <Modal
          open
          closeOnBackdrop={false}
          onClose={() => {
            setDeleting(null);
            setRemovalReason("");
          }}
          title="Excluir veículo"
        >
          <p className="text-sm text-slate-600">
            Excluir{" "}
            <strong className="text-slate-900">
              {deleting.make} {deleting.model}
            </strong>
            ? O veículo sai das listagens, mas o registro é mantido para histórico.
          </p>
          <div className="mt-4">
            <ReasonField
              label="Motivo da remoção"
              options={REMOVAL_REASONS}
              onResolved={setRemovalReason}
            />
          </div>
          {remove.isError && (
            <div className="mt-4">
              <Alert variant="error">Erro ao excluir o veículo. Tente novamente.</Alert>
            </div>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setDeleting(null);
                setRemovalReason("");
              }}
              disabled={remove.isPending}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              loading={remove.isPending}
              disabled={!removalReason.trim()}
              onClick={confirmDelete}
            >
              Excluir
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
