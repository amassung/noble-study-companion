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
