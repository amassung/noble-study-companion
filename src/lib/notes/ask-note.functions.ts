import { createServerFn } from "@tanstack/react-start";
import { requireUser } from "@/lib/supabase/require-user.server";
import { anthropicHeaders, anthropicError } from "@/lib/ai/anthropic.server";

/**
 * Answer a student's question about one of their own notes.
 *
 * Deliberately grounded: the model is told to answer from the note and to say
 * plainly when the note does not cover something. A study tool that invents a
 * confident answer is worse than useless the night before an exam — the
 * student has no way to tell the invention from their own material.
 */
const SYSTEM = `You are Nobi, a study assistant helping a college student understand their own lecture notes.

Answer the student's question using the notes provided. Rules:
- Ground every claim in the notes. Quote or reference the relevant part when useful.
- If the notes do not contain the answer, say so directly, then you may add clearly-labelled general context beginning with "Not in your notes:".
- Never invent specifics (dates, numbers, definitions, names) that are absent from the notes.
- Be concise: a few sentences, or a short list. This is revision, not an essay.
- Plain text only. No markdown headings or code fences.`;

export const askNote = createServerFn({ method: "POST" })
  .inputValidator((input: { question: string; title: string; body: string }) => {
    if (!input || typeof input.question !== "string" || !input.question.trim()) {
      throw new Error("Ask a question first.");
    }
    return {
      question: input.question.slice(0, 1_000),
      title: (input.title ?? "").slice(0, 300),
      body: (input.body ?? "").slice(0, 12_000),
    };
  })
  .handler(async ({ data }): Promise<{ answer: string }> => {
    await requireUser();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");
    const model = process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5";

    const userPrompt = [
      data.title ? `Note title: ${data.title}` : null,
      "",
      "Notes:",
      data.body || "(the note is empty)",
      "",
      `Question: ${data.question}`,
    ]
      .filter(Boolean)
      .join("\n");

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: anthropicHeaders(apiKey),
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        system: SYSTEM,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });
    if (!res.ok) throw await anthropicError(res, "Couldn't answer that. Please try again.");

    const json = (await res.json()) as { content?: { type: string; text?: string }[] };
    const answer =
      json.content?.find((b) => b.type === "text")?.text ?? json.content?.[0]?.text ?? "";
    if (!answer.trim()) throw new Error("Came back empty. Please try again.");
    return { answer: answer.trim() };
  });
