import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button, Modal, Spinner } from "@/components/ui-light";
import { Icon } from "@/features/public/components/icons";

/**
 * Captura de foto EXCLUSIVAMENTE pela câmera do dispositivo
 * (navigator.mediaDevices.getUserMedia). Não existe <input type="file">
 * em nenhum caminho deste fluxo — upload da galeria é impossível por
 * construção, conforme a regra de segurança do módulo de contratos.
 */
export function CameraCapture({
  open,
  onClose,
  onCapture,
  uploading,
}: {
  open: boolean;
  onClose: () => void;
  /** Recebe o JPEG capturado; o chamador faz o upload. */
  onCapture: (blob: Blob) => void;
  uploading?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [preview, setPreview] = useState<{ blob: Blob; url: string } | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    setStarting(true);
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Este navegador não suporta captura de câmera.");
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1920 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (e) {
        if (!cancelled)
          setError(
            e instanceof DOMException && e.name === "NotAllowedError"
              ? "Permissão de câmera negada. Libere o acesso à câmera para fotografar o contrato."
              : "Não foi possível acessar a câmera do dispositivo."
          );
      } finally {
        if (!cancelled) setStarting(false);
      }
    })();
    return () => {
      cancelled = true;
      stopStream();
    };
  }, [open, stopStream]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview.url);
    };
  }, [preview]);

  function handleClose() {
    stopStream();
    setPreview(null);
    onClose();
  }

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) setPreview({ blob, url: URL.createObjectURL(blob) });
      },
      "image/jpeg",
      0.92
    );
  }

  return (
    <Modal open={open} onClose={handleClose} title="Fotografar contrato assinado" wide>
      {error ? (
        <Alert variant="error">{error}</Alert>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="relative overflow-hidden rounded-xl bg-slate-950">
            {/* vídeo fica montado por baixo do preview p/ manter o stream vivo */}
            <video
              ref={videoRef}
              playsInline
              muted
              className={`max-h-[60vh] w-full object-contain ${preview ? "hidden" : ""}`}
            />
            {preview && (
              <img
                src={preview.url}
                alt="Foto capturada do contrato"
                className="max-h-[60vh] w-full object-contain"
              />
            )}
            {starting && (
              <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                <Spinner className="h-6 w-6" />
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            {preview ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => setPreview(null)}
                  disabled={uploading}
                >
                  Tirar outra
                </Button>
                <Button
                  loading={uploading}
                  onClick={() => onCapture(preview.blob)}
                >
                  <Icon name="check" size={16} /> Usar esta foto
                </Button>
              </>
            ) : (
              <Button onClick={capture} disabled={starting}>
                <Icon name="camera" size={16} /> Capturar
              </Button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
