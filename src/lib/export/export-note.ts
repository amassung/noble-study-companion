import { jsPDF } from "jspdf";

/**
 * Export one note as a PDF.
 *
 * Built from the note's own data rather than by screenshotting the page, so
 * the typed body stays real selectable text — a study sheet you can search,
 * copy from, and that prints sharply. Handwriting cannot be text, so it goes
 * in as an image after the typed content.
 *
 * Until this existed there was no way to get a note out of Nobi at all, which
 * rules the app out anywhere work has to be handed in or printed.
 */

/** Flatten the editor's HTML into plain lines, preserving block structure. */
export function bodyHtmlToLines(html: string): string[] {
  if (!html) return [];
  const doc =
    typeof document !== "undefined"
      ? (() => {
          const el = document.createElement("div");
          el.innerHTML = html;
          return el;
        })()
      : null;
  if (!doc) return [];

  const lines: string[] = [];
  const walk = (node: Element) => {
    for (const child of Array.from(node.children)) {
      const tag = child.tagName.toLowerCase();
      if (tag === "ul" || tag === "ol") {
        Array.from(child.children).forEach((li, i) => {
          const text = (li.textContent ?? "").trim();
          if (text) lines.push(tag === "ol" ? `${i + 1}. ${text}` : `• ${text}`);
        });
        continue;
      }
      if (child.children.length && !["p", "h1", "h2", "h3", "blockquote"].includes(tag)) {
        walk(child);
        continue;
      }
      const text = (child.textContent ?? "").trim();
      if (!text) continue;
      // Headings get a blank line above so the shape survives the flattening.
      if (tag.startsWith("h")) lines.push("", text.toUpperCase());
      else if (tag === "blockquote") lines.push(`"${text}"`);
      else lines.push(text);
    }
  };
  walk(doc);
  return lines;
}

export function exportNoteToPdf({
  title,
  bodyHtml,
  inkImageDataUrl,
  subjectLabel,
}: {
  title: string;
  bodyHtml: string;
  inkImageDataUrl?: string | null;
  subjectLabel?: string;
}): { filename: string; pages: number } {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const PAGE_W = doc.internal.pageSize.getWidth();
  const PAGE_H = doc.internal.pageSize.getHeight();
  const M = 48;
  const CONTENT_W = PAGE_W - M * 2;
  let y = M;

  const noteTitle = title.trim() || "Untitled note";

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(doc.splitTextToSize(noteTitle, CONTENT_W), M, y);
  y += 24;

  if (subjectLabel) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(subjectLabel, M, y);
    doc.setTextColor(0);
    y += 18;
  }

  doc.setDrawColor(210);
  doc.line(M, y, PAGE_W - M, y);
  y += 20;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const LINE_H = 16;

  for (const line of bodyHtmlToLines(bodyHtml)) {
    if (!line) {
      y += LINE_H / 2;
      continue;
    }
    for (const wrapped of doc.splitTextToSize(line, CONTENT_W) as string[]) {
      if (y > PAGE_H - M) {
        doc.addPage();
        y = M;
      }
      doc.text(wrapped, M, y);
      y += LINE_H;
    }
  }

  if (inkImageDataUrl) {
    const props = doc.getImageProperties(inkImageDataUrl);
    // Fit the handwriting to the page without ever enlarging it past 1:1.
    const scale = Math.min(CONTENT_W / props.width, (PAGE_H - M * 2) / props.height, 1);
    const w = props.width * scale;
    const h = props.height * scale;
    doc.addPage();
    y = M;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Handwriting", M, y);
    y += 16;
    doc.addImage(inkImageDataUrl, "PNG", M, y, w, h);
  }

  const filename = `${
    noteTitle
      .replace(/[^\w\s-]/g, "")
      .trim()
      .slice(0, 60) || "note"
  }.pdf`;
  doc.save(filename);
  return { filename, pages: doc.getNumberOfPages() };
}
