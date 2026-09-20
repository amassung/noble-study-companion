import { useQuery } from "@tanstack/react-query";
import { getSupabaseClient } from "@/lib/supabase/client";

const SLIDES_BUCKET = "slides";

/** How long a signed link lives. */
const SIGN_TTL_SECONDS = 60 * 60;

/**
 * Refetch comfortably inside the TTL.
 *
 * A link that expires while a student is still reading the slide turns the
 * page blank, so the cache is deliberately shorter-lived than the signature.
 */
const SIGN_STALE_MS = 45 * 60 * 1000;

/**
 * The storage path inside a slides URL, or null if it is not one.
 *
 * Note bodies store the canonical public-form URL and always have — that is
 * what makes this work without rewriting a single existing note. The bucket
 * is private now, so the stored URL is an identifier rather than something
 * that resolves, and the path is what a signature is issued against. Both the
 * public and already-signed shapes are accepted, since a body edited while a
 * signed URL was on screen can persist that form instead.
 */
export function slidesPathFromUrl(url: string): string | null {
  if (!url) return null;
  for (const marker of [`/object/public/${SLIDES_BUCKET}/`, `/object/sign/${SLIDES_BUCKET}/`]) {
    const at = url.indexOf(marker);
    if (at === -1) continue;
    const path = url.slice(at + marker.length).split("?")[0];
    return path ? decodeURIComponent(path) : null;
  }
  return null;
}

/** Sign many paths in one request, returning a path → URL map. */
async function signPaths(paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.storage
    .from(SLIDES_BUCKET)
    .createSignedUrls(paths, SIGN_TTL_SECONDS);
  if (error) throw error;
  const out: Record<string, string> = {};
  for (const row of data ?? []) {
    if (row.path && row.signedUrl) out[row.path] = row.signedUrl;
  }
  return out;
}

/**
 * Turn stored slide URLs into ones that actually load.
 *
 * Anything that is not a slides URL is passed through untouched, so an image
 * pasted from the web keeps working exactly as before.
 */
export function useSignedSlideUrls(urls: string[]): {
  resolve: (url: string) => string;
  isLoading: boolean;
} {
  const paths = [...new Set(urls.map(slidesPathFromUrl).filter((p): p is string => !!p))].sort();

  const { data, isLoading } = useQuery({
    // Keyed on the paths themselves: a new slide should fetch, and the same
    // set should not re-sign on every render.
    queryKey: ["slides_signed", paths],
    queryFn: () => signPaths(paths),
    enabled: paths.length > 0,
    staleTime: SIGN_STALE_MS,
    gcTime: SIGN_STALE_MS,
  });

  return {
    isLoading: paths.length > 0 && isLoading,
    resolve: (url: string) => {
      const path = slidesPathFromUrl(url);
      if (!path) return url;
      return data?.[path] ?? "";
    },
  };
}
