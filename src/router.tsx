import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { OFFLINE_MAX_AGE } from "./lib/offline/persister";
import { registerOfflineMutationDefaults } from "./lib/offline/mutation-defaults";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Cached data must outlive the session for offline reads to work —
        // the default 5 minute gcTime would evict notes before they could be
        // persisted and restored.
        gcTime: OFFLINE_MAX_AGE,
        // Show cached notes immediately, then refresh in the background.
        staleTime: 30_000,
        retry: 2,
      },
      mutations: {
        // networkMode "online" (the default) pauses mutations while offline
        // and replays them automatically when the connection returns, so
        // edits made in a basement lecture hall are not lost.
        retry: 2,
      },
    },
  });

  // Must run before the persisted cache is restored: hydration builds each
  // restored mutation with whatever mutationFn is registered for its key at
  // that moment. Registering later leaves offline writes permanently stuck
  // with no function to run, so they would never reach the server.
  registerOfflineMutationDefaults(queryClient);

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
