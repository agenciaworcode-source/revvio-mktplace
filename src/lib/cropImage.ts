/** Recorta uma imagem (a partir de uma object URL) numa região em pixels e
 *  devolve um File no tamanho de saída desejado. */
export interface PixelCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Falha ao carregar a imagem."));
    img.src = url;
  });
}

export async function getCroppedFile(
  src: string,
  crop: PixelCrop,
  outWidth: number,
  outHeight: number,
  mime: "image/jpeg" | "image/png",
  fileName: string
): Promise<File> {
  const img = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = outWidth;
  canvas.height = outHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas não suportado.");

  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    img,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    outWidth,
    outHeight
  );

  const ext = mime === "image/png" ? "png" : "jpg";
  const base = fileName.replace(/\.[^.]+$/, "") || "imagem";
  return new Promise<File>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error("Falha ao gerar a imagem."));
        resolve(new File([blob], `${base}.${ext}`, { type: mime }));
      },
      mime,
      0.92
    );
  });
}
