import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireUser } from "@/lib/supabase/require-user.server";

/**
 * Permanently delete the signed-in user's account and all their data.
 *
 * Required by Apple App Store guideline 5.1.1(v) — any app with account
 * creation must offer in-app account deletion.
 *
 * Auth users can only be deleted with the service-role key, so this runs
 * server-side: verify the caller's session, best-effort remove their
 * uploaded slide images, then delete the auth user. All database rows
 * (notes, notebooks, guides, annotations, boxes) cascade from auth.users.
 */
export const deleteAccount = createServerFn({ method: "POST" }).handler(async () => {
  const user = await requireUser();

  const url = import.meta.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Account deletion is not configured on the server.");
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Best-effort: remove uploaded slide images (storage does not cascade).
  // Paths are {userId}/{noteId}/{file}; list two levels then remove.
  try {
    const { data: folders } = await admin.storage.from("slides").list(user.id, { limit: 1000 });
    const paths: string[] = [];
    for (const folder of folders ?? []) {
      const { data: files } = await admin.storage
        .from("slides")
        .list(`${user.id}/${folder.name}`, { limit: 1000 });
      for (const f of files ?? []) paths.push(`${user.id}/${folder.name}/${f.name}`);
    }
    if (paths.length > 0) await admin.storage.from("slides").remove(paths);
  } catch (err) {
    console.error("Slide cleanup during account deletion failed (continuing):", err);
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.error("Account deletion failed:", error);
    throw new Error("Couldn't delete your account. Please try again.");
  }

  return { ok: true };
});
