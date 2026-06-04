import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/Placeholder";
import { Settings as SettingsIcon } from "lucide-react";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Nobi — Settings" }] }),
  component: () => (
    <Placeholder
      icon={<SettingsIcon className="h-5 w-5" />}
      title="Settings"
      description="Account, appearance, and study preferences."
    />
  ),
});
