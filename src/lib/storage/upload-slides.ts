import { getSupabaseClient } from "@/lib/supabase/client";

const SLIDES_BUCKET = "slides";

/**
 * Upload rendered PDF page blobs to Supabase Storage and return their public
 * URLs, in page order. Paths are `{userId}/{noteId}/{importId}-{page}.jpg` so
 * storage RLS can verify ownership from the first path segment.
 */
export async function uploadSlideImages(opts: {
  userId: string;
  noteId: string;
  importId: string;
  blobs: Blob[];
}): Promise<string[]> {
  const supabase = getSupabaseClient();
  const urls: string[] = [];

  for (let i = 0; i < opts.blobs.length; i++) {
    const path = `${opts.userId}/${opts.noteId}/${opts.importId}-${i}.jpg`;
    const { error } = await supabase.storage
      .from(SLIDES_BUCKET)
      .upload(path, opts.blobs[i], { contentType: "image/jpeg", upsert: false });
    if (error) throw new Error(`Failed to upload slide ${i + 1}: ${error.message}`);

    const { data } = supabase.storage.from(SLIDES_BUCKET).getPublicUrl(path);
    urls.push(data.publicUrl);
  }

  return urls;
}

/** Cap on a single pasted/dropped image before upload. */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/**
 * Upload one image (pasted, dropped, photographed, or picked) and return its
 * public URL. Reuses the slides bucket so the existing ownership policy —
 * which keys off the first path segment being the user's id — applies
 * unchanged.
 */
export async function uploadNoteImage(opts: {
  userId: string;
  noteId: string;
  file: Blob;
  filename?: string;
}): Promise<string> {
  const supabase = getSupabaseClient();
  const type = opts.file.type || "image/jpeg";
  const ext = (type.split("/")[1] || "jpg").replace("jpeg", "jpg").split("+")[0];
  const id = crypto.randomUUID().slice(0, 8);
  const path = `${opts.userId}/${opts.noteId}/img-${id}.${ext}`;

  const { error } = await supabase.storage
    .from(SLIDES_BUCKET)
    .upload(path, opts.file, { contentType: type, upsert: false });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(SLIDES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
