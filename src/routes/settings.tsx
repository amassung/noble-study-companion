import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Settings as SettingsIcon, Sun, Moon, Mail, LogOut, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth/auth-provider";
import { useTheme } from "@/lib/theme/theme-provider";
import { deleteAccount } from "@/lib/account/account.functions";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Nobi — Settings" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  const email = user?.email ?? "";
  const displayName: string =
    user?.user_metadata?.display_name ?? user?.user_metadata?.full_name ?? "";

  const handleSignOut = async () => {
    await signOut();
    void navigate({ to: "/login" });
  };

  const callDeleteAccount = useServerFn(deleteAccount);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    if (deleteText !== "DELETE") return;
    setDeleting(true);
    try {
      await callDeleteAccount();
      await signOut();
      toast.success("Your account and all data have been deleted.");
      void navigate({ to: "/login" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete account. Try again.");
      setDeleting(false);
    }
  };

  return (
    <div className="animate-float-in max-w-lg">
      {/* Page header */}
      <div className="mb-8 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-violet-soft text-primary ring-1 ring-primary/30">
          <SettingsIcon className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">Settings</h1>
          <p className="text-[12.5px] text-muted-foreground">Appearance and account.</p>
        </div>
      </div>

      {/* Appearance */}
      <section>
        <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Appearance
        </h2>
        <div className="rounded-xl border border-border/60 bg-[var(--surface)] p-5 shadow-card">
          <div className="flex items-center justify-between gap-6">
            <div>
              <div className="text-[14px] font-medium">Theme</div>
              <div className="mt-0.5 text-[12px] text-muted-foreground">
                Dark is the default. Light keeps the violet accent.
              </div>
            </div>
            {/* Segmented toggle */}
            <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-border/60 bg-[var(--surface-elevated)] p-1">
              <button
                onClick={() => setTheme("dark")}
                aria-pressed={theme === "dark"}
                className={[
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-all",
                  theme === "dark"
                    ? "bg-gradient-violet text-white shadow-glow"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                <Moon className="h-3.5 w-3.5" />
                Dark
              </button>
              <button
                onClick={() => setTheme("light")}
                aria-pressed={theme === "light"}
                className={[
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-all",
                  theme === "light"
                    ? "bg-gradient-violet text-white shadow-glow"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                <Sun className="h-3.5 w-3.5" />
                Light
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Account */}
      <section className="mt-6">
        <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Account
        </h2>
        <div className="space-y-0 rounded-xl border border-border/60 bg-[var(--surface)] shadow-card overflow-hidden">
          {/* Email row */}
          <div className="p-5">
            <div className="mb-2 text-[12px] font-medium text-muted-foreground">Email address</div>
            <div className="flex items-center gap-2.5 rounded-lg border border-border/40 bg-[var(--surface-elevated)]/60 px-3 py-2.5">
              <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate text-[13.5px] text-muted-foreground">{email}</span>
            </div>
            <p className="mt-1.5 text-[11.5px] text-muted-foreground/60">
              Contact support to change your email.
            </p>
          </div>

          {/* Divider */}
          <div className="mx-5 border-t border-border/40" />

          {/* Display name link to Profile */}
          <div className="p-5">
            <div className="mb-2 text-[12px] font-medium text-muted-foreground">Display name</div>
            <Link
              to="/profile"
              className="hover-glow group flex items-center justify-between rounded-lg border border-border/60 bg-[var(--surface-elevated)] px-3 py-2.5 text-[13.5px] transition-colors hover:border-primary/40"
            >
              <span>{displayName || <span className="text-muted-foreground">Not set</span>}</span>
              <span className="text-[11.5px] text-primary transition-transform group-hover:translate-x-0.5">
                Edit in Profile →
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* Sign out */}
      <div className="mt-6">
        <button
          onClick={() => void handleSignOut()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-[13.5px] font-medium text-destructive transition-colors hover:bg-destructive/20"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>

      {/* Danger zone — permanent account deletion (App Store 5.1.1(v)) */}
      <section className="mt-8">
        <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-destructive/80">
          Danger zone
        </h2>
        <div className="rounded-xl border border-destructive/30 bg-[var(--surface)] p-5 shadow-card">
          <div className="text-[14px] font-medium">Delete account</div>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Permanently deletes your account, all notes, notebooks, study guides, and uploaded
            files. This cannot be undone.
          </p>
          {!confirmingDelete ? (
            <button
              onClick={() => setConfirmingDelete(true)}
              className="mt-3 flex items-center gap-1.5 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-[12.5px] font-medium text-destructive transition-colors hover:bg-destructive/20"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete my account…
            </button>
          ) : (
            <div className="mt-3 space-y-2.5">
              <p className="text-[12px] text-destructive">
                Type <span className="font-semibold">DELETE</span> to confirm.
              </p>
              <input
                type="text"
                value={deleteText}
                onChange={(e) => setDeleteText(e.target.value)}
                placeholder="DELETE"
                autoComplete="off"
                className="w-full rounded-lg border border-destructive/40 bg-[var(--surface-elevated)] px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground/40 focus:border-destructive focus:outline-none"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => void handleDeleteAccount()}
                  disabled={deleteText !== "DELETE" || deleting}
                  className="flex items-center gap-1.5 rounded-lg bg-destructive px-3 py-2 text-[12.5px] font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {deleting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Deleting…
                    </>
                  ) : (
                    "Permanently delete"
                  )}
                </button>
                <button
                  onClick={() => {
                    setConfirmingDelete(false);
                    setDeleteText("");
                  }}
                  className="rounded-lg border border-border/60 bg-[var(--surface)] px-3 py-2 text-[12.5px] font-medium text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
