import { useEditor, EditorContent, ReactNodeViewRenderer, type Editor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { Underline } from "@tiptap/extension-underline";
import { Highlight } from "@tiptap/extension-highlight";
import { TextStyle, FontSize } from "@tiptap/extension-text-style";
import { FontFamily } from "@tiptap/extension-font-family";
import { TextAlign } from "@tiptap/extension-text-align";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Image } from "@tiptap/extension-image";
import { AnnotationToolbar } from "@/components/AnnotationToolbar";
import { AnnotatedSlideView } from "@/components/AnnotatedSlide";
import { useAnnotationContext } from "@/components/AnnotationContext";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  Strikethrough,
  List,
  ListOrdered,
  Highlighter,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  AlignLeft,
  AlignCenter,
  AlignRight,
  FileUp,
  FileText,
  GalleryHorizontal,
  BookOpen,
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
import { uploadSlideImages, uploadNoteImage, MAX_IMAGE_BYTES } from "@/lib/storage/upload-slides";
import { useAuth } from "@/lib/auth/auth-provider";
import { StudyGuideModal } from "@/components/StudyGuideModal";
import { LearnSheet } from "@/components/LearnSheet";
import { MoveToNotebookSheet } from "@/components/MoveToNotebookSheet";
import type { StudyGuide } from "@/lib/study-guide.functions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { useNotebooks } from "@/lib/notebooks/use-notebooks";
import { NOTEBOOK_COLORS, PAPER_TEMPLATES, paperClassName } from "@/lib/notebooks/types";
import { FreeformLayer } from "@/components/FreeformLayer";
import { useBoxes, useCreateBoxMutation } from "@/lib/boxes/use-boxes";
import { Type as TypeIcon, PenLine, ImagePlus } from "lucide-react";
import { InkCanvas, type InkMode } from "@/components/InkCanvas";
import { InkToolbar, INK_COLORS } from "@/components/InkToolbar";
import { useInkHistory } from "@/lib/ink/use-ink-history";
import { useTheme } from "@/lib/theme/theme-provider";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";

const FONT_SIZES = [
  { label: "Small", value: "0.85em" },
  { label: "Normal", value: "" },
  { label: "Large", value: "1.25em" },
  { label: "Huge", value: "1.6em" },
] as const;

const FONT_FAMILIES = [
  { label: "Default", value: "" },
  { label: "Serif", value: "Georgia, 'Times New Roman', serif" },
  { label: "Mono", value: "'SF Mono', ui-monospace, Menlo, monospace" },
  { label: "Rounded", value: "'Avenir Next', system-ui, sans-serif" },
] as const;

const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10 MB client-side guard
const MAX_SLIDE_PAGES = 20; // cap on rendered pages per import
const PAGE_HEIGHT = 1040; // px height of one "page" sheet before it rolls to the next

/**
 * The zoom transform, as plain style objects.
 *
 * Single source of truth on purpose: React renders these at rest, and the
 * pinch handler writes the very same values straight to the DOM while a
 * gesture is in flight (re-rendering this component per pinch sample is what
 * made zooming lag). Two copies of this logic would drift apart.
 */
function zoomStyles(z: number, nat: { w: number; h: number }) {
  if (z === 1) {
    return { sizer: { minHeight: "100%" } as const, page: undefined };
  }
  return {
    sizer: { width: nat.w * z, height: nat.h * z, marginInline: "auto" },
    page: {
      // Pin to the measured natural size: `w-full` would resolve against the
      // enlarged sizer and scale a second time.
      width: nat.w,
      maxWidth: "none",
      // min-h-full against an enlarged sizer would feed back into the
      // measurement that produced it.
      minHeight: 0,
      // Centring is the sizer's job; auto margins here would offset the page
      // and break the focal-point scroll maths.
      marginInline: 0,
      transform: `scale(${z})`,
      // Scale from the top-left so scroll offsets map linearly onto content
      // coordinates.
      transformOrigin: "0 0",
    },
  };
}

/** Apply one of the above style objects to a real element. */
function applyStyle(el: HTMLElement | null, style: Record<string, unknown> | undefined) {
  if (!el) return;
  const s = el.style;
  s.width = "";
  s.height = "";
  s.minHeight = "";
  s.maxWidth = "";
  s.marginInline = "";
  s.transform = "";
  s.transformOrigin = "";
  if (!style) return;
  for (const [k, v] of Object.entries(style)) {
    s.setProperty(
      k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`),
      typeof v === "number" && v !== 0 ? `${v}px` : String(v),
    );
  }
}

/** Image files from a paste or drop, ignoring non-image content. */
function imageFilesFrom(dt: DataTransfer | null | undefined): File[] {
  if (!dt) return [];
  return Array.from(dt.files ?? []).filter((f) => f.type.startsWith("image/"));
}

// Escape text destined for an HTML string so `<`, `&`, quotes in PDF
// content or titles can't mangle the document structure.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

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

// ── AnnotatedSlide Tiptap extension ───────────────────────────────────────
// Extends Image with a `data-slide-key` attribute + ReactNodeViewRenderer.
// Images without the attribute render as a plain <img>.
const AnnotatedSlideExtension = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      "data-slide-key": {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute("data-slide-key") ?? null,
        renderHTML: (attrs: Record<string, unknown>) => {
          if (!attrs["data-slide-key"]) return {};
          return { "data-slide-key": attrs["data-slide-key"] };
        },
      },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(AnnotatedSlideView);
  },
});

// ── Client-side PDF → images ───────────────────────────────────────────────
async function renderPdfToImages(file: File): Promise<Blob[]> {
  // Lazy-load pdfjs-dist so it doesn't bloat the initial bundle
  const [pdfjs, { default: workerSrc }] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);

  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc as string;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

  const pageCount = Math.min(pdf.numPages, MAX_SLIDE_PAGES);
  const images: Blob[] = [];

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    // Scale 1.4 — good balance of readability vs. file size
    const viewport = page.getViewport({ scale: 1.4 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;
    await page.render({ canvasContext: ctx as unknown as CanvasRenderingContext2D, viewport })
      .promise;
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.72),
    );
    if (!blob) throw new Error(`Couldn't render page ${i}`);
    images.push(blob);
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
        "flex h-[34px] min-w-[34px] items-center justify-center rounded-lg text-[13px] font-semibold transition-colors",
        active
          ? "bg-primary/15 text-primary ring-1 ring-inset ring-primary/25"
          : "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <span className="mx-1 h-6 w-px shrink-0 rounded-full bg-border/60" />;
}

function ToolbarSelect({
  value,
  onChange,
  title,
  options,
  minWidth = "6.5rem",
}: {
  value: string;
  onChange: (value: string) => void;
  title: string;
  options: readonly { label: string; value: string }[];
  minWidth?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onMouseDown={(e) => e.stopPropagation()}
      title={title}
      aria-label={title}
      style={{ minWidth }}
      className="h-[34px] cursor-pointer rounded-lg border border-border/60 bg-[var(--surface)] px-2 text-[12.5px] font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
    >
      {options.map((o) => (
        <option key={o.label} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function Toolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null;

  const activeFontSize = (editor.getAttributes("textStyle").fontSize as string | undefined) ?? "";
  const activeFontFamily =
    (editor.getAttributes("textStyle").fontFamily as string | undefined) ?? "";

  const handleFontSize = (val: string) => {
    if (!val) {
      editor.chain().focus().unsetFontSize().run();
    } else {
      editor.chain().focus().setFontSize(val).run();
    }
  };

  const handleFontFamily = (val: string) => {
    if (!val) {
      editor.chain().focus().unsetFontFamily().run();
    } else {
      editor.chain().focus().setFontFamily(val).run();
    }
  };

  return (
    <div
      className="sticky top-[57px] z-10 flex flex-wrap items-center gap-1 border-b border-border/40 bg-[var(--surface-elevated)]/95 px-3 py-2 shadow-sm backdrop-blur-sm sm:px-5"
      onMouseDown={(e) => e.preventDefault()}
    >
      <ToolbarSelect
        value={activeFontFamily}
        onChange={handleFontFamily}
        title="Font"
        options={FONT_FAMILIES}
        minWidth="6rem"
      />
      <ToolbarSelect
        value={activeFontSize}
        onChange={handleFontSize}
        title="Font size"
        options={FONT_SIZES}
        minWidth="5rem"
      />

      <ToolbarDivider />

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
      <ToolbarBtn
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        title="Strikethrough"
      >
        <Strikethrough className="h-3.5 w-3.5" strokeWidth={2.5} />
      </ToolbarBtn>
      <ToolbarBtn
        active={editor.isActive("highlight")}
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        title="Highlight"
      >
        <Highlighter className="h-3.5 w-3.5" strokeWidth={2} />
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
      <ToolbarBtn
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        title="Quote"
      >
        <Quote className="h-4 w-4" strokeWidth={2} />
      </ToolbarBtn>

      <ToolbarDivider />

      <ToolbarBtn
        active={editor.isActive({ textAlign: "left" })}
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
        title="Align left"
      >
        <AlignLeft className="h-4 w-4" strokeWidth={2} />
      </ToolbarBtn>
      <ToolbarBtn
        active={editor.isActive({ textAlign: "center" })}
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
        title="Align center"
      >
        <AlignCenter className="h-4 w-4" strokeWidth={2} />
      </ToolbarBtn>
      <ToolbarBtn
        active={editor.isActive({ textAlign: "right" })}
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
        title="Align right"
      >
        <AlignRight className="h-4 w-4" strokeWidth={2} />
      </ToolbarBtn>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────
export function NoteEditor({ noteId, onClose }: Props) {
  const { isLoading } = useNotesList();
  const { user } = useAuth();
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
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("saved");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [learnOpen, setLearnOpen] = useState(false);
  const [viewGuide, setViewGuide] = useState<StudyGuide | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [pdfPhase, setPdfPhase] = useState<PdfPhase>(null);
  const [pendingPdf, setPendingPdf] = useState<PendingPdf | null>(null);

  const { mode: annotationMode } = useAnnotationContext();
  const hasSlides = body.includes("data-slide-key");
  const notebooks = useNotebooks();
  const createBox = useCreateBoxMutation(noteId);
  const { data: boxes = [] } = useBoxes(noteId);

  // ── Handwriting (Apple Pencil) ─────────────────────────────────────────
  // All ink edits go through the history hook so the canvas and the toolbar
  // share one undo stack.
  const ink = useInkHistory(noteId);
  const { theme } = useTheme();
  const [inkMode, setInkMode] = useState<InkMode>("off");
  // Page zoom. Writing at 100% on a tablet produces oversized handwriting —
  // zooming in to write at a natural hand size is the normal GoodNotes
  // workflow, so the page scales rather than the pen.
  const [zoom, setZoom] = useState(1);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const keyboardInset = useKeyboardInset();
  // Zooming out is only useful as far as "show me the whole sheet" — going
  // further just strands the page in the middle of a grey field. The floor is
  // therefore the scale that fits one page in the viewport, never above 1:1.
  const [fitZoom, setFitZoom] = useState(0.5);
  const clampZoom = (z: number) => Math.min(3, Math.max(fitZoom, z));
  // The page's unscaled size. offsetWidth/offsetHeight ignore CSS transforms,
  // so these stay the natural size at any zoom and can be multiplied out to
  // reserve the scaled footprint.
  const pageRef = useRef<HTMLDivElement | null>(null);
  const sizerRef = useRef<HTMLDivElement | null>(null);
  const [natural, setNatural] = useState({ w: 0, h: 0 });

  // Track the scroll viewport so the zoom floor follows rotation and resize.
  // Callback ref, not an effect: this container is not in the tree on first
  // mount either, so a []-dep effect would find the ref null, never observe
  // anything, and leave the floor at its placeholder value.
  const scrollObserverRef = useRef<ResizeObserver | null>(null);
  const setScrollRef = useCallback((el: HTMLDivElement | null) => {
    scrollRef.current = el;
    scrollObserverRef.current?.disconnect();
    scrollObserverRef.current = null;
    if (!el) return;
    const recompute = () => {
      if (!el.clientHeight) return;
      // 1.06 leaves the sheet a little breathing room inside the viewport.
      const fit = el.clientHeight / (PAGE_HEIGHT * 1.06);
      setFitZoom(Math.min(1, Math.max(0.4, Math.round(fit * 100) / 100)));
    };
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    scrollObserverRef.current = ro;
    recompute();
  }, []);
  // Read by the gesture handler, which must not compute from `zoom` state:
  // React may invoke a state updater more than once, and doing scroll maths
  // inside one would apply the pan twice.
  const zoomRef = useRef(1);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);
  const pendingScrollRef = useRef<{ left: number; top: number } | null>(null);
  // True between the second finger landing and the last one lifting, while the
  // page is transforming itself outside of React.
  const gestureActiveRef = useRef(false);
  // Pan velocity in px/ms, for the glide after the fingers leave the glass.
  const velocityRef = useRef({ x: 0, y: 0, t: 0 });
  const glideRef = useRef<number | null>(null);

  // A callback ref rather than an effect: the page node is not in the tree on
  // first mount, so a []-dep effect found pageRef.current null, never attached
  // an observer, and left the natural size at 0 — which collapsed the sizer
  // and pinned the page's width to 0px.
  const pageObserverRef = useRef<ResizeObserver | null>(null);
  const measurePage = (el: HTMLDivElement | null) => {
    if (!el) return;
    setNatural((prev) =>
      prev.w === el.offsetWidth && prev.h === el.offsetHeight
        ? prev
        : { w: el.offsetWidth, h: el.offsetHeight },
    );
  };
  const setPageRef = useCallback((el: HTMLDivElement | null) => {
    pageRef.current = el;
    pageObserverRef.current?.disconnect();
    pageObserverRef.current = null;
    if (!el) return;
    const ro = new ResizeObserver(() => measurePage(el));
    ro.observe(el);
    pageObserverRef.current = ro;
    measurePage(el);
  }, []);

  const handleGesture = ({
    scaleBy,
    dx,
    dy,
    cx,
    cy,
  }: {
    scaleBy: number;
    dx: number;
    dy: number;
    cx: number;
    cy: number;
  }) => {
    const el = scrollRef.current;
    if (!el) return;
    // A new gesture cancels any glide still running from the last one.
    if (glideRef.current !== null) {
      cancelAnimationFrame(glideRef.current);
      glideRef.current = null;
    }
    const now = performance.now();
    const dt = now - velocityRef.current.t;
    if (dt > 0 && dt < 120) {
      // Smooth the estimate: a single sample is noisy enough to fling the page
      // sideways when a finger jitters on lift.
      velocityRef.current = {
        x: velocityRef.current.x * 0.7 + (dx / dt) * 0.3,
        y: velocityRef.current.y * 0.7 + (dy / dt) * 0.3,
        t: now,
      };
    } else {
      velocityRef.current = { x: 0, y: 0, t: now };
    }
    const prev = zoomRef.current;
    const next = clampZoom(prev * scaleBy);
    const ratio = next / prev;
    const rect = el.getBoundingClientRect();
    // Pinch centre relative to the scroll container's own viewport.
    const px = cx - rect.left;
    const py = cy - rect.top;
    // Below 1:1 the sizer is narrower than the viewport and `marginInline:
    // auto` centres it, so content x=0 does not sit at scroll 0. That offset
    // changes as the scale crosses the fit-width point and has to come out of
    // the maths, or zooming out drifts sideways.
    const gutter = (z: number) =>
      natural.w ? Math.max(0, (el.clientWidth - natural.w * z) / 2) : 0;
    // Content coordinate currently under the pinch centre.
    const contentX = (el.scrollLeft + px - gutter(prev)) / prev;
    // Zoom about the pinch centre rather than a fixed origin: the content
    // under the fingers has to stay under the fingers, which is what lets a
    // student pinch into a corner and write in that spot. The two-finger drag
    // pans on top of it, so pinch and pan compose in one gesture.
    // Clamp at the near edge: the DOM clamps a negative scroll to 0 anyway,
    // and letting a negative accumulate would drag the page further off with
    // every sample.
    const left = Math.max(0, gutter(next) + contentX * next - px - dx);
    // No vertical centring, so the ratio form is exact here.
    const top = Math.max(0, (el.scrollTop + py) * ratio - py - dy);

    if (ratio === 1) {
      // Already at a zoom limit — this is a pure pan.
      el.scrollLeft = left;
      el.scrollTop = top;
      return;
    }

    // Drive the transform straight from the gesture. Calling setZoom here
    // re-rendered this whole component on every pinch sample, which is what
    // made zooming feel sluggish; React is told once, when the fingers lift.
    zoomRef.current = next;
    gestureActiveRef.current = true;
    const styles = zoomStyles(next, natural);
    applyStyle(sizerRef.current, styles.sizer as Record<string, unknown>);
    applyStyle(pageRef.current, styles.page as Record<string, unknown> | undefined);
    el.scrollLeft = left;
    el.scrollTop = top;
  };

  // The fingers left the glass: hand the final scale back to React so the
  // rendered styles and the live DOM agree again.
  const handleGestureEnd = () => {
    const el = scrollRef.current;

    // Glide: a page that stops dead the instant you lift reads as a web page
    // being dragged. Carry the velocity and decay it, the way a real sheet of
    // paper keeps moving under your hand.
    let { x: vx, y: vy } = velocityRef.current;
    velocityRef.current = { x: 0, y: 0, t: 0 };
    if (el && Math.hypot(vx, vy) > 0.05) {
      const step = () => {
        vx *= 0.94;
        vy *= 0.94;
        if (Math.hypot(vx, vy) < 0.02) {
          glideRef.current = null;
          return;
        }
        el.scrollLeft -= vx * 16;
        el.scrollTop -= vy * 16;
        glideRef.current = requestAnimationFrame(step);
      };
      glideRef.current = requestAnimationFrame(step);
    }

    if (!gestureActiveRef.current) return;
    gestureActiveRef.current = false;
    if (el) pendingScrollRef.current = { left: el.scrollLeft, top: el.scrollTop };
    setZoom(zoomRef.current);
  };

  // Scroll must land in the same frame the new scale paints, or the page
  // visibly lurches before settling.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    const pending = pendingScrollRef.current;
    if (!el || !pending) return;
    pendingScrollRef.current = null;
    el.scrollLeft = pending.left;
    el.scrollTop = pending.top;
  }, [zoom]);
  // The typing placeholder is hidden while a nib is active, and stays hidden
  // once the page carries handwriting: "Start writing your notes here…" sitting
  // across someone's equations reads as clutter, not an invitation.
  const hidePlaceholder = inkMode !== "off" || ink.strokes.length > 0;

  /**
   * Put the text caret where the student tapped.
   *
   * In select mode the ink canvas covers the page and swallows the tap, so a
   * tap on blank paper has to be forwarded here or typing would be
   * unreachable without leaving the tool.
   */
  const placeCaretAt = (clientX: number, clientY: number) => {
    if (!editor) return;
    const doc = document as Document & {
      caretRangeFromPoint?: (x: number, y: number) => Range | null;
    };
    const range = doc.caretRangeFromPoint?.(clientX, clientY);
    const dom = editor.view.dom;
    if (range && dom.contains(range.startContainer)) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      editor.commands.focus();
      return;
    }
    editor.commands.focus("end");
  };

  const [inkColor, setInkColor] = useState<string>(INK_COLORS[0].value);
  const [inkSize, setInkSize] = useState(5);
  // Until the user picks a colour themselves, follow the paper: dark ink on
  // the light/cream papers, light ink on the dark blank sheet — otherwise
  // the default near-black pen is invisible on a dark page.
  const inkColorChosenRef = useRef(false);
  const setInkColorManual = (c: string) => {
    inkColorChosenRef.current = true;
    setInkColor(c);
  };
  // Effective paper for this note: per-note override → notebook → blank.
  const effectivePaper =
    liveNote?.paper ?? notebooks.find((n) => n.id === liveNote?.notebookId)?.paper ?? "blank";
  // The page is light when it uses a cream ruled/grid template *or* when the
  // app is in light mode — "blank" paper follows the theme, so keying the pen
  // colour off the template alone put near-white ink on a white page in light
  // mode, making handwriting invisible.
  const isLightPage = effectivePaper !== "blank" || theme === "light";
  useEffect(() => {
    if (inkColorChosenRef.current) return;
    setInkColor(isLightPage ? "#1f2937" : "#f4f4f5");
  }, [isLightPage]);
  const [showMoveSheet, setShowMoveSheet] = useState(false);

  const savedGuides: SavedGuide[] = liveNote?.guides ?? [];
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Last content actually persisted — lets us skip no-op saves (opening a
  // note must not bump updated_at) and flush real changes on unmount
  // without stale-closure state.
  const lastSavedRef = useRef<string | null>(null);
  const pendingSaveRef = useRef<{
    title: string;
    body: string;
    subject: StoredNote["subject"];
    subjectLabel: string;
  } | null>(null);
  const titleRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Upload pasted/dropped/photographed images, then insert them at the caret.
  // The editor and user are read from refs so this stays stable enough to be
  // referenced from the Tiptap paste/drop handlers created below.
  const editorRef = useRef<Editor | null>(null);
  const userIdRef = useRef<string | undefined>(undefined);
  userIdRef.current = user?.id;
  const insertImageFiles = async (files: File[]) => {
    const uid = userIdRef.current;
    if (!uid) {
      toast.error("Sign in to add images.");
      return;
    }
    setUploadingImage(true);
    try {
      for (const file of files) {
        if (file.size > MAX_IMAGE_BYTES) {
          toast.error(
            `Image too large (max 10 MB). This one is ${(file.size / 1024 / 1024).toFixed(1)} MB.`,
          );
          continue;
        }
        const url = await uploadNoteImage({ userId: uid, noteId, file });
        editorRef.current?.chain().focus().setImage({ src: url }).run();
      }
      setBody(editorRef.current?.getHTML() ?? "");
    } catch (err) {
      // Uploads need the network; say so rather than dropping the image.
      toast.error(
        err instanceof Error ? `Couldn't add image: ${err.message}` : "Couldn't add image.",
      );
    } finally {
      setUploadingImage(false);
    }
  };
  // How many page-sized sheets to show. Grows automatically as content (typed
  // text or a text box) fills the current page — so a note "becomes pages"
  // instead of forcing a new note.
  const [pageCount, setPageCount] = useState(1);

  // ── Tiptap editor ──────────────────────────────────────────────────────
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Highlight,
      TextStyle,
      FontSize,
      FontFamily,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      // Replaces the old float-based ::before CSS placeholder hack, which
      // could visually overlap the next line when the doc had more than
      // one empty block. This renders per-node via a decoration instead.
      Placeholder.configure({ placeholder: "Start writing your notes here…" }),
      AnnotatedSlideExtension.configure({ allowBase64: true, inline: false }),
    ],
    content: "",
    editorProps: {
      attributes: {
        class: "tiptap",
      },
      // Paste an image straight from the clipboard (screenshot, copied figure).
      handlePaste: (_view, event) => {
        const files = imageFilesFrom(event.clipboardData);
        if (files.length === 0) return false;
        event.preventDefault();
        void insertImageFiles(files);
        return true;
      },
      // Drag a photo or figure in from Files/Photos or the desktop.
      handleDrop: (_view, event) => {
        const dt = (event as DragEvent).dataTransfer;
        const files = imageFilesFrom(dt);
        if (files.length === 0) return false;
        event.preventDefault();
        void insertImageFiles(files);
        return true;
      },
    },
    onUpdate: ({ editor: e }) => {
      setBody(e.getHTML());
    },
  });
  editorRef.current = editor;

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
    lastSavedRef.current = JSON.stringify({
      title: liveNote.title,
      body: liveNote.body || "",
      subject: liveNote.subject,
      subjectLabel:
        liveNote.subjectLabel ?? SUBJECTS.find((s) => s.value === liveNote.subject)!.label,
    });
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

  // Keep the caret above the on-screen keyboard, the way Google Docs does.
  // Padding alone only makes the room; the page still has to follow the caret
  // into it as the student types past the fold.
  useEffect(() => {
    if (!editor || !keyboardInset) return;
    const el = scrollRef.current;
    if (!el) return;

    const follow = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      // A collapsed caret at the start of an empty block reports an empty
      // rect; there is nothing meaningful to scroll to in that case.
      if (!rect.height && !rect.top) return;
      // One line of breathing room so the caret is never flush with the keys.
      const limit = window.innerHeight - keyboardInset - 32;
      if (rect.bottom > limit) el.scrollTop += rect.bottom - limit;
    };

    // Run after the DOM settles, so the rect reflects the character just typed.
    const schedule = () => requestAnimationFrame(follow);
    editor.on("selectionUpdate", schedule);
    editor.on("update", schedule);
    schedule();
    return () => {
      editor.off("selectionUpdate", schedule);
      editor.off("update", schedule);
    };
  }, [editor, keyboardInset]);

  // Lock body scroll while editor is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // ── Pagination: grow the page stack as content fills each page ──────────
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom as HTMLElement;
    const recompute = () => {
      const editorBottom = dom.offsetTop + dom.scrollHeight;
      const boxesBottom = boxes.reduce((m, b) => Math.max(m, b.y + 80), 0);
      const bottom = Math.max(editorBottom, boxesBottom);
      // +48 breathing room so a nearly-full page rolls to a fresh one.
      setPageCount(Math.max(1, Math.ceil((bottom + 48) / PAGE_HEIGHT)));
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(dom);
    return () => ro.disconnect();
  }, [editor, boxes]);

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
    const snapshot = { title, body, subject, subjectLabel };
    // Skip no-op saves — hydration (and any rerender) must not bump
    // updated_at or reorder the notes list.
    if (JSON.stringify(snapshot) === lastSavedRef.current) return;
    pendingSaveRef.current = snapshot;
    setStatus("saving");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateMutation.mutate(
        { id: noteId, patch: snapshot },
        {
          // Only mark saved (and clear the pending buffer) when the write
          // actually succeeded. The old onSettled version reported "Saved"
          // even when the request failed (e.g. dropped Wi-Fi) and cleared
          // the buffer up front, so failed content was silently lost.
          onSuccess: () => {
            lastSavedRef.current = JSON.stringify(snapshot);
            if (
              pendingSaveRef.current &&
              JSON.stringify(pendingSaveRef.current) === JSON.stringify(snapshot)
            ) {
              pendingSaveRef.current = null;
            }
            setStatus("saved");
          },
          onError: () => {
            setStatus("error");
            toast.error("Couldn't save — check your connection. Retrying…");
            scheduleRetryRef.current();
          },
        },
      );
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, body, subject, subjectLabel, noteId, hydrated]);

  // Warn before closing the tab with unsaved changes still in flight.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pendingSaveRef.current) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  // Flush any pending (debounced-but-unsaved) edit on unmount. Reads from
  // refs — the previous state-based version captured the initial (empty)
  // render's values and silently never fired.
  const flushMutationRef = useRef(updateMutation);
  flushMutationRef.current = updateMutation;

  // Self-rescheduling save retry: keeps retrying the latest pending content
  // every 4s until a write succeeds (e.g. Wi-Fi comes back mid-lecture).
  const scheduleRetryRef = useRef<() => void>(() => {});
  scheduleRetryRef.current = () => {
    if (retryRef.current) clearTimeout(retryRef.current);
    retryRef.current = setTimeout(() => {
      const latest = pendingSaveRef.current;
      if (!latest) return;
      setStatus("saving");
      flushMutationRef.current.mutate(
        { id: noteId, patch: latest },
        {
          onSuccess: () => {
            lastSavedRef.current = JSON.stringify(latest);
            if (
              pendingSaveRef.current &&
              JSON.stringify(pendingSaveRef.current) === JSON.stringify(latest)
            ) {
              pendingSaveRef.current = null;
            }
            setStatus("saved");
          },
          onError: () => {
            setStatus("error");
            scheduleRetryRef.current();
          },
        },
      );
    }, 4000);
  };
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (retryRef.current) clearTimeout(retryRef.current);
      const pending = pendingSaveRef.current;
      if (pending) {
        pendingSaveRef.current = null;
        lastSavedRef.current = JSON.stringify(pending);
        flushMutationRef.current.mutate({ id: noteId, patch: pending });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading || !hydrated) {
    return createPortal(
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>,
      document.body,
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
      .map((p) => `<p>${escapeHtml(p.replace(/\n/g, " ").trim())}</p>`)
      .filter((p) => p !== "<p></p>")
      .join("");
    insertIntoEditor(
      `<h2>📄 ${escapeHtml(sourceLabel)}</h2>${paragraphs || "<p></p>"}`,
      sourceLabel,
    );
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
      insertIntoEditor(`<h2>📄 ${escapeHtml(sourceLabel)}</h2>${condensed.html}`, sourceLabel);
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
    if (!user) {
      toast.error("You must be signed in to import slides.");
      return;
    }
    setPdfPhase("rendering");
    try {
      const blobs = await renderPdfToImages(pendingPdf.file);
      const sourceLabel = pendingPdf.title;
      const renderedCount = blobs.length;
      const truncated = pendingPdf.totalPages > MAX_SLIDE_PAGES;

      // Unique per-import id so a second PDF imported into the same note
      // can't collide with the first one's slide keys (or storage paths).
      const importId = crypto.randomUUID().slice(0, 8);

      // Upload rendered pages to Supabase Storage instead of inlining
      // base64 data URLs — keeps note rows small and list queries fast.
      const urls = await uploadSlideImages({
        userId: user.id,
        noteId,
        importId,
        blobs,
      });

      // Build slides HTML: pages stacked vertically, gap handled by CSS margin-bottom on img.
      // data-slide-key is a stable identifier used by the annotation layer;
      // it keeps the `nobi-{noteId}-...` shape AnnotatedSlide parses.
      const slidesHtml = urls
        .map(
          (src, idx) =>
            `<img src="${src}" alt="Slide ${idx + 1}" data-slide-key="nobi-${noteId}-${importId}-${idx}" />`,
        )
        .join("");
      // Trailing paragraph so the cursor lands somewhere typeable after the last slide
      const trailingP = "<p></p>";

      const truncatedNote = truncated
        ? `<p><em>Showing first ${MAX_SLIDE_PAGES} of ${pendingPdf.totalPages} pages.</em></p>`
        : "";

      insertIntoEditor(
        `<h2>📄 ${escapeHtml(sourceLabel)}</h2>${truncatedNote}${slidesHtml}${trailingP}`,
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

  const paperCls = paperClassName(effectivePaper);

  return createPortal(
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

      {/* ── Header — Back + Docs-style title (top-left) + actions ─────── */}
      <header
        className="sticky top-0 z-20 flex items-center gap-2 border-b border-border/40 px-3 py-2.5 backdrop-blur-xl sm:px-5"
        style={{ backgroundColor: "color-mix(in oklab, var(--background) 80%, transparent)" }}
      >
        <button
          onClick={onClose}
          aria-label="Back"
          className="hover-glow flex shrink-0 items-center gap-1.5 rounded-lg border border-border/50 bg-[var(--surface)] px-2.5 py-1.5 text-[13px] font-medium text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        {/* Document title — sits top-left, single line, tucked out of the way.
            Enter moves to the body instead of adding a newline. */}
        <input
          ref={titleRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value.replace(/\n/g, " "))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              editor?.chain().focus("start").run();
            }
          }}
          placeholder="Untitled note"
          className="min-w-0 flex-1 truncate bg-transparent text-[15px] font-semibold tracking-tight text-foreground placeholder:text-muted-foreground/50 focus:outline-none sm:text-[16px]"
        />

        <div className="hidden shrink-0 items-center gap-1.5 text-[12px] text-muted-foreground sm:flex">
          {status === "saving" ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              <span>Saving…</span>
            </>
          ) : status === "error" ? (
            <>
              <XIcon className="h-3.5 w-3.5 text-destructive" />
              <span className="text-destructive">Not saved</span>
            </>
          ) : (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span>Saved</span>
            </>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {/* Draw / handwriting toggle (Apple Pencil) */}
          <button
            onClick={() => setInkMode(inkMode === "off" ? "pen" : "off")}
            aria-label="Handwriting"
            aria-pressed={inkMode !== "off"}
            title="Draw / handwrite on this page"
            className={cn(
              "hover-glow flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition-colors",
              inkMode !== "off"
                ? "border-primary/50 bg-primary/15 text-primary"
                : "border-border/50 bg-[var(--surface)] text-muted-foreground hover:border-primary/40 hover:text-primary",
            )}
          >
            <PenLine className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Draw</span>
          </button>

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
      {inkMode === "off" ? (
        <Toolbar editor={editor} />
      ) : (
        <InkToolbar
          mode={inkMode}
          setMode={setInkMode}
          color={inkColor}
          setColor={setInkColorManual}
          size={inkSize}
          setSize={setInkSize}
          onUndo={ink.undo}
          onRedo={ink.redo}
          canUndo={ink.canUndo}
          canRedo={ink.canRedo}
          zoom={zoom}
          setZoom={(z) => setZoom(clampZoom(z))}
          minZoom={fitZoom}
        />
      )}

      {/* ── Annotation toolbar (shown when note has slide images) ─────── */}
      {hasSlides && <AnnotationToolbar />}

      {/* ── Scrollable body ───────────────────────────────────────────── */}
      <div
        style={{
          backgroundColor: "var(--canvas)",
          // Give the page room to scroll clear of the on-screen keyboard.
          // Without this the scrollable area ends behind the keys and the
          // caret becomes unreachable partway down the page.
          paddingBottom: keyboardInset || undefined,
          // The inset changes as the keyboard animates in; matching it keeps
          // the page from jumping under the student's hand.
          transition: "padding-bottom 150ms ease-out",
        }}
        ref={setScrollRef}
        className={`flex-1 min-h-0 overflow-auto${annotationMode !== "none" ? " annotating" : ""}`}
      >
        {/* Sizer: reserves the *scaled* footprint. A CSS transform paints
            outside its layout box without enlarging it, so without this the
            scroll container never grows and the zoomed-in corners of the page
            simply cannot be scrolled to. */}
        <div ref={sizerRef} style={zoomStyles(zoom, natural).sizer}>
          <div
            ref={setPageRef}
            className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 py-6 sm:px-6 sm:py-8"
            style={zoomStyles(zoom, natural).page}
          >
            {/* Meta row: subject / notebook / test date — document chrome, sits above the page */}
            <div className="mb-4 flex shrink-0 flex-wrap items-center gap-2">
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

              {(() => {
                const nb = notebooks.find((n) => n.id === liveNote.notebookId);
                const c = nb
                  ? (NOTEBOOK_COLORS.find((x) => x.value === nb.color) ?? NOTEBOOK_COLORS[0])
                  : null;
                return (
                  <button
                    onClick={() => setShowMoveSheet(true)}
                    className={cn(
                      "hover-glow flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition-colors",
                      nb
                        ? `border-transparent ring-1 ring-inset ${c!.ring} ${c!.bg} ${c!.text}`
                        : "border-border/60 bg-[var(--surface)] text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {nb ? (
                      <>
                        <span className="text-sm leading-none">{nb.emoji}</span>
                        {nb.name}
                      </>
                    ) : (
                      <>
                        <BookOpen className="h-3.5 w-3.5" />
                        Add to notebook
                      </>
                    )}
                  </button>
                );
              })()}

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
                    onSelect={(d) => setTestDateMutation.mutate({ id: noteId, date: d ?? null })}
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

              {/* Add an image — on iOS this offers Camera or Photo Library */}
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []).filter((f) =>
                    f.type.startsWith("image/"),
                  );
                  e.target.value = "";
                  if (files.length) void insertImageFiles(files);
                }}
              />
              <button
                onClick={() => imageInputRef.current?.click()}
                disabled={uploadingImage}
                title="Add a photo — snap the whiteboard or pick from your library"
                className="hover-glow flex items-center gap-1.5 rounded-lg border border-border/60 bg-[var(--surface)] px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                {uploadingImage ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                ) : (
                  <ImagePlus className="h-3.5 w-3.5" />
                )}
                {uploadingImage ? "Uploading…" : "Image"}
              </button>

              {/* Add a free-floating text box */}
              <button
                onClick={() => createBox.mutate(undefined)}
                className="hover-glow flex items-center gap-1.5 rounded-lg border border-border/60 bg-[var(--surface)] px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                title="Add a movable text box"
              >
                <TypeIcon className="h-3.5 w-3.5" />
                Text box
              </button>

              {/* Paper switcher.
                  Inline rather than behind a popover: the popover opened and
                  was dismissed within the same tick (aria-expanded flipped
                  true then false with nothing calling preventDefault), so the
                  control was unreachable — and a student looking for lined or
                  grid paper should not have to find a menu to begin with. */}
              <div
                role="radiogroup"
                aria-label="Paper style"
                className="flex items-center gap-1 rounded-lg border border-border/60 bg-[var(--surface)] px-1.5 py-1"
              >
                <span className="px-1 text-[12px] font-medium text-muted-foreground">Paper</span>
                {PAPER_TEMPLATES.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    role="radio"
                    aria-checked={effectivePaper === p.value}
                    aria-label={p.label}
                    title={p.label}
                    onClick={() => updateMutation.mutate({ id: noteId, patch: { paper: p.value } })}
                    className={cn(
                      "flex h-7 w-6 items-center justify-center rounded-[5px] border bg-[var(--paper)] transition-transform",
                      p.className,
                      effectivePaper === p.value
                        ? "border-primary ring-2 ring-inset ring-primary/40"
                        : "border-border/60 hover:scale-105 hover:border-primary/40",
                    )}
                  />
                ))}
              </div>
            </div>

            {/* Generate Study Guide */}
            <button
              onClick={() => setLearnOpen(true)}
              disabled={plainBodyLength < 20}
              className="group mb-4 flex w-full shrink-0 items-center gap-4 overflow-hidden rounded-xl border border-primary/30 bg-gradient-violet p-4 text-left shadow-glow transition-transform duration-200 hover:scale-[1.005] active:scale-[0.995] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
              aria-label="Generate study guide"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/25 backdrop-blur">
                <Sparkles className="h-5 w-5 text-white" strokeWidth={2.3} />
              </span>
              <span className="flex-1">
                <span className="block text-[14.5px] font-semibold text-white">
                  Learn this note
                </span>
                <span className="mt-0.5 block text-[12.5px] text-white/80">
                  {plainBodyLength < 20
                    ? "Write a few sentences first…"
                    : "Smart notes, flashcards, practice questions — and ask anything."}
                </span>
              </span>
            </button>

            {/* Saved guides */}
            <section className="mb-6">
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
                  No saved guides yet. Generate one to save it here.
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

            {/* ── The page ─────────────────────────────────────────────────
              The note "sheet": a distinct bounded, shadowed card that
              flex-grows to fill the available height so short notes still
              read as a full page (no dead space below). Clicking the blank
              padding focuses the editor at the end. The title now lives in
              the top bar, so this holds only the note body. */}
            <div
              ref={cardRef}
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) {
                  e.preventDefault();
                  editor?.chain().focus("end").run();
                }
              }}
              style={{ minHeight: `${pageCount * PAGE_HEIGHT}px` }}
              className={cn(
                "relative cursor-text rounded-2xl border border-white/20 bg-[var(--paper)] px-5 py-7 shadow-[0_12px_48px_-16px_rgba(0,0,0,0.8)] sm:px-14 sm:py-12",
                paperCls,
              )}
            >
              {/* Page-break separators — a dashed rule + page pill at each
                page boundary so a long note visibly reads as pages. */}
              {Array.from({ length: pageCount - 1 }).map((_, i) => (
                <div
                  key={i}
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 z-[2] flex items-center gap-3 px-4"
                  style={{ top: `${(i + 1) * PAGE_HEIGHT}px`, transform: "translateY(-50%)" }}
                >
                  <span className="h-0 flex-1 border-t border-dashed border-border" />
                  <span className="rounded-full border border-border/70 bg-[var(--surface-elevated)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Page {i + 2}
                  </span>
                  <span className="h-0 flex-1 border-t border-dashed border-border" />
                </div>
              ))}

              <div className={cn("relative z-[1]", hidePlaceholder && "ink-active")}>
                <EditorContent editor={editor} />
              </div>
              {/* Free-floating text boxes layer (GoodNotes-style) */}
              {/* Boxes take pointers only when a nib is not selected, so a
                  stroke drawn over a box lands on the page and a drag with
                  the cursor reaches the box. */}
              <FreeformLayer
                noteId={noteId}
                interactive={inkMode === "off" || inkMode === "select"}
              />
              {/* Handwriting canvas — pointer-transparent while inkMode is off */}
              <InkCanvas
                noteId={noteId}
                mode={inkMode}
                color={inkColor}
                size={inkSize}
                strokes={ink.strokes}
                addStroke={ink.addStroke}
                eraseStrokes={ink.eraseStrokes}
                onGesture={handleGesture}
                onGestureEnd={handleGestureEnd}
                zoom={zoom}
                moveStrokes={ink.moveStrokes}
                onTapEmpty={placeCaretAt}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Modals ────────────────────────────────────────────────────── */}
      <LearnSheet
        open={learnOpen}
        onClose={() => setLearnOpen(false)}
        note={liveNote}
        title={title}
        body={body}
        onGenerate={() => setGuideOpen(true)}
      />

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

      {/* ── Move to notebook sheet ───────────────────────────────────── */}
      {showMoveSheet && (
        <MoveToNotebookSheet
          currentNotebookId={liveNote.notebookId}
          notebooks={notebooks}
          onMove={(notebookId) => {
            updateMutation.mutate({ id: noteId, patch: { notebookId } });
          }}
          onClose={() => setShowMoveSheet(false)}
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
                <h3 className="text-[15px] font-semibold tracking-tight">
                  How do you want to import?
                </h3>
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
    </div>,
    document.body,
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
