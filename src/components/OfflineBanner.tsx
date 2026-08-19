import { onlineManager, useIsMutating } from "@tanstack/react-query";
import { CloudOff, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Tells the student the truth about their connection.
 *
 * Offline, edits keep working and are queued; this makes that explicit so
 * nobody assumes their lecture notes failed to save. When the connection
 * returns and queued writes are replaying, it shows a syncing state.
 */
export function OfflineBanner() {
  const [online, setOnline] = useState(() => onlineManager.isOnline());
  const [justReconnected, setJustReconnected] = useState(false);
  const pending = useIsMutating();

  useEffect(() => {
    return onlineManager.subscribe((isOnline) => {
      setOnline(isOnline);
      if (isOnline) {
        setJustReconnected(true);
        // Give queued writes a moment to replay before hiding the indicator.
        const t = setTimeout(() => setJustReconnected(false), 4000);
        return () => clearTimeout(t);
      }
    });
  }, []);

  const syncing = online && justReconnected && pending > 0;

  if (online && !syncing) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-20 z-[130] flex justify-center px-4 sm:bottom-6"
    >
      <div
        className={
          syncing
            ? "flex items-center gap-2 rounded-full border border-primary/40 bg-[var(--surface-elevated)] px-3.5 py-2 text-[12.5px] font-medium text-primary shadow-glow"
            : "flex items-center gap-2 rounded-full border border-amber-400/40 bg-[var(--surface-elevated)] px-3.5 py-2 text-[12.5px] font-medium text-amber-300 shadow-card"
        }
      >
        {syncing ? (
          <>
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            Syncing your changes…
          </>
        ) : (
          <>
            <CloudOff className="h-3.5 w-3.5" />
            Offline — your notes are saved on this device and will sync
          </>
        )}
      </div>
    </div>
  );
}
