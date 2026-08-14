import type { Session, User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { migrateLocalNotesIfNeeded } from "@/lib/notes/migrate-local-notes";
import { notesQueryKey } from "@/lib/notes/use-notes";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  configError: string | null;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const configError = useMemo(
    () =>
      isSupabaseConfigured()
        ? null
        : "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local.",
    [],
  );

  useEffect(() => {
    if (configError) {
      setLoading(false);
      return;
    }

    const supabase = getSupabaseClient();
    let cancelled = false;

    const applySession = async (next: Session | null) => {
      setSession(next);
      setUser(next?.user ?? null);

      if (next?.user) {
        try {
          await migrateLocalNotesIfNeeded(next.user.id);
          void queryClient.invalidateQueries({ queryKey: notesQueryKey(next.user.id) });
        } catch (err) {
          console.error("Failed to migrate local notes:", err);
        }
      }
    };

    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      void applySession(data.session).finally(() => {
        if (!cancelled) setLoading(false);
      });
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void applySession(nextSession);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [configError, queryClient]);

  const signOut = useCallback(async () => {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo(
    () => ({
      user,
      session,
      loading,
      configError,
      signOut,
    }),
    [user, session, loading, configError, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
