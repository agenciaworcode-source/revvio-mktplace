import { useEffect, useState } from "react";
import {
  useAdminHomeSlides,
  useCreateHomeSlide,
  useUpdateHomeSlide,
  useDeleteHomeSlide,
  useReorderHomeSlides,
  useUploadSlideImage,
  useCarouselConfig,
  useUpdateCarouselConfig,
} from "../queries";
import type { HomeSlide } from "@/features/public/queries";
import { PanelHeader, SectionCard } from "@/components/panel";
import { Alert, Button, Field, Input, Modal, Spinner } from "@/components/ui-light";
import { ImageCropModal } from "@/components/ImageCropModal";
import { Icon } from "@/features/public/components/icons";

/* Recorte por destino: a home usa a mesma imagem em tela cheia, mas a faixa
   do computador é panorâmica (~2,9:1) e a do celular é quase quadrada. */
const SPECS = {
  image_url: {
    titulo: "Ajustar banner do computador",
    aspect: 1600 / 548,
    outWidth: 1920,
    outHeight: 658,
    hint: "Banner de computador: 1920 × 658 px (panorâmico, ~2,9:1) · JPG, PNG ou WebP.",
    label: "Computador",
    frame: "aspect-[1600/548]",
  },
  image_mobile_url: {
    titulo: "Ajustar banner do celular",
    aspect: 4 / 5,
    outWidth: 1080,
    outHeight: 1350,
    hint: "Banner de celular: 1080 × 1350 px (retrato, 4:5) · JPG, PNG ou WebP.",
    label: "Celular",
    frame: "aspect-[4/5]",
  },
} as const;
type CampoImagem = keyof typeof SPECS;

function ImagemSlot({
  slide,
  campo,
  enviando,
  onEscolher,
}: {
  slide: HomeSlide;
  campo: CampoImagem;
  enviando: boolean;
  onEscolher: (f: File) => void;
}) {
  const spec = SPECS[campo];
  const url = slide[campo];
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-[12.5px] font-semibold text-slate-700">{spec.label}</span>
        <span className="text-[11px] text-slate-400">
          {spec.outWidth}×{spec.outHeight}
        </span>
      </div>
      <div className={`relative overflow-hidden rounded-xl bg-slate-100 ${spec.frame}`}>
        {url ? (
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center px-3 text-center text-[12px] text-slate-400">
            Nenhuma imagem
          </div>
        )}
        <label className="absolute right-2 top-2 cursor-pointer rounded-lg bg-black/70 px-2.5 py-1 text-[11.5px] font-medium text-white hover:bg-black">
          {enviando ? "Enviando…" : url ? "Trocar" : "Enviar"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onEscolher(f);
              e.target.value = "";
            }}
          />
        </label>
      </div>
    </div>
  );
}

/* Um slide editável. O estado dos textos é local e só vai ao banco no
   "Salvar", para não gravar a cada tecla. */
function SlideCard({
  slide,
  indice,
  total,
  onMover,
  onExcluir,
}: {
  slide: HomeSlide;
  indice: number;
  total: number;
  onMover: (dir: -1 | 1) => void;
  onExcluir: () => void;
}) {
  const update = useUpdateHomeSlide();
  const upload = useUploadSlideImage();
  const [form, setForm] = useState(slide);
  const [crop, setCrop] = useState<{ campo: CampoImagem; file: File } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => setForm(slide), [slide]);

  const sujo =
    form.title !== slide.title ||
    form.subtitle !== slide.subtitle ||
    form.cta_label !== slide.cta_label ||
    form.cta_url !== slide.cta_url ||
    form.cta2_label !== slide.cta2_label ||
    form.cta2_url !== slide.cta2_url;

  function set<K extends keyof HomeSlide>(k: K, v: HomeSlide[K]) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  async function salvar() {
    setErro(null);
    try {
      await update.mutateAsync({
        id: slide.id,
        title: form.title?.trim() || null,
        subtitle: form.subtitle?.trim() || null,
        cta_label: form.cta_label?.trim() || null,
        cta_url: form.cta_url?.trim() || null,
        cta2_label: form.cta2_label?.trim() || null,
        cta2_url: form.cta2_url?.trim() || null,
      });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar o slide.");
    }
  }

  const semImagem = !slide.image_url && !slide.image_mobile_url;

  return (
    <SectionCard className="p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-slate-100 text-[12.5px] font-bold text-slate-600">
            {indice + 1}
          </span>
          <span className="text-[14px] font-bold text-slate-900">
            {slide.title?.trim() || "Slide sem título"}
          </span>
          <span
            className={`rounded-full px-2.5 py-[3px] text-[11px] font-bold ${
              slide.active
                ? "bg-emerald-50 text-emerald-700"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            {slide.active ? "NO AR" : "OCULTO"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onMover(-1)}
            disabled={indice === 0}
            title="Subir"
            className="grid h-8 w-8 place-items-center rounded-lg border border-hair text-slate-500 hover:bg-slate-50 disabled:opacity-40"
          >
            <Icon name="chevronUp" size={16} />
          </button>
          <button
            type="button"
            onClick={() => onMover(1)}
            disabled={indice === total - 1}
            title="Descer"
            className="grid h-8 w-8 place-items-center rounded-lg border border-hair text-slate-500 hover:bg-slate-50 disabled:opacity-40"
          >
            <Icon name="chevronDown" size={16} />
          </button>
          <Button
            variant="outline"
            className="px-3 py-1.5 text-xs"
            loading={update.isPending}
            onClick={() =>
              update.mutate({
                id: slide.id,
                active: !slide.active,
              })
            }
            disabled={semImagem && !slide.active}
          >
            {slide.active ? "Ocultar" : "Publicar"}
          </Button>
          <Button
            variant="ghost"
            className="px-3 py-1.5 text-xs text-red-500 hover:bg-red-50"
            onClick={onExcluir}
          >
            Excluir
          </Button>
        </div>
      </div>

      {semImagem && (
        <div className="mb-4">
          <Alert variant="error">
            Envie ao menos a imagem de computador para poder publicar este slide.
          </Alert>
        </div>
      )}
      {erro && (
        <div className="mb-4">
          <Alert variant="error">{erro}</Alert>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_200px]">
        <ImagemSlot
          slide={slide}
          campo="image_url"
          enviando={upload.isPending && upload.variables?.campo === "image_url"}
          onEscolher={(file) => setCrop({ campo: "image_url", file })}
        />
        <ImagemSlot
          slide={slide}
          campo="image_mobile_url"
          enviando={upload.isPending && upload.variables?.campo === "image_mobile_url"}
          onEscolher={(file) => setCrop({ campo: "image_mobile_url", file })}
        />
      </div>
      <p className="mt-2 text-[12px] text-slate-400">
        Sem imagem de celular, a do computador é usada nos dois tamanhos (e fica
        bem cortada nas laterais no celular).
      </p>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Título" hint="Deixe vazio para um banner só de imagem.">
          <Input
            value={form.title ?? ""}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Seu próximo carro está aqui"
          />
        </Field>
        <Field label="Subtítulo">
          <Input
            value={form.subtitle ?? ""}
            onChange={(e) => set("subtitle", e.target.value)}
            placeholder="Milhares de veículos com procedência"
          />
        </Field>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Botão 1 — texto">
          <Input
            value={form.cta_label ?? ""}
            onChange={(e) => set("cta_label", e.target.value)}
            placeholder="Ver ofertas"
          />
        </Field>
        <Field
          label="Botão 1 — link"
          hint="Interno: /comprar · Externo: https://…"
        >
          <Input
            value={form.cta_url ?? ""}
            onChange={(e) => set("cta_url", e.target.value)}
            placeholder="/comprar"
          />
        </Field>
        <Field label="Botão 2 — texto">
          <Input
            value={form.cta2_label ?? ""}
            onChange={(e) => set("cta2_label", e.target.value)}
            placeholder="Quero anunciar"
          />
        </Field>
        <Field label="Botão 2 — link">
          <Input
            value={form.cta2_url ?? ""}
            onChange={(e) => set("cta2_url", e.target.value)}
            placeholder="/vender"
          />
        </Field>
      </div>
      <p className="mt-1.5 text-[12px] text-slate-400">
        O botão só aparece na home quando texto e link estão preenchidos. Links
        externos abrem em nova aba.
      </p>

      <div className="mt-4 flex justify-end">
        <Button onClick={salvar} loading={update.isPending} disabled={!sujo}>
          Salvar slide
        </Button>
      </div>

      {crop && (
        <ImageCropModal
          file={crop.file}
          title={SPECS[crop.campo].titulo}
          aspect={SPECS[crop.campo].aspect}
          outWidth={SPECS[crop.campo].outWidth}
          outHeight={SPECS[crop.campo].outHeight}
          hint={SPECS[crop.campo].hint}
          onCancel={() => setCrop(null)}
          onComplete={(file) => {
            const campo = crop.campo;
            setCrop(null);
            setErro(null);
            upload.mutate(
              { slide, campo, file },
              {
                onError: (e) =>
                  setErro(e instanceof Error ? e.message : "Falha no upload da imagem."),
              }
            );
          }}
        />
      )}
    </SectionCard>
  );
}

/* Comportamento do carrossel — vale para a home inteira. */
function ConfigCarrossel() {
  const { data, isLoading } = useCarouselConfig();
  const update = useUpdateCarouselConfig();
  const [segundos, setSegundos] = useState("6");

  useEffect(() => {
    if (data) setSegundos(String(Math.round(data.carousel_interval_ms / 1000)));
  }, [data]);

  if (isLoading || !data) {
    return (
      <SectionCard className="flex justify-center p-8 text-slate-400">
        <Spinner />
      </SectionCard>
    );
  }

  const check = (
    campo: "carousel_autoplay" | "carousel_show_arrows" | "carousel_show_dots",
    label: string,
    hint: string
  ) => (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-hair px-3 py-2.5 hover:bg-slate-50">
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 accent-brand"
        checked={data[campo]}
        onChange={(e) => update.mutate({ [campo]: e.target.checked })}
      />
      <span>
        <span className="block text-[13.5px] font-semibold text-slate-800">{label}</span>
        <span className="block text-[12px] text-slate-500">{hint}</span>
      </span>
    </label>
  );

  return (
    <SectionCard className="p-4 sm:p-6">
      <h2 className="text-[15px] font-bold text-slate-900">Configurações do carrossel</h2>
      <p className="mt-0.5 text-[13px] text-slate-400">
        Com um slide só, as setas e os pontinhos não aparecem.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {check("carousel_autoplay", "Passar sozinho", "Avança automaticamente")}
        {check("carousel_show_arrows", "Setas laterais", "Voltar / avançar")}
        {check("carousel_show_dots", "Pontinhos", "Indicador de posição")}
      </div>

      <div className="mt-4 max-w-[260px]">
        <Field
          label="Tempo de cada slide (segundos)"
          hint="Entre 2 e 30. Só vale com 'passar sozinho' ligado."
        >
          <Input
            type="number"
            min={2}
            max={30}
            value={segundos}
            onChange={(e) => setSegundos(e.target.value)}
            onBlur={() => {
              const s = Math.min(30, Math.max(2, Number(segundos) || 6));
              setSegundos(String(s));
              if (s * 1000 !== data.carousel_interval_ms)
                update.mutate({ carousel_interval_ms: s * 1000 });
            }}
          />
        </Field>
      </div>

      {update.isError && (
        <div className="mt-3">
          <Alert variant="error">
            {update.error instanceof Error
              ? update.error.message
              : "Erro ao salvar as configurações."}
          </Alert>
        </div>
      )}

      <p className="mt-3 text-[12px] text-slate-400">
        O carrossel não passa sozinho para quem ativou “reduzir movimento” no
        sistema, e pausa enquanto o mouse está sobre ele.
      </p>
    </SectionCard>
  );
}

/**
 * Aparência do site — carrossel da home (/): slides com imagem de computador e
 * de celular, textos e botões com link, mais o comportamento do carrossel.
 */
export function Aparencia() {
  const { data: slides, isLoading } = useAdminHomeSlides();
  const criar = useCreateHomeSlide();
  const reordenar = useReorderHomeSlides();
  const excluir = useDeleteHomeSlide();
  const [excluindo, setExcluindo] = useState<HomeSlide | null>(null);

  const lista = slides ?? [];

  function mover(indice: number, dir: -1 | 1) {
    const destino = indice + dir;
    if (destino < 0 || destino >= lista.length) return;
    const ids = lista.map((s) => s.id);
    [ids[indice], ids[destino]] = [ids[destino], ids[indice]];
    reordenar.mutate(ids);
  }

  return (
    <div>
      <PanelHeader
        title="Aparência"
        subtitle="Carrossel do topo da home pública (/)"
        actions={
          <Button onClick={() => criar.mutate(lista.length)} loading={criar.isPending}>
            <Icon name="plus" size={16} stroke={2.4} /> Novo slide
          </Button>
        }
      />

      {criar.isError && (
        <div className="mb-5">
          <Alert variant="error">
            {criar.error instanceof Error ? criar.error.message : "Erro ao criar o slide."}
          </Alert>
        </div>
      )}

      <div className="flex flex-col gap-5">
        <ConfigCarrossel />

        {isLoading ? (
          <SectionCard className="flex justify-center p-16 text-slate-400">
            <Spinner />
          </SectionCard>
        ) : lista.length === 0 ? (
          <SectionCard className="p-16 text-center text-[14px] text-slate-400">
            Nenhum slide ainda. A home está exibindo a imagem padrão —{" "}
            <button
              onClick={() => criar.mutate(0)}
              className="font-bold text-brand hover:underline"
            >
              criar o primeiro slide
            </button>
            .
          </SectionCard>
        ) : (
          lista.map((s, i) => (
            <SlideCard
              key={s.id}
              slide={s}
              indice={i}
              total={lista.length}
              onMover={(dir) => mover(i, dir)}
              onExcluir={() => setExcluindo(s)}
            />
          ))
        )}
      </div>

      {excluindo && (
        <Modal open onClose={() => setExcluindo(null)} title="Excluir slide">
          <p className="text-sm text-slate-600">
            Excluir{" "}
            <strong className="text-slate-900">
              {excluindo.title?.trim() || "este slide"}
            </strong>
            ? As imagens também são apagadas. Esta ação não pode ser desfeita.
          </p>
          {excluir.isError && (
            <div className="mt-4">
              <Alert variant="error">
                {excluir.error instanceof Error
                  ? excluir.error.message
                  : "Não foi possível excluir."}
              </Alert>
            </div>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setExcluindo(null)}
              disabled={excluir.isPending}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              loading={excluir.isPending}
              onClick={async () => {
                try {
                  await excluir.mutateAsync(excluindo);
                  setExcluindo(null);
                } catch {
                  /* erro exibido no Alert */
                }
              }}
            >
              Excluir
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
