import { Navigate, Outlet, useRouterState } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "./auth-provider";
import { isAuthPublicPath } from "./public-paths";

function AuthLoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm">Loading…</p>
      </div>
    </div>
  );
}

function ConfigErrorScreen({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-md text-center">
        <h1 className="text-lg font-semibold text-foreground">Configuration required</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <p className="mt-4 text-xs text-muted-foreground">
          See <code className="text-foreground">.env.example</code> and{" "}
          <code className="text-foreground">supabase/README.md</code>.
        </p>
      </div>
    </div>
  );
}

export function AuthGate({ children }: { children?: ReactNode }) {
  const { user, loading, configError } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isPublic = isAuthPublicPath(pathname);

  if (configError) {
    return <ConfigErrorScreen message={configError} />;
  }

  if (loading) {
    return <AuthLoadingScreen />;
  }

  if (!user && !isPublic) {
    return <Navigate to="/login" replace />;
  }

  if (user && isPublic) {
    return <Navigate to="/" replace />;
  }

  if (isPublic) {
    return <>{children ?? <Outlet />}</>;
  }

  return <AppShell>{children ?? <Outlet />}</AppShell>;
}
