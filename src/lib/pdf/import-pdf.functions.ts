import { createServerFn } from "@tanstack/react-start";

const MAX_BODY_CHARS = 12_000; // matches generateStudyGuide cap

export type PdfImportResult = {
  title: string;
  body: string;
  totalPages: number;
  truncated: boolean;
};

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

    // Get PDF proxy once — reuse for both meta and text
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

    // Extract text, joining all pages
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
