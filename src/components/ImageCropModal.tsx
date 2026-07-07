import { useCallback, useEffect, useMemo, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Alert, Button, Modal } from "@/components/ui-light";
import { getCroppedFile } from "@/lib/cropImage";

export interface ImageCropModalProps {
  file: File;
  title: string;
  /** Proporção largura/altura da área de recorte. */
  aspect: number;
  /** Dimensões finais do arquivo gerado. */
  outWidth: number;
  outHeight: number;
  cropShape?: "rect" | "round";
  mime?: "image/jpeg" | "image/png";
  /** Texto de medidas/formatos recomendados exibido no rodapé. */
  hint?: string;
  onCancel: () => void;
  onComplete: (file: File) => void;
}

export function ImageCropModal({
  file,
  title,
  aspect,
  outWidth,
  outHeight,
  cropShape = "rect",
  mime = "image/jpeg",
  hint,
  onCancel,
  onComplete,
}: ImageCropModalProps) {
  const imageUrl = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(imageUrl), [imageUrl]);

  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pixels, setPixels] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onCropComplete = useCallback((_a: Area, areaPixels: Area) => {
    setPixels(areaPixels);
  }, []);

  async function save() {
    if (!pixels) return;
    setBusy(true);
    setError(null);
    try {
      const out = await getCroppedFile(imageUrl, pixels, outWidth, outHeight, mime, file.name);
      onComplete(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao recortar a imagem.");
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onCancel} title={title} closeOnBackdrop={false}>
      <div className="flex flex-col gap-4">
        {error && <Alert variant="error">{error}</Alert>}

        <div className="relative h-[320px] w-full overflow-hidden rounded-xl bg-slate-900">
          <Cropper
            image={imageUrl}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            cropShape={cropShape}
            showGrid={cropShape === "rect"}
            restrictPosition
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <label className="flex items-center gap-3 text-sm text-slate-600">
          <span className="w-12 shrink-0 font-medium">Zoom</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full accent-brand"
          />
        </label>

        {hint && <p className="text-xs text-slate-400">{hint}</p>}

        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={save} loading={busy} disabled={!pixels}>
            Aplicar e salvar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
