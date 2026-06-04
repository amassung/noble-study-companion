import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";

type Props = {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
};

export function AuthForm({ title, subtitle, children, footer }: Props) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-5 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 -z-10 h-[420px] w-[820px] -translate-x-1/2 rounded-full opacity-40 blur-3xl"
        style={{
          background:
            "radial-gradient(ellipse at center, oklch(0.55 0.24 295 / 0.5), transparent 60%)",
        }}
      />

      <div className="mb-8 flex flex-col items-center gap-2">
        <div className="bg-gradient-violet flex h-11 w-11 items-center justify-center rounded-xl shadow-glow">
          <Sparkles className="h-5 w-5 text-white" strokeWidth={2.5} />
        </div>
        <span className="text-[20px] font-semibold tracking-tight">Nobi</span>
      </div>

      <div className="w-full max-w-[400px] rounded-2xl border border-border/60 bg-[var(--surface-elevated)] p-6 shadow-card sm:p-8">
        <h1 className="text-[22px] font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="mt-1.5 text-[13px] text-muted-foreground">{subtitle}</p>
        <div className="mt-6">{children}</div>
        <div className="mt-6 text-center text-[13px] text-muted-foreground">{footer}</div>
      </div>
    </div>
  );
}

export function AuthLink({ to, children }: { to: "/login" | "/signup"; children: ReactNode }) {
  return (
    <Link to={to} className="font-medium text-primary hover:underline">
      {children}
    </Link>
  );
}
