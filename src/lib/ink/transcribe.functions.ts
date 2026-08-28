import { createServerFn } from "@tanstack/react-start";
import { requireUser } from "@/lib/supabase/require-user.server";

/**
 * Read a page of handwriting back as text.
 *
 * Until this existed, a student who wrote by hand had no way into the study
 * half of the app: study guides, flashcards, search and the Learn sheet all
 * read the typed body, and a page covered in ink counted as empty. Handing the
 * rendered page to a vision model turns that ink into ordinary note text.
 *
 * The prompt forbids tidying, because a transcript that "improves" a lecture
 * note is worse than one with gaps — the student cannot tell which parts are
 * theirs. Unreadable words come back marked rather than guessed.
 */
const SYSTEM = `You transcribe a student's handwritten lecture notes from an image.

Rules:
- Transcribe what is written, in reading order. Do not summarise, correct, reword or add anything.
- Keep the student's own abbreviations, arrows and shorthand as written.
- Preserve line and list structure with plain line breaks. Use "- " for bulleted items.
- Where a word is genuinely illegible, write [?] in its place. Never guess at a term.
- If the image contains no handwriting at all, return exactly: (no handwriting found)
- Return only the transcription. No preamble, no commentary, no markdown fences.`;

export const transcribeHandwriting = createServerFn({ method: "POST" })
  .inputValidator((input: { imageBase64: string; mediaType?: string }) => {
    if (!input || typeof input.imageBase64 !== "string" || !input.imageBase64) {
      throw new Error("No page image to read.");
    }
    // Base64 inflates by ~4/3; keep well inside the API's per-image ceiling.
    if (input.imageBase64.length > 7_000_000) {
      throw new Error("That page is too large to read in one go.");
    }
    const mediaType = input.mediaType === "image/jpeg" ? "image/jpeg" : "image/png";
    return { imageBase64: input.imageBase64, mediaType };
  })
  .handler(async ({ data }): Promise<{ text: string }> => {
    await requireUser();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");
    const model = process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5";

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        system: SYSTEM,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: data.mediaType, data: data.imageBase64 },
              },
              { type: "text", text: "Transcribe the handwriting on this page." },
            ],
          },
        ],
      }),
    });

    if (res.status === 429) throw new Error("Rate limit reached. Try again in a moment.");
    if (res.status === 401 || res.status === 403) {
      throw new Error("Invalid Anthropic API key. Check ANTHROPIC_API_KEY.");
    }
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      console.error("Anthropic API error", res.status, t);
      throw new Error("Couldn't read that page. Please try again.");
    }

    const json = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text =
      json.content?.find((b) => b.type === "text")?.text ?? json.content?.[0]?.text ?? "";
    const trimmed = text.trim();
    if (!trimmed || trimmed === "(no handwriting found)") {
      throw new Error("No handwriting found on this page.");
    }
    return { text: trimmed };
  });
