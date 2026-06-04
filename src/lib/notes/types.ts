import type { Subject } from "@/components/NoteCard";
import type { StudyGuide } from "@/lib/study-guide.functions";

export type SavedGuide = {
  id: string;
  createdAt: number;
  guide: StudyGuide;
};

export type StoredNote = {
  id: string;
  title: string;
  body: string;
  subject: Subject;
  subjectLabel?: string;
  testDate?: number | null;
  createdAt: number;
  updatedAt: number;
  guides?: SavedGuide[];
};

export const NOTE_SUBJECTS: Subject[] = ["violet", "blue", "green", "amber"];
