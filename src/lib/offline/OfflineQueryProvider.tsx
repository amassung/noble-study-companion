import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { useState, type ReactNode } from "react";
import { createNobiPersister, OFFLINE_CACHE_BUSTER, OFFLINE_MAX_AGE } from "./persister";

/**
 * Provides the query client with offline persistence.
 *
 * On the server there is no IndexedDB, so we fall back to the plain provider
 * and let the client take over after hydration.
 */
export function OfflineQueryProvider({
  queryClient,
  children,
}: {
  queryClient: QueryClient;
  children: ReactNode;
}) {
  const isBrowser = typeof window !== "undefined";

  // Dev-only handle for inspecting cache/mutation state from the console.
  if (isBrowser && import.meta.env.DEV) {
    (window as unknown as Record<string, unknown>).__nobiQueryClient = queryClient;
  }

  // Created once, lazily, and only in the browser.
  const [persister] = useState(() => (isBrowser ? createNobiPersister() : null));

  if (!isBrowser || !persister) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: OFFLINE_MAX_AGE,
        buster: OFFLINE_CACHE_BUSTER,
      }}
      onSuccess={() => {
        // The cache — including any writes paused while offline, possibly in
        // an earlier app session — has been restored. Replay them now.
        // (Their mutationFns are registered in getRouter, before restore.)
        void queryClient.resumePausedMutations();
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
