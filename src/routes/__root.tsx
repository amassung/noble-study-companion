import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthGate } from "../lib/auth/auth-gate";
import { AuthProvider } from "../lib/auth/auth-provider";
import { ThemeProvider } from "../lib/theme/theme-provider";
import { OfflineQueryProvider } from "../lib/offline/OfflineQueryProvider";
import { OfflineBanner } from "../components/OfflineBanner";
import { Toaster } from "../components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      // interactive-widget tells the browser to shrink the layout viewport
      // when the on-screen keyboard appears, rather than overlaying content.
      // With it, ordinary scrolling keeps the caret visible; without it the
      // page has to chase the caret manually, which is the bug students hit
      // when typing past the fold. Ignored where unsupported.
      {
        name: "viewport",
        // maximum-scale/user-scalable stop WKWebView running its own pinch
        // zoom. The page owns zooming — focal point, momentum, and ink
        // re-rasterised sharp at the new scale — and the browser's version
        // fights it, scaling the whole UI including the toolbar. That is the
        // "it feels like Safari" complaint, because it was Safari.
        content:
          "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, interactive-widget=resizes-content",
      },
      // Matches the light default (--background), so browser and PWA chrome
      // don't render a dark bar above a white app.
      { name: "theme-color", content: "#fafaf8" },
      { title: "Nobi — Study, smarter." },
      {
        name: "description",
        content:
          "Nobi turns your notes into study guides, flashcards, and focused study sessions — built for students.",
      },
      { property: "og:title", content: "Nobi — Study, smarter." },
      {
        property: "og:description",
        content: "AI-powered notes and study guides for college students.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
      },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="light">
      <head>
        {/* Anti-flash: light is the default, so the server already renders
            with the class. Only an explicit "dark" choice removes it — doing
            it this way round means no flash of the wrong theme either way. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('nobi:theme')==='dark')document.documentElement.classList.remove('light')}catch(e){}`,
          }}
        />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

/**
 * Register the offline service worker.
 *
 * Deliberately after load: registration competes with the first paint for
 * bandwidth, and the worker is for the *next* visit, never this one.
 */
function useServiceWorker() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    if (import.meta.env.DEV) return; // dev serves unbundled modules; caching them helps nobody
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        // Not fatal — the app simply stays online-only.
        console.warn("Service worker registration failed", err);
      });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useServiceWorker();

  return (
    <OfflineQueryProvider queryClient={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <AuthGate>
            <Outlet />
          </AuthGate>
          <OfflineBanner />
          <Toaster richColors position="top-center" />
        </AuthProvider>
      </ThemeProvider>
    </OfflineQueryProvider>
  );
}
