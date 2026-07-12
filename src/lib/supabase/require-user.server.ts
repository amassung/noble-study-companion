import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { getRequest } from "@tanstack/react-start/server";

// Server-side auth guard for server functions. Reads the Supabase auth
// cookies off the incoming request and validates the session with
// supabase.auth.getUser() (which verifies the JWT against Supabase).
// Throws if the caller is not signed in — call this first in every
// handler that spends money or touches user data.
export async function requireUser(): Promise<User> {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Supabase is not configured on the server");
  }

  const request = getRequest();
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookies = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const eq = part.indexOf("=");
      return {
        name: decodeURIComponent(part.slice(0, eq)),
        value: decodeURIComponent(part.slice(eq + 1)),
      };
    });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookies,
      // Server functions don't need to refresh/set cookies; the browser
      // client owns the session lifecycle.
      setAll: () => {},
    },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error("You must be signed in to use this feature.");
  }
  return user;
}
