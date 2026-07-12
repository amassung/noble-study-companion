import { createServerFn } from "@tanstack/react-start";
import { requireUser } from "@/lib/supabase/require-user.server";

export type StudyGuide = {
  title: string;
  keyConcepts: { heading: string; explanation: string }[];
  importantTerms: { term: string; definition: string }[];
  practiceQuestions: { question: string; answer: string }[];
};

const SYSTEM = `You are Nobi, a study assistant for college students. Given a student's raw notes, produce a focused, exam-ready study guide.

Return ONLY valid JSON matching this exact shape (no markdown, no commentary):

{
  "title": "string — a short title for the study guide",
  "keyConcepts": [{ "heading": "string", "explanation": "string (2-3 sentences)" }],
  "importantTerms": [{ "term": "string", "definition": "string (one sentence)" }],
  "practiceQuestions": [{ "question": "string", "answer": "string (1-3 sentences)" }]
}

Rules:
- 3 to 5 items in each array.
- Clear, plain English. No filler. No emojis.
- If the notes are sparse, infer reasonable adjacent concepts a student would need.`;

function tryParse(raw: string): StudyGuide | null {
  // Strip code fences if the model added them anyway
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned) as StudyGuide;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as StudyGuide;
      } catch {
        return null;
      }
    }
    return null;
  }
}

export const generateStudyGuide = createServerFn({ method: "POST" })
  .inputValidator((input: { title: string; body: string; subjectLabel?: string }) => {
    if (!input || typeof input.body !== "string") {
      throw new Error("Invalid input");
    }
    return {
      title: (input.title ?? "").slice(0, 300),
      body: input.body.slice(0, 12_000),
      subjectLabel: (input.subjectLabel ?? "").slice(0, 80),
    };
  })
  .handler(async ({ data }): Promise<StudyGuide> => {
    await requireUser();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

    const model = process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5";

    const userPrompt = [
      data.subjectLabel ? `Subject: ${data.subjectLabel}` : null,
      data.title ? `Note title: ${data.title}` : null,
      "",
      "Notes:",
      data.body || "(empty)",
    ]
      .filter(Boolean)
      .join("\n");

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: SYSTEM,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (res.status === 429) {
      throw new Error("Rate limit reached. Please try again in a moment.");
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error("Invalid Anthropic API key. Check ANTHROPIC_API_KEY in .env.local.");
    }
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      console.error("Anthropic API error", res.status, t);
      throw new Error("Couldn't generate study guide. Please try again.");
    }

    const json = (await res.json()) as {
      content?: { type: string; text?: string }[];
    };
    const content =
      json.content?.find((block) => block.type === "text")?.text ?? json.content?.[0]?.text ?? "";
    const parsed = tryParse(content);
    if (!parsed) {
      console.error("AI returned non-JSON content", content.slice(0, 500));
      throw new Error("The study guide came back in an unexpected format. Try again.");
    }

    // Defensive shape coercion
    return {
      title: String(parsed.title ?? data.title ?? "Study Guide"),
      keyConcepts: Array.isArray(parsed.keyConcepts) ? parsed.keyConcepts.slice(0, 6) : [],
      importantTerms: Array.isArray(parsed.importantTerms) ? parsed.importantTerms.slice(0, 8) : [],
      practiceQuestions: Array.isArray(parsed.practiceQuestions)
        ? parsed.practiceQuestions.slice(0, 6)
        : [],
    };
  });
