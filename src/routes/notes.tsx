import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/Placeholder";
import { NotebookPen } from "lucide-react";

export const Route = createFileRoute("/notes")({
  head: () => ({ meta: [{ title: "Nobi — My Notes" }] }),
  component: () => (
    <Placeholder
      icon={<NotebookPen className="h-5 w-5" />}
      title="My Notes"
      description="All your notes, organized by class and tag. Coming together next."
    />
  ),
});
