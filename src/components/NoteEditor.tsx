import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { Underline } from "@tiptap/extension-underline";
import { Highlight } from "@tiptap/extension-highlight";
import { TextStyle, FontSize } from "@tiptap/extension-text-style";
import { Image } from "@tiptap/extension-image";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Check,
  Trash2,
  Sparkles,
  Loader2,
  CalendarClock,
  X as XIcon,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Highlighter,
  Heading1,
  Heading2,
  Heading3,
  FileUp,
  FileText,
  GalleryHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { formatRelative, formatTestCountdown } from "@/lib/notes/format";
import {
  useDeleteNoteMutation,
  useNotes,
  useNotesList,
  useDeleteGuideMutation,
  useSetTestDateMutation,
  useUpdateNoteMutation,
  type SavedGuide,
  type StoredNote,
} from "@/lib/notes/use-notes";
import { importPdf, condensePdfContent } from "@/lib/pdf/import-pdf.functions";
import { StudyGuideModal } from "@/components/StudyGuideModal";
import type { StudyGuide } from "@/lib/study-guide.functions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

const FONT_SIZES = [
  { label: "Small", value: "0.85em" },
  { label: "Normal", value: "" },
  { label: "Large", value: "1.25em" },
  { label: "Huge", value: "1.6em" },
] as const;

const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10 MB client-side guard
const MAX_SLIDE_PAGES = 20; // cap to keep data-URL sizes reasonable

// ── Types ─────────────────────────────────────────────────────────────────
type Props = {
  noteId: string;
  onClose: () => void;
};

type PdfPhase = "extracting" | "awaiting-choice" | "condensing" | "rendering" | null;

type PendingPdf = {
  title: string;
  body: string;
  totalPages: number;
  file: File;
  hasText: boolean;
};

const SUBJECTS: { value: StoredNote["subject"]; label: string; dot: string }[] = [
  { value: "violet", label: "Philosophy", dot: "bg-primary" },
  { value: "blue", label: "Biology", dot: "bg-sky-400" },
  { value: "green", label: "Economics", dot: "bg-emerald-400" },
  { value: "amber", label: "History", dot: "bg-amber-400" },
];

// ── Client-side PDF → images ───────────────────────────────────────────────
async function renderPdfToImages(file: File): Promise<string[]> {
  // Lazy-load pdfjs-dist so it doesn't bloat the initial bundle
  const [pdfjs, { default: workerSrc }] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);

  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc as string;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

  const pageCount = Math.min(pdf.numPages, MAX_SLIDE_PAGES);
  const images: string[] = [];

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    // Scale 1.4 — good balance of readability vs. data-URL size
    const viewport = page.getViewport({ scale: 1.4 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;
    await page.render({ canvasContext: ctx as unknown as CanvasRenderingContext2D, viewport }).promise;
    images.push(canvas.toDataURL("image/jpeg", 0.72));
  }

  return images;
}

// ── Toolbar ───────────────────────────────────────────────────────────────
function ToolbarBtn({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault(); // keep editor focus
        onClick();
      }}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={cn(
        "flex min-h-[36px] min-w-[36px] items-center justify-center rounded-md text-[13px] font-semibold transition-colors",
        active
          ? "bg-primary/15 text-primary ring-1 ring-inset ring-primary/25"
          : "text-muted-foreground hover:bg-white/[0.05] hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <span className="mx-0.5 h-5 w-px shrink-0 rounded-full bg-border/60" />;
}

function Toolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null;

  const activeFontSize =
    (editor.getAttributes("textStyle").fontSize as string | undefined) ?? "";

  const handleFontSize = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (!val) {
      editor.chain().focus().unsetFontSize().run();
    } else {
      editor.chain().focus().setFontSize(val).run();
    }
  };

  return (
    <div
      className="sticky top-[57px] z-10 flex flex-wrap items-center gap-0.5 border-b border-border/40 bg-[var(--surface-elevated)]/95 px-3 py-1.5 backdrop-blur-sm sm:px-5"
      onMouseDown={(e) => e.preventDefault()}
    >
      <ToolbarBtn
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Bold"
      >
        <Bold className="h-3.5 w-3.5" strokeWidth={2.5} />
      </ToolbarBtn>
      <ToolbarBtn
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Italic"
      >
        <Italic className="h-3.5 w-3.5" strokeWidth={2.5} />
      </ToolbarBtn>
      <ToolbarBtn
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        title="Underline"
      >
        <UnderlineIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
      </ToolbarBtn>

      <ToolbarDivider />

      <ToolbarBtn
        active={editor.isActive("heading", { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        title="Heading 1"
      >
        <Heading1 className="h-4 w-4" strokeWidth={2} />
      </ToolbarBtn>
      <ToolbarBtn
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        title="Heading 2"
      >
        <Heading2 className="h-4 w-4" strokeWidth={2} />
      </ToolbarBtn>
      <ToolbarBtn
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        title="Heading 3"
      >
        <Heading3 className="h-4 w-4" strokeWidth={2} />
      </ToolbarBtn>

      <ToolbarDivider />

      <ToolbarBtn
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        title="Bullet list"
      >
        <List className="h-4 w-4" strokeWidth={2} />
      </ToolbarBtn>
      <ToolbarBtn
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        title="Numbered list"
      >
        <ListOrdered className="h-4 w-4" strokeWidth={2} />
      </ToolbarBtn>

      <ToolbarDivider />

      <ToolbarBtn
        active={editor.isActive("highlight")}
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        title="Highlight"
      >
        <Highlighter className="h-3.5 w-3.5" strokeWidth={2} />
      </ToolbarBtn>

      <ToolbarDivider />

      <select
        value={activeFontSize}
        onChange={handleFontSize}
        title="Font size"
        aria-label="Font size"
        className="h-[36px] cursor-pointer rounded-md border border-border/60 bg-[var(--surface)] px-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground focus:outline-none"
      >
        {FONT_SIZES.map((s) => (
          <option key={s.label} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────
export function NoteEditor({ noteId, onClose }: Props) {
  const { isLoading } = useNotesList();
  const allNotes = useNotes();
  const liveNote = allNotes.find((n) => n.id === noteId);
  const updateMutation = useUpdateNoteMutation();
  const deleteMutation = useDeleteNoteMutation();
  const setTestDateMutation = useSetTestDateMutation();
  const callImportPdf = useServerFn(importPdf);
  const callCondense = useServerFn(condensePdfContent);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [subject, setSubject] = useState<StoredNote["subject"]>("violet");
  const [subjectLabel, setSubjectLabel] = useState("Philosophy");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("saved");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [viewGuide, setViewGuide] = useState<StudyGuide | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [pdfPhase, setPdfPhase] = useState<PdfPhase>(null);
  const [pendingPdf, setPendingPdf] = useState<PendingPdf | null>(null);

  const savedGuides: SavedGuide[] = liveNote?.guides ?? [];
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ── Tiptap editor ──────────────────────────────────────────────────────
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Highlight,
      TextStyle,
      FontSize,
      Image.configure({ allowBase64: true, inline: false }),
    ],
    content: "",
    editorProps: {
      attributes: {
        class: "tiptap",
        "data-placeholder": "Start writing your notes here…",
      },
    },
    onUpdate: ({ editor: e }) => {
      setBody(e.getHTML());
    },
  });

  // ── Hydration: populate editor once per noteId ─────────────────────────
  useEffect(() => {
    setHydrated(false);
  }, [noteId]);

  useEffect(() => {
    if (!liveNote || hydrated || !editor) return;
    setTitle(liveNote.title);
    setSubject(liveNote.subject);
    setSubjectLabel(
      liveNote.subjectLabel ?? SUBJECTS.find((s) => s.value === liveNote.subject)!.label,
    );
    editor.commands.setContent(liveNote.body || "", false);
    setBody(liveNote.body || "");
    setHydrated(true);
  }, [liveNote, hydrated, editor]);

  // Focus title on open
  useEffect(() => {
    if (!hydrated) return;
    if (!liveNote?.title) {
      editor?.commands.focus("end");
    } else {
      titleRef.current?.focus();
    }
  }, [hydrated, liveNote?.title, editor]);

  // Lock body scroll while editor is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Escape to close (but not when choice modal is open)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && pdfPhase !== "awaiting-choice") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, pdfPhase]);

  // ── Debounced save ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!hydrated) return;
    setStatus("saving");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateMutation.mutate(
        { id: noteId, patch: { title, body, subject, subjectLabel } },
        { onSettled: () => setStatus("saved") },
      );
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [title, body, subject, subjectLabel, noteId, hydrated, updateMutation]);

  // Flush save on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (hydrated) {
        updateMutation.mutate({ id: noteId, patch: { title, body, subject, subjectLabel } });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading || !hydrated) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!liveNote) return null;

  const handleDelete = () => {
    deleteMutation.mutate(noteId, { onSuccess: onClose });
  };

  // ── PDF extraction (phase 1 of import) ────────────────────────────────
  const handlePdfFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (file.size > MAX_PDF_BYTES) {
      toast.error(
        `PDF too large (max 10 MB). This file is ${(file.size / 1024 / 1024).toFixed(1)} MB.`,
      );
      return;
    }

    try {
      setPdfPhase("extracting");

      const fileBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1] ?? result);
        };
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });

      const extracted = await callImportPdf({ data: { fileBase64, filename: file.name } });

      // Show choice modal — user decides what to do with the content
      setPendingPdf({
        title: extracted.title || file.name.replace(/\.pdf$/i, ""),
        body: extracted.body,
        totalPages: extracted.totalPages,
        file,
        hasText: extracted.body.trim().length > 0,
      });
      setPdfPhase("awaiting-choice");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to read PDF. Try again.");
      setPdfPhase(null);
    }
  };

  // ── Import choice handlers ─────────────────────────────────────────────
  const dismissChoice = () => {
    setPendingPdf(null);
    setPdfPhase(null);
  };

  const insertIntoEditor = (html: string, pdfTitle: string) => {
    if (!editor) return;
    const separator = editor.isEmpty ? "" : "<p></p>";
    editor.chain().focus("end").insertContent(`${separator}${html}`).run();
    setBody(editor.getHTML());
    if (!title.trim()) setTitle(pdfTitle);
  };

  const handleImportRaw = () => {
    if (!pendingPdf) return;
    const sourceLabel = pendingPdf.title;
    // Convert plain text line-breaks to paragraph HTML
    const paragraphs = pendingPdf.body
      .split(/\n{2,}/)
      .map((p) => `<p>${p.replace(/\n/g, " ").trim()}</p>`)
      .filter((p) => p !== "<p></p>")
      .join("");
    insertIntoEditor(`<h2>📄 ${sourceLabel}</h2>${paragraphs || "<p></p>"}`, sourceLabel);
    toast.success(
      `Imported "${sourceLabel}" · ${pendingPdf.totalPages} page${pendingPdf.totalPages !== 1 ? "s" : ""}`,
    );
    dismissChoice();
  };

  const handleImportCondense = async () => {
    if (!pendingPdf) return;
    setPdfPhase("condensing");
    try {
      const condensed = await callCondense({
        data: { text: pendingPdf.body, sourceTitle: pendingPdf.title },
      });
      const sourceLabel = pendingPdf.title;
      insertIntoEditor(`<h2>📄 ${sourceLabel}</h2>${condensed.html}`, sourceLabel);
      toast.success(
        `Condensed "${sourceLabel}" · ${pendingPdf.totalPages} page${pendingPdf.totalPages !== 1 ? "s" : ""}`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't condense document. Try again.");
    } finally {
      dismissChoice();
    }
  };

  const handleImportSlides = async () => {
    if (!pendingPdf) return;
    setPdfPhase("rendering");
    try {
      const images = await renderPdfToImages(pendingPdf.file);
      const sourceLabel = pendingPdf.title;
      const renderedCount = images.length;
      const truncated = pendingPdf.totalPages > MAX_SLIDE_PAGES;

      // Build slides HTML: pages stacked vertically, gap handled by CSS margin-bottom on img
      const slidesHtml = images
        .map((src, idx) => `<img src="${src}" alt="Slide ${idx + 1}" />`)
        .join("");
      // Trailing paragraph so the cursor lands somewhere typeable after the last slide
      const trailingP = "<p></p>";

      const truncatedNote = truncated
        ? `<p><em>Showing first ${MAX_SLIDE_PAGES} of ${pendingPdf.totalPages} pages.</em></p>`
        : "";

      insertIntoEditor(
        `<h2>📄 ${sourceLabel}</h2>${truncatedNote}${slidesHtml}${trailingP}`,
        sourceLabel,
      );

      toast.success(
        `Imported ${renderedCount} slide${renderedCount !== 1 ? "s" : ""} from "${sourceLabel}"${truncated ? ` (first ${MAX_SLIDE_PAGES})` : ""}`,
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't render slides. Try 'Raw Text' instead.",
      );
    } finally {
      dismissChoice();
    }
  };

  const lastSavedAt = liveNote.updatedAt;
  const plainBodyLength = body.replace(/<[^>]*>/g, "").trim().length;

  // Import PDF button label
  const pdfBtnLabel =
    pdfPhase === "extracting"
      ? "Extracting…"
      : pdfPhase === "condensing"
        ? "Condensing…"
        : pdfPhase === "rendering"
          ? "Rendering…"
          : "Import PDF";

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-background animate-float-in">
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 -z-10 h-[420px] w-[820px] -translate-x-1/2 rounded-full opacity-25 blur-3xl"
        style={{
          background:
            "radial-gradient(ellipse at center, oklch(0.55 0.24 295 / 0.6), transparent 60%)",
        }}
      />

      {/* ── Header ───────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border/40 px-4 py-3 backdrop-blur-xl sm:px-6"
        style={{ backgroundColor: "color-mix(in oklab, var(--background) 80%, transparent)" }}
      >
        <button
          onClick={onClose}
          className="hover-glow flex items-center gap-1.5 rounded-lg border border-border/50 bg-[var(--surface)] px-3 py-1.5 text-[13px] font-medium text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Back</span>
        </button>

        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
          {status === "saving" ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              <span>Saving…</span>
            </>
          ) : (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span>Saved · {formatRelative(lastSavedAt)}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Import PDF */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={(e) => void handlePdfFileChange(e)}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={pdfPhase !== null}
            aria-label="Import PDF"
            title="Import PDF — choose how to insert the content into this note"
            className="hover-glow flex items-center gap-1.5 rounded-lg border border-border/50 bg-[var(--surface)] px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pdfPhase !== null && pdfPhase !== "awaiting-choice" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            ) : (
              <FileUp className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">{pdfBtnLabel}</span>
          </button>

          {/* Delete */}
          <button
            onClick={() => setConfirmDelete(true)}
            aria-label="Delete note"
            className="hover-glow flex h-9 w-9 items-center justify-center rounded-lg border border-border/50 bg-[var(--surface)] text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* ── Formatting toolbar ────────────────────────────────────────── */}
      <Toolbar editor={editor} />

      {/* ── Scrollable body ───────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8 sm:py-12">

          {/* Subject chips */}
          <div className="flex flex-wrap items-center gap-2">
            {SUBJECTS.map((s) => {
              const active = s.value === subject;
              return (
                <button
                  key={s.value}
                  onClick={() => {
                    setSubject(s.value);
                    setSubjectLabel(s.label);
                  }}
                  className={[
                    "group flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-all",
                    active
                      ? "border-primary/40 bg-primary/15 text-primary shadow-glow"
                      : "border-border/60 bg-[var(--surface)] text-muted-foreground hover:text-foreground",
                  ].join(" ")}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                  {s.label}
                </button>
              );
            })}
          </div>

          {/* Test date */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    "hover-glow flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition-colors",
                    liveNote.testDate
                      ? "border-primary/40 bg-primary/15 text-primary shadow-glow"
                      : "border-border/60 bg-[var(--surface)] text-muted-foreground hover:text-foreground",
                  )}
                >
                  <CalendarClock className="h-3.5 w-3.5" />
                  {liveNote.testDate
                    ? formatTestCountdown(liveNote.testDate, subjectLabel)
                    : "Set test date"}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={liveNote.testDate ? new Date(liveNote.testDate) : undefined}
                  onSelect={(d) =>
                    setTestDateMutation.mutate({ id: noteId, date: d ?? null })
                  }
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            {liveNote.testDate ? (
              <>
                <span className="text-[11.5px] text-muted-foreground">
                  {new Date(liveNote.testDate).toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
                <button
                  onClick={() => setTestDateMutation.mutate({ id: noteId, date: null })}
                  aria-label="Clear test date"
                  className="flex h-6 w-6 items-center justify-center rounded-md border border-border/60 bg-[var(--surface)] text-muted-foreground hover:text-foreground"
                >
                  <XIcon className="h-3 w-3" />
                </button>
              </>
            ) : null}
          </div>

          {/* Title */}
          <textarea
            ref={titleRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled note"
            rows={1}
            className="mt-6 w-full resize-none bg-transparent text-[32px] font-semibold leading-tight tracking-tight text-foreground placeholder:text-muted-foreground/50 focus:outline-none sm:text-[40px]"
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${el.scrollHeight}px`;
            }}
          />

          {/* Rich text editor */}
          <div className="mt-4">
            <EditorContent editor={editor} />
          </div>

          {/* Generate Study Guide */}
          <button
            onClick={() => setGuideOpen(true)}
            disabled={plainBodyLength < 20}
            className="group mt-10 flex w-full items-center gap-4 overflow-hidden rounded-xl border border-primary/30 bg-gradient-violet p-4 text-left shadow-glow transition-transform duration-200 hover:scale-[1.005] active:scale-[0.995] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
            aria-label="Generate study guide"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/25 backdrop-blur">
              <Sparkles className="h-5 w-5 text-white" strokeWidth={2.3} />
            </span>
            <span className="flex-1">
              <span className="block text-[14.5px] font-semibold text-white">
                Generate Study Guide
              </span>
              <span className="mt-0.5 block text-[12.5px] text-white/80">
                {plainBodyLength < 20
                  ? "Write a few sentences first…"
                  : "Key concepts, terms, and practice questions — in seconds."}
              </span>
            </span>
          </button>

          {/* Saved guides */}
          <section className="mt-10">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 text-primary ring-1 ring-inset ring-primary/25">
                  <Sparkles className="h-3.5 w-3.5" />
                </span>
                <h3 className="text-[14px] font-semibold tracking-tight">Saved Study Guides</h3>
                {savedGuides.length > 0 && (
                  <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground">
                    {savedGuides.length}
                  </span>
                )}
              </div>
            </div>
            {savedGuides.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border/60 bg-[var(--surface)]/40 px-4 py-6 text-center text-[13px] text-muted-foreground">
                No saved guides yet. Generate one above to save it here.
              </p>
            ) : (
              <div className="space-y-2.5">
                {savedGuides.map((sg) => (
                  <SavedGuideRow
                    key={sg.id}
                    noteId={noteId}
                    saved={sg}
                    onOpen={() => setViewGuide(sg.guide)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* ── Modals ────────────────────────────────────────────────────── */}
      {guideOpen && (
        <StudyGuideModal
          open={guideOpen}
          onClose={() => setGuideOpen(false)}
          note={{ title, body, subjectLabel }}
          noteId={noteId}
        />
      )}

      {viewGuide && (
        <StudyGuideModal
          open={!!viewGuide}
          onClose={() => setViewGuide(null)}
          note={{ title, body, subjectLabel }}
          initialGuide={viewGuide}
        />
      )}

      {/* ── PDF Import Choice Modal ───────────────────────────────────── */}
      {pdfPhase === "awaiting-choice" && pendingPdf && (
        <div
          className="fixed inset-0 z-[110] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
          onClick={dismissChoice}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-t-2xl border border-border/60 bg-[var(--surface-elevated)] p-5 pb-7 shadow-glow-lg sm:rounded-2xl animate-float-in"
          >
            {/* Header */}
            <div className="mb-4 flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/30">
                <FileUp className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0">
                <h3 className="text-[15px] font-semibold tracking-tight">How do you want to import?</h3>
                <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                  {pendingPdf.title}
                  {pendingPdf.totalPages > 0
                    ? ` · ${pendingPdf.totalPages} page${pendingPdf.totalPages !== 1 ? "s" : ""}`
                    : ""}
                  {!pendingPdf.hasText ? " · image-only PDF" : ""}
                </p>
              </div>
            </div>

            {/* Options */}
            <div className="space-y-2">
              {/* Raw Text */}
              <ImportOption
                icon={<FileText className="h-4 w-4" />}
                label="Raw Text"
                description="Insert the full extracted text as-is"
                disabled={!pendingPdf.hasText}
                disabledReason="No text found in this PDF"
                onClick={handleImportRaw}
              />

              {/* Condensed */}
              <ImportOption
                icon={<Sparkles className="h-4 w-4" />}
                label="Condensed"
                badge="AI"
                description="Summarise to key points using Claude"
                disabled={!pendingPdf.hasText}
                disabledReason="No text found in this PDF"
                onClick={() => void handleImportCondense()}
                highlight
              />

              {/* Slides */}
              <ImportOption
                icon={<GalleryHorizontal className="h-4 w-4" />}
                label="Slides View"
                description={`Render each page as an image${pendingPdf.totalPages > MAX_SLIDE_PAGES ? ` (first ${MAX_SLIDE_PAGES} of ${pendingPdf.totalPages})` : ""}`}
                onClick={() => void handleImportSlides()}
              />
            </div>

            <button
              onClick={dismissChoice}
              className="mt-4 w-full rounded-lg border border-border/60 bg-[var(--surface)] py-2 text-[13px] font-medium text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Loading overlay for condensing / rendering ────────────────── */}
      {(pdfPhase === "condensing" || pdfPhase === "rendering") && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border/60 bg-[var(--surface-elevated)] px-8 py-6 shadow-glow-lg">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <p className="text-[13.5px] font-medium text-foreground">
              {pdfPhase === "condensing" ? "Condensing with AI…" : "Rendering slides…"}
            </p>
            <p className="text-[12px] text-muted-foreground">
              {pdfPhase === "condensing"
                ? "Claude is summarising your document"
                : "Converting PDF pages to images"}
            </p>
          </div>
        </div>
      )}

      {/* ── Delete note confirm ───────────────────────────────────────── */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-[110] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
          onClick={() => setConfirmDelete(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-t-2xl border border-border/60 bg-[var(--surface-elevated)] p-5 shadow-glow-lg sm:rounded-2xl animate-float-in"
          >
            <h3 className="text-[16px] font-semibold tracking-tight">Delete this note?</h3>
            <p className="mt-1 text-[13px] text-muted-foreground">
              This can&apos;t be undone. Your note will be permanently removed.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                className="rounded-md border border-border/60 bg-[var(--surface)] px-3.5 py-2 text-[13px] font-medium hover:bg-white/[0.04]"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="rounded-md bg-destructive px-3.5 py-2 text-[13px] font-medium text-destructive-foreground hover:opacity-90"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── ImportOption card ─────────────────────────────────────────────────────
function ImportOption({
  icon,
  label,
  badge,
  description,
  disabled,
  disabledReason,
  onClick,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  badge?: string;
  description: string;
  disabled?: boolean;
  disabledReason?: string;
  onClick: () => void;
  highlight?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-all",
        highlight && !disabled
          ? "border-primary/40 bg-primary/10 hover:bg-primary/15 hover:border-primary/60"
          : "border-border/60 bg-[var(--surface)] hover:border-border hover:bg-white/[0.04]",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1",
          highlight && !disabled
            ? "bg-primary/20 text-primary ring-primary/30"
            : "bg-white/[0.06] text-muted-foreground ring-white/10 group-hover:text-foreground",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span
            className={cn(
              "text-[13.5px] font-semibold",
              highlight && !disabled ? "text-primary" : "text-foreground",
            )}
          >
            {label}
          </span>
          {badge && !disabled && (
            <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary ring-1 ring-primary/25">
              {badge}
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-[12px] text-muted-foreground">
          {disabled && disabledReason ? disabledReason : description}
        </span>
      </span>
    </button>
  );
}

// ── SavedGuideRow ─────────────────────────────────────────────────────────
function SavedGuideRow({
  noteId,
  saved,
  onOpen,
}: {
  noteId: string;
  saved: SavedGuide;
  onOpen: () => void;
}) {
  const deleteGuideMutation = useDeleteGuideMutation();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { guide, createdAt, id: guideId } = saved;
  const date = new Date(createdAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const time = new Date(createdAt).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  const handleDelete = () => {
    deleteGuideMutation.mutate(
      { noteId, guideId },
      {
        onSuccess: () => {
          toast.success("Study guide deleted");
          setConfirmDelete(false);
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Couldn't delete study guide");
        },
      },
    );
  };

  return (
    <>
      <div className="group flex items-center gap-2 overflow-hidden rounded-xl border border-border/60 bg-[var(--surface)] transition-colors hover:border-primary/30">
        <button
          type="button"
          onClick={onOpen}
          className="hover-glow flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-violet text-white shadow-glow">
            <Sparkles className="h-3.5 w-3.5" strokeWidth={2.3} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13.5px] font-medium text-foreground">
              {guide.title || "Study Guide"}
            </span>
            <span className="mt-0.5 block text-[11.5px] text-muted-foreground">
              Created {date} · {time}
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          aria-label="Delete study guide"
          className="hover-glow mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/50 bg-[var(--surface)] text-muted-foreground opacity-80 transition-colors hover:text-destructive group-hover:opacity-100"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {confirmDelete && (
        <div
          className="fixed inset-0 z-[110] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
          onClick={() => setConfirmDelete(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-t-2xl border border-border/60 bg-[var(--surface-elevated)] p-5 shadow-glow-lg sm:rounded-2xl animate-float-in"
          >
            <h3 className="text-[16px] font-semibold tracking-tight">Delete this study guide?</h3>
            <p className="mt-1 text-[13px] text-muted-foreground">
              &ldquo;{guide.title || "Study Guide"}&rdquo; will be permanently removed.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="rounded-md border border-border/60 bg-[var(--surface)] px-3.5 py-2 text-[13px] font-medium hover:bg-white/[0.04]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteGuideMutation.isPending}
                className="rounded-md bg-destructive px-3.5 py-2 text-[13px] font-medium text-destructive-foreground hover:opacity-90 disabled:opacity-60"
              >
                {deleteGuideMutation.isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
