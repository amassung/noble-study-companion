import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/Placeholder";
import { Search as SearchIcon } from "lucide-react";

export const Route = createFileRoute("/search")({
  head: () => ({ meta: [{ title: "Nobi — Search" }] }),
  component: () => (
    <Placeholder
      icon={<SearchIcon className="h-5 w-5" />}
      title="Search"
      description="Search across every note, flashcard, and study guide."
    />
  ),
});
