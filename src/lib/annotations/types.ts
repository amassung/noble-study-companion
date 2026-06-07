// All x/y/width/height are 0-1 ratios of the slide's rendered dimensions.
// This makes annotations resolution-independent.

export type AnnotationType = "text" | "draw" | "highlight";

export interface BaseAnnotation {
  id: string;
  noteId: string;
  slideKey: string;
  createdAt: number;
  updatedAt: number;
}

export interface TextAnnotationData {
  x: number;           // 0-1 ratio of slide width
  y: number;           // 0-1 ratio of slide height
  width: number;       // 0-1 ratio of slide width
  height?: number;     // 0-1 ratio of slide height; undefined = auto-size to content
  text: string;
  color: string;       // CSS color string
  fontSize: number;    // px
  fontWeight?: "normal" | "bold";
  fontStyle?: "normal" | "italic";
}

export interface DrawAnnotationData {
  points: [number, number, number][]; // [x, y, pressure] all 0-1 ratios except pressure
  color: string;
  size: number;    // stroke size in logical px
}

export interface HighlightAnnotationData {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;   // semi-transparent CSS color
}

export interface TextAnnotation extends BaseAnnotation {
  type: "text";
  data: TextAnnotationData;
}

export interface DrawAnnotation extends BaseAnnotation {
  type: "draw";
  data: DrawAnnotationData;
}

export interface HighlightAnnotation extends BaseAnnotation {
  type: "highlight";
  data: HighlightAnnotationData;
}

export type Annotation = TextAnnotation | DrawAnnotation | HighlightAnnotation;

// Raw row from Supabase
export interface AnnotationRow {
  id: string;
  note_id: string;
  user_id: string;
  slide_key: string;
  type: AnnotationType;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export function rowToAnnotation(row: AnnotationRow): Annotation {
  const base: BaseAnnotation = {
    id: row.id,
    noteId: row.note_id,
    slideKey: row.slide_key,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
  return { ...base, type: row.type, data: row.data } as Annotation;
}
