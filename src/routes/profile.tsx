import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/Placeholder";
import { User } from "lucide-react";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Nobi — Profile" }] }),
  component: () => (
    <Placeholder
      icon={<User className="h-5 w-5" />}
      title="Profile"
      description="Your account, plan, and study identity."
    />
  ),
});
