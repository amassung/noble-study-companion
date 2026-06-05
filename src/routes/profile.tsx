import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { User, LogOut, Mail, Pencil, Check, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth/auth-provider";
import { getSupabaseClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Nobi — Profile" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const email = user?.email ?? "";
  const storedName: string =
    user?.user_metadata?.display_name ?? user?.user_metadata?.full_name ?? "";
  const initials = storedName
    ? storedName
        .split(" ")
        .map((w: string) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : email.slice(0, 2).toUpperCase();

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      })
    : null;

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(storedName);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (name.trim() === storedName) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.updateUser({
        data: { display_name: name.trim() },
      });
      if (error) throw error;
      toast.success("Display name updated");
      setEditing(false);
    } catch {
      toast.error("Failed to save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setName(storedName);
    setEditing(false);
  };

  const handleSignOut = async () => {
    await signOut();
    void navigate({ to: "/login" });
  };

  return (
    <div className="animate-float-in max-w-lg">
      {/* Page header */}
      <div className="mb-8 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-violet-soft text-primary ring-1 ring-primary/30">
          <User className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">Profile</h1>
          <p className="text-[12.5px] text-muted-foreground">Your account and identity.</p>
        </div>
      </div>

      {/* Avatar + summary card */}
      <div className="rounded-xl border border-border/60 bg-[var(--surface)] p-5 shadow-card">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 select-none items-center justify-center rounded-2xl bg-gradient-violet text-xl font-semibold text-white shadow-glow">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[17px] font-semibold">
              {storedName || email.split("@")[0]}
            </div>
            <div className="mt-0.5 truncate text-[12.5px] text-muted-foreground">{email}</div>
            {memberSince && (
              <div className="mt-1 text-[11.5px] text-muted-foreground/70">
                Member since {memberSince}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Display name editor */}
      <div className="mt-4 rounded-xl border border-border/60 bg-[var(--surface)] p-5 shadow-card">
        <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Display Name
        </p>
        {editing ? (
          <div className="flex items-center gap-2">
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSave();
                if (e.key === "Escape") handleCancel();
              }}
              placeholder="Your name"
              className="flex-1 bg-[var(--surface-elevated)]"
              maxLength={60}
            />
            <Button
              size="icon"
              variant="ghost"
              onClick={() => void handleSave()}
              disabled={saving}
              className="h-9 w-9 text-primary hover:text-primary"
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={handleCancel}
              className="h-9 w-9 text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="group flex w-full items-center justify-between rounded-lg border border-border/60 bg-[var(--surface-elevated)] px-3 py-2.5 text-left transition-colors hover:border-primary/40"
          >
            <span className="text-[14px]">
              {name || (
                <span className="text-muted-foreground">Add a display name…</span>
              )}
            </span>
            <Pencil className="h-3.5 w-3.5 text-muted-foreground/60 transition-colors group-hover:text-primary" />
          </button>
        )}
      </div>

      {/* Email (read-only) */}
      <div className="mt-4 rounded-xl border border-border/60 bg-[var(--surface)] p-5 shadow-card">
        <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Email Address
        </p>
        <div className="flex items-center gap-2.5 rounded-lg border border-border/40 bg-[var(--surface-elevated)]/60 px-3 py-2.5">
          <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate text-[14px] text-muted-foreground">{email}</span>
        </div>
        <p className="mt-2 text-[11.5px] text-muted-foreground/60">
          Contact support to change your email address.
        </p>
      </div>

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
    </div>
  );
}
