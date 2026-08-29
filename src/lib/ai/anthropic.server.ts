/**
 * Shared Anthropic request plumbing.
 *
 * Exists because the same headers and the same error mapping were written out
 * three times — study guides, note Q&A and handwriting transcription — and a
 * fix in one did not reach the others.
 */

export function anthropicHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
    "content-type": "application/json",
  };
  // An identity-linked key (one tied to a user rather than a workspace) is
  // rejected outright unless it says which workspace the call acts in. Keys
  // scoped to a workspace need no such header, so this stays optional.
  const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID;
  if (workspaceId) headers["anthropic-workspace-id"] = workspaceId;
  return headers;
}

/**
 * Turn a failed Anthropic response into an error worth showing.
 *
 * The previous mapping collapsed everything that was not 429/401/403 into a
 * generic "please try again", which hid a 400 that said exactly what was
 * wrong — the caller was told the key was invalid when the key was fine.
 */
export async function anthropicError(res: Response, fallback: string): Promise<Error> {
  const body = await res.text().catch(() => "");
  let apiMessage = "";
  try {
    apiMessage = (JSON.parse(body) as { error?: { message?: string } })?.error?.message ?? "";
  } catch {
    /* not JSON — fall through to the generic message */
  }

  if (res.status === 429) return new Error("Rate limit reached. Try again in a moment.");
  if (res.status === 401 || res.status === 403) {
    return new Error(
      apiMessage
        ? `Anthropic rejected the API key: ${apiMessage}`
        : "Invalid Anthropic API key. Check ANTHROPIC_API_KEY.",
    );
  }
  if (res.status === 400 && apiMessage) {
    // Surfaced verbatim: these say precisely what to change (a missing
    // workspace id, an unknown model, an oversized image).
    return new Error(apiMessage);
  }
  console.error("Anthropic API error", res.status, body.slice(0, 500));
  return new Error(fallback);
}
