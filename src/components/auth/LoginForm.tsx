import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthForm, AuthLink } from "@/components/auth/AuthForm";
import { getSupabaseClient } from "@/lib/supabase/client";

export function LoginForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      toast.error("Enter your email above first, then tap Forgot password.");
      return;
    }
    setResetting(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Password reset email sent — check your inbox.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send reset email");
    } finally {
      setResetting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthForm
      title="Welcome back"
      subtitle="Sign in to access your notes on any device."
      footer={
        <>
          Don&apos;t have an account? <AuthLink to="/signup">Sign up</AuthLink>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@university.edu"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>
        <Button type="submit" className="w-full bg-gradient-violet shadow-glow" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </Button>
      </form>
      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => void handleForgotPassword()}
          disabled={resetting}
          className="text-[12px] text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          {resetting ? "Sending…" : "Forgot password?"}
        </button>
        <Link to="/signup" className="text-[12px] text-muted-foreground hover:text-foreground">
          Create an account
        </Link>
      </div>
    </AuthForm>
  );
}
