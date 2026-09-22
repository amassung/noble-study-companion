import { createClient } from "@supabase/supabase-js";
import {
  AI_LIMIT_CODE,
  FREE_AI_ACTIONS_PER_MONTH,
  limitReachedMessage,
  type AiAction,
} from "./plan";

/**
 * Record an AI action against a user's monthly allowance, or refuse it.
 *
 * Called on the server before anything is spent with Anthropic. Enforcing in
 * the client would be decoration: the server functions are reachable
 * directly, so a limit that only lives in the UI is not a limit.
 *
 * The count and the insert happen inside one database function, so two
 * requests in flight together cannot both pass the same check — a
 * double-tapped button should not buy a free action.
 *
 * Two different failures, handled in opposite directions, on purpose:
 *
 * - A refusal — the student has genuinely used their allowance — blocks. That
 *   is the feature.
 * - A fault in the meter itself — the function not yet migrated, the service
 *   key missing, the database unreachable — lets the action through and logs
 *   loudly. Billing must never be the thing that stops a student generating a
 *   study guide the night before an exam. The exposure is a few cents of
 *   unmetered use until someone reads the log; the alternative is every AI
 *   feature down for everyone over a configuration mistake.
 *
 * Returns the number of actions used this month including this one, or null
 * when the meter could not be read and the action was allowed through.
 */
export async function consumeAiAction(userId: string, action: AiAction): Promise<number | null> {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error(
      "[billing] metering unavailable: SUPABASE_SERVICE_ROLE_KEY is not set. " +
        `Allowing ${action} for ${userId} unmetered.`,
    );
    return null;
  }

  let used: number;
  try {
    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await admin.rpc("consume_ai_action", {
      p_user_id: userId,
      p_action: action,
      p_limit: FREE_AI_ACTIONS_PER_MONTH,
    });
    if (error) throw error;
    used = typeof data === "number" ? data : Number(data);
    if (!Number.isFinite(used)) throw new Error(`meter returned ${String(data)}`);
  } catch (e) {
    console.error(
      `[billing] metering failed, allowing ${action} for ${userId} unmetered:`,
      e instanceof Error ? e.message : e,
    );
    return null;
  }

  // Deliberately outside the try: this is a decision, not a fault, and must
  // not be swallowed by the fail-open handling above.
  if (used === -1) {
    const refusal = new Error(limitReachedMessage());
    (refusal as Error & { code?: string }).code = AI_LIMIT_CODE;
    throw refusal;
  }
  return used;
}
