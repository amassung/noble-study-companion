import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/Placeholder";
import { BarChart3 } from "lucide-react";

export const Route = createFileRoute("/progress")({
  head: () => ({ meta: [{ title: "Nobi — Progress" }] }),
  component: () => (
    <Placeholder
      icon={<BarChart3 className="h-5 w-5" />}
      title="Progress"
      description="Your study streaks, mastery, and weekly trends."
    />
  ),
});
