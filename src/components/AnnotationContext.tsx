import { createContext, useContext, useState, type ReactNode } from "react";

export type AnnotationMode = "none" | "text" | "draw" | "highlight" | "erase";

export const DRAW_COLORS = [
  { label: "Black", value: "#000000" },
  { label: "White", value: "#FFFFFF" },
  { label: "Violet", value: "#7C3AED" },
  { label: "Red", value: "#EF4444" },
] as const;

export const HIGHLIGHT_COLORS = [
  { label: "Yellow", value: "rgba(250,204,21,0.4)" },
  { label: "Violet", value: "rgba(167,139,250,0.35)" },
] as const;

interface AnnotationContextValue {
  mode: AnnotationMode;
  setMode: (m: AnnotationMode) => void;
  drawColor: string;
  setDrawColor: (c: string) => void;
  highlightColor: string;
  setHighlightColor: (c: string) => void;
  drawSize: number;
  setDrawSize: (s: number) => void;
}

const AnnotationContext = createContext<AnnotationContextValue | null>(null);

export function AnnotationProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<AnnotationMode>("none");
  const [drawColor, setDrawColor] = useState(DRAW_COLORS[0].value);
  const [highlightColor, setHighlightColor] = useState(HIGHLIGHT_COLORS[0].value);
  const [drawSize, setDrawSize] = useState(4);

  return (
    <AnnotationContext.Provider
      value={{
        mode,
        setMode,
        drawColor,
        setDrawColor,
        highlightColor,
        setHighlightColor,
        drawSize,
        setDrawSize,
      }}
    >
      {children}
    </AnnotationContext.Provider>
  );
}

export function useAnnotationContext() {
  const ctx = useContext(AnnotationContext);
  if (!ctx) throw new Error("useAnnotationContext must be used inside AnnotationProvider");
  return ctx;
}
