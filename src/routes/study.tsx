import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/Placeholder";
import { Brain } from "lucide-react";

export const Route = createFileRoute("/study")({
  head: () => ({ meta: [{ title: "Nobi — Study Mode" }] }),
  component: () => (
    <Placeholder
      icon={<Brain className="h-5 w-5" />}
      title="Study Mode"
      description="Flashcards, quizzes, and focused sessions generated from your notes."
    />
  ),
});
