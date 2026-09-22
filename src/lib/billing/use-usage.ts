import { useQuery } from "@tanstack/react-query";
import { getSupabaseClient } from "@/lib/supabase/client";
import { FREE_AI_ACTIONS_PER_MONTH } from "./plan";

export const aiUsageKey = ["ai_usage", "month"] as const;

/**
 * Start of the current metering month, in UTC.
 *
 * The database resets the allowance at date_trunc('month', now()), and now()
 * there is UTC. Counting from local midnight instead would put the two out of
 * step for everyone west of Greenwich: on the evening of the 31st in
 * California it is already the 1st in UTC, the server has reset, and a
 * student would be shown an allowance that no longer applies.
 */
export function meteringMonthStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export interface AiUsage {
  used: number;
  limit: number;
  pro: boolean;
  /** Actions left this month, or Infinity on a paid plan. */
  remaining: number;
}

/**
 * This month's AI usage for the signed-in student.
 *
 * Read-only and advisory: the number that counts is enforced on the server.
 * This exists so a student can see the limit coming instead of hitting it in
 * the middle of revising.
 */
export function useAiUsage() {
  return useQuery({
    queryKey: aiUsageKey,
    queryFn: async (): Promise<AiUsage> => {
      const supabase = getSupabaseClient();
      const since = meteringMonthStart().toISOString();

      // Row-level security scopes both reads to the caller.
      const [{ count, error }, { data: ent }] = await Promise.all([
        supabase
          .from("ai_usage")
          .select("id", { count: "exact", head: true })
          .gte("created_at", since),
        supabase.from("entitlements").select("plan, current_period_end").maybeSingle(),
      ]);
      if (error) throw error;

      const pro =
        ent?.plan === "pro" &&
        (!ent.current_period_end || new Date(ent.current_period_end) > new Date());
      const used = count ?? 0;
      return {
        used,
        limit: FREE_AI_ACTIONS_PER_MONTH,
        pro,
        remaining: pro ? Infinity : Math.max(0, FREE_AI_ACTIONS_PER_MONTH - used),
      };
    },
    staleTime: 30_000,
  });
}
