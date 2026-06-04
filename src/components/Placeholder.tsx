import type { ReactNode } from "react";

export function Placeholder({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="animate-float-in">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-violet-soft text-primary ring-1 ring-primary/30">
          {icon}
        </span>
        <h1 className="text-[28px] font-semibold tracking-tight">{title}</h1>
      </div>
      <p className="mt-3 max-w-xl text-[14px] text-muted-foreground">{description}</p>

      <div className="mt-8 rounded-xl border border-dashed border-border/70 bg-[var(--surface)]/60 p-10 text-center shadow-card">
        <p className="text-[13px] text-muted-foreground">
          This screen is on the runway. Tell Nobi what to build here next.
        </p>
      </div>
    </div>
  );
}
