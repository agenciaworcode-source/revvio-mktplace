import { supabase } from "./supabase";

export type MediaBucket = "avatars" | "banners" | "vehicle-images";

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(-60);
}

/**
 * Sobe um arquivo para um bucket de mídia respeitando a convenção de path
 * `<seller_id>/<arquivo>` exigida pelas policies de storage (RLS).
 * Retorna a URL pública.
 */
export async function uploadMedia(
  bucket: MediaBucket,
  sellerId: string,
  file: File
): Promise<string> {
  const path = `${sellerId}/${crypto.randomUUID()}-${safeName(file.name)}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/** Extrai o path interno (`<seller_id>/arquivo`) a partir da URL pública. */
export function pathFromPublicUrl(bucket: MediaBucket, url: string): string | null {
  const marker = `/object/public/${bucket}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : url.slice(i + marker.length);
}

/** Remove um arquivo do bucket a partir da URL pública (ignora se não achar). */
export async function removeMedia(bucket: MediaBucket, url: string): Promise<void> {
  const path = pathFromPublicUrl(bucket, url);
  if (!path) return;
  await supabase.storage.from(bucket).remove([path]);
}
