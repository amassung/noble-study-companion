import { createServerFn } from "@tanstack/react-start";

const MAX_BODY_CHARS = 12_000; // cap before sending to Claude

export type PdfImportResult = {
  title: string;
  body: string;
  totalPages: number;
  truncated: boolean;
};

export type CondenseResult = {
  html: string;
};

// ── Step 1: extract raw text from PDF ────────────────────────────────────
export const importPdf = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { fileBase64: string; filename: string }) => {
      if (!input?.fileBase64 || typeof input.fileBase64 !== "string") {
        throw new Error("Invalid input: fileBase64 required");
      }
      return {
        fileBase64: input.fileBase64,
        filename: (input.filename ?? "").slice(0, 260),
      };
    },
  )
  .handler(async ({ data }): Promise<PdfImportResult> => {
    const { extractText, getMeta, getDocumentProxy } = await import("unpdf");

    // Decode base64 → Uint8Array
    const binaryStr = atob(data.fileBase64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const pdf = await getDocumentProxy(bytes);

    // Infer title: PDF metadata → filename without extension
    let title = "";
    try {
      const meta = await getMeta(pdf);
      title = ((meta.info as Record<string, unknown>)?.Title as string) ?? "";
    } catch {
      // metadata unavailable — fall through to filename
    }
    if (!title.trim()) {
      title = data.filename.replace(/\.pdf$/i, "").trim();
    }

    const { totalPages, text } = await extractText(pdf, { mergePages: true });
    const rawText = (text as string).trim();

    const truncated = rawText.length > MAX_BODY_CHARS;
    const body = truncated ? rawText.slice(0, MAX_BODY_CHARS) : rawText;

    return {
      title: title.slice(0, 300),
      body,
      totalPages,
      truncated,
    };
  });

// ── Step 2: condense raw text into structured HTML via Claude ─────────────
const CONDENSE_SYSTEM = `You are a study assistant. A student has imported a document. Condense it into a clean, scannable summary they can study from.

Return ONLY valid HTML using these tags: <h3>, <p>, <ul>, <li>, <strong>. No other tags. No markdown. No code fences. No preamble or explanation.

Structure:
- A brief <p> overview (2-3 sentences max)
- 3 to 5 thematic <h3> sections, each with a <ul> of concise bullet <li> items
- Highlight key terms with <strong>

Be concise. Summarise, do not transcribe. Aim for 250-400 words total.`;

export const condensePdfContent = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { text: string; sourceTitle: string }) => {
      if (!input?.text || typeof input.text !== "string") {
        throw new Error("Invalid input: text required");
      }
      return {
        text: input.text.slice(0, MAX_BODY_CHARS),
        sourceTitle: (input.sourceTitle ?? "").slice(0, 300),
      };
    },
  )
  .handler(async ({ data }): Promise<CondenseResult> => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

    const model = process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5";

    const userPrompt = [
      data.sourceTitle ? `Document title: ${data.sourceTitle}` : null,
      "",
      "Document text:",
      data.text || "(empty)",
    ]
      .filter((l) => l !== null)
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
        max_tokens: 2048,
        system: CONDENSE_SYSTEM,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (res.status === 429) throw new Error("Rate limit reached. Please try again in a moment.");
    if (res.status === 401 || res.status === 403) throw new Error("Invalid Anthropic API key.");
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      console.error("Anthropic condense error", res.status, t);
      throw new Error("Couldn't condense document. Please try again.");
    }

    const json = (await res.json()) as {
      content?: { type: string; text?: string }[];
    };
    const raw =
      json.content?.find((b) => b.type === "text")?.text ??
      json.content?.[0]?.text ??
      "";

    // Strip any accidental code fences
    const html = raw
      .replace(/^```(?:html)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();

    if (!html) throw new Error("Condense returned empty content. Try again.");

    return { html };
  });
