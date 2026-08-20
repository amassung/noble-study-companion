import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth/auth-provider";
import { OFFLINE_MUTATION_KEYS } from "@/lib/offline/mutation-defaults";
import { fetchCardProgress, saveCardProgress } from "./cards-api";
import type { CardProgress } from "./cards";

export function cardProgressKey(userId: string | undefined) {
  return ["card_progress", userId] as const;
}

export function useCardProgress() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: cardProgressKey(user?.id),
    queryFn: fetchCardProgress,
    enabled: Boolean(user?.id),
    staleTime: 60_000,
  });

  const byKey = new Map<string, CardProgress>();
  for (const p of query.data ?? []) byKey.set(p.cardKey, p);
  return { ...query, byKey };
}

export function useReviewCardMutation() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    // Keyed so a review done offline replays after reconnect/restart.
    mutationKey: OFFLINE_MUTATION_KEYS.reviewCard,
    mutationFn: (progress: CardProgress) => saveCardProgress(progress),
    // Optimistic: the schedule must update instantly, and must survive
    // offline — a student reviewing on the bus should keep their streak.
    onMutate: (progress) => {
      const key = cardProgressKey(user?.id);
      const prev = qc.getQueryData<CardProgress[]>(key) ?? [];
      const next = prev.filter(
        (p) => !(p.cardKey === progress.cardKey && p.noteId === progress.noteId),
      );
      qc.setQueryData<CardProgress[]>(key, [...next, progress]);
      return { prev };
    },
    // While offline the mutation pauses (and replays later) rather than
    // erroring, so reaching here means a real server failure — say so instead
    // of letting a review silently vanish from the student's schedule.
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(cardProgressKey(user?.id), ctx.prev);
      toast.error("Couldn't save that review — your schedule may be out of date.");
    },
  });
}
