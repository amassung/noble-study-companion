import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { del, get, set } from "idb-keyval";

// IndexedDB, not localStorage: note bodies (and imported slide HTML) easily
// exceed localStorage's ~5MB cap, and blowing that cap throws mid-write and
// would corrupt the cached copy of a student's notes.
const IDB_KEY = "nobi-query-cache";

export function createNobiPersister() {
  return createAsyncStoragePersister({
    key: IDB_KEY,
    storage: {
      getItem: (key) => get(key),
      setItem: (key, value) => set(key, value),
      removeItem: (key) => del(key),
    },
    // Writing on every keystroke-driven cache update would thrash IndexedDB.
    throttleTime: 1000,
  });
}

/** Remove the on-disk cache (used on sign-out so notes don't linger). */
export async function clearOfflineCache(): Promise<void> {
  try {
    await del(IDB_KEY);
  } catch {
    // IndexedDB unavailable (private mode) — nothing was persisted anyway
  }
}

// Bump when the cached shape changes so stale caches are discarded rather
// than deserialised into the wrong types.
export const OFFLINE_CACHE_BUSTER = "v1";

// Keep cached data for a week so a student who opens the app offline after a
// weekend still sees their notes.
export const OFFLINE_MAX_AGE = 1000 * 60 * 60 * 24 * 7;
