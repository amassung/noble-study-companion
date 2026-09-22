/**
 * What the free tier includes.
 *
 * Nobi's costs scale with AI use, so that is what is metered. Writing,
 * notebooks, pages and imported slides stay unlimited on every plan: they
 * cost essentially nothing to provide, and a student who hits a wall in their
 * first week never reaches the part that is worth paying for.
 *
 * Shared between client and server so the number shown to a student and the
 * number enforced against them cannot drift apart.
 */
export const FREE_AI_ACTIONS_PER_MONTH = 15;

/** The AI actions that draw on the monthly allowance. */
export type AiAction = "study_guide" | "condense" | "transcribe" | "ask";

export const AI_ACTION_LABEL: Record<AiAction, string> = {
  study_guide: "study guide",
  condense: "condensed import",
  transcribe: "handwriting conversion",
  ask: "question",
};

/** Shown when the monthly allowance is spent. */
export function limitReachedMessage(): string {
  return (
    `That's all ${FREE_AI_ACTIONS_PER_MONTH} AI actions for this month. ` +
    `Your notes, notebooks and handwriting stay unlimited — upgrade for unlimited AI.`
  );
}

/**
 * Tag on the error raised when an action is refused for want of allowance, so
 * the client can offer an upgrade rather than apologise for a fault.
 */
export const AI_LIMIT_CODE = "ai_limit_reached";

/** True when a thrown error is the monthly limit rather than a failure. */
export function isAiLimitError(e: unknown): boolean {
  if (!e) return false;
  if (typeof e === "object" && (e as { code?: string }).code === AI_LIMIT_CODE) return true;
  // Server function errors cross the wire as plain messages, losing the code.
  return e instanceof Error && e.message.includes("AI actions for this month");
}
