import { createFileRoute } from "@tanstack/react-router";
import { SignUpForm } from "@/components/auth/SignUpForm";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [{ title: "Nobi — Sign up" }],
  }),
  component: SignUpPage,
});

function SignUpPage() {
  return <SignUpForm />;
}
