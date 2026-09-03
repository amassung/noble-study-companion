/**
 * Pull the text out of a PDF in the browser.
 *
 * This used to be a server function: the whole file was base64-encoded and
 * POSTed for parsing. That works in dev and fails in production, because a
 * serverless request body is capped at 4.5 MB and base64 inflates a file by a
 * third — so any deck past roughly 3.4 MB was rejected before the handler ran
 * and surfaced as "failed to read PDF". A lecture deck is routinely bigger
 * than that.
 *
 * pdf.js is already loaded on the client to rasterise slides, so parsing here
 * costs nothing extra, removes the ceiling entirely, and skips a round trip
 * that was uploading megabytes to learn a few kilobytes of text.
 */

const MAX_BODY_CHARS = 12_000; // cap before any of this reaches Claude

export interface ExtractedPdf {
  title: string;
  body: string;
  totalPages: number;
  truncated: boolean;
}

export async function extractPdfText(file: File): Promise<ExtractedPdf> {
  const [pdfjs, { default: workerSrc }] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc as string;

  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;

  // Prefer the document's own title; fall back to the filename.
  let title = "";
  try {
    const meta = await pdf.getMetadata();
    title = ((meta.info as Record<string, unknown>)?.Title as string) ?? "";
  } catch {
    // Metadata is optional and often absent — the filename is fine.
  }
  if (!title.trim()) title = file.name.replace(/\.pdf$/i, "").trim();

  // Stop once there is more text than will ever be sent onward: a 300-page
  // course pack should not be fully parsed to fill a 12k-char budget.
  const parts: string[] = [];
  let chars = 0;
  for (let i = 1; i <= pdf.numPages && chars < MAX_BODY_CHARS; i++) {
    const content = await (await pdf.getPage(i)).getTextContent();
    const pageText = content.items
      .map((it) => (typeof it === "object" && it && "str" in it ? String(it.str) : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (!pageText) continue;
    parts.push(pageText);
    chars += pageText.length;
  }

  const rawText = parts.join("\n\n").trim();
  const truncated = rawText.length > MAX_BODY_CHARS;

  return {
    title: title.slice(0, 300),
    body: truncated ? rawText.slice(0, MAX_BODY_CHARS) : rawText,
    totalPages: pdf.numPages,
    truncated,
  };
}
