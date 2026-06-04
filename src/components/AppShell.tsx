import type { LucideIcon } from "lucide-react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home,
  NotebookPen,
  Brain,
  BarChart3,
  Settings,
  Search,
  User,
  Sparkles,
} from "lucide-react";
import { type ReactNode } from "react";
import { LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-provider";

type NavItem = { to: string; label: string; icon: LucideIcon };

const desktopNav: NavItem[] = [
  { to: "/", label: "Home", icon: Home },
  { to: "/notes", label: "My Notes", icon: NotebookPen },
  { to: "/study", label: "Study Mode", icon: Brain },
  { to: "/progress", label: "Progress", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
];

const mobileNav: NavItem[] = [
  { to: "/", label: "Home", icon: Home },
  { to: "/notes", label: "Notes", icon: NotebookPen },
  { to: "/study", label: "Study", icon: Brain },
  { to: "/search", label: "Search", icon: Search },
  { to: "/profile", label: "Profile", icon: User },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, signOut } = useAuth();
  const email = user?.email ?? "";
  const displayEmail = email.length > 28 ? `${email.slice(0, 25)}…` : email;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside
        className="fixed inset-y-0 left-0 z-40 hidden w-[240px] flex-col border-r border-border/40 lg:flex"
        style={{ backgroundColor: "var(--sidebar-bg)" }}
      >
        <div className="flex items-center gap-2.5 px-6 pt-7 pb-8">
          <div className="bg-gradient-violet flex h-9 w-9 items-center justify-center rounded-lg shadow-glow">
            <Sparkles className="h-4.5 w-4.5 text-white" strokeWidth={2.5} />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-[17px] font-semibold tracking-tight">Nobi</span>
            <span className="text-[11px] text-muted-foreground">Study, smarter.</span>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3">
          {desktopNav.map(({ to, label, icon: Icon }) => {
            const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={[
                  "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] font-medium transition-all duration-200",
                  active
                    ? "bg-gradient-violet-soft text-foreground"
                    : "text-muted-foreground hover:bg-white/[0.03] hover:text-foreground",
                ].join(" ")}
              >
                {active && (
                  <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-primary shadow-glow" />
                )}
                <Icon
                  className={[
                    "h-[18px] w-[18px] transition-colors",
                    active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                  ].join(" ")}
                  strokeWidth={2}
                />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mx-3 mb-3 space-y-2">
          {displayEmail ? (
            <p className="truncate px-2 text-[11px] text-muted-foreground" title={email}>
              {displayEmail}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => void signOut()}
            className="hover-glow flex w-full items-center justify-center gap-2 rounded-lg border border-border/60 bg-[var(--surface)] px-3 py-2 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="lg:pl-[240px]">
        <div className="mx-auto w-full max-w-6xl px-5 pb-28 pt-8 sm:px-8 lg:pb-12">
          {children}
        </div>
      </main>

      {/* Mobile bottom tab bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border/40 backdrop-blur-xl lg:hidden"
        style={{ backgroundColor: "color-mix(in oklab, var(--sidebar-bg) 85%, transparent)" }}
      >
        <ul className="mx-auto flex max-w-md items-stretch justify-between px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
          {mobileNav.map(({ to, label, icon: Icon }) => {
            const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
            return (
              <li key={to} className="flex-1">
                <Link
                  to={to}
                  className="flex flex-col items-center gap-1 rounded-lg py-1.5 text-[10.5px] font-medium transition-colors"
                >
                  <span
                    className={[
                      "flex h-9 w-12 items-center justify-center rounded-lg transition-all",
                      active
                        ? "bg-gradient-violet-soft text-primary shadow-glow"
                        : "text-muted-foreground",
                    ].join(" ")}
                  >
                    <Icon className="h-[19px] w-[19px]" strokeWidth={active ? 2.4 : 2} />
                  </span>
                  <span className={active ? "text-foreground" : "text-muted-foreground"}>
                    {label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
