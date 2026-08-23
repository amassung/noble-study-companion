import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Nobi — iOS (Capacitor) configuration.
 *
 * Architecture note: Nobi is a TanStack Start SSR app whose server functions
 * (AI study guides, PDF import/condense, account deletion) run server-side,
 * so the production build emits no static index.html to bundle. The native
 * shell therefore loads the deployed site directly.
 *
 * `webDir` still points at the built client assets because the Capacitor CLI
 * requires the directory to exist; with `server.url` set, iOS loads the remote
 * site instead of those files.
 *
 * Follow-up (tracked): switch to TanStack Start's SPA + prerender mode so the
 * shell can be bundled locally and the app opens offline. That is what turns
 * this from a hosted wrapper into a genuinely native-feeling app, and it is
 * the recommended state before public App Store submission (guideline 4.2).
 */
const config: CapacitorConfig = {
  appId: "app.nobi.study",
  appName: "Nobi",
  webDir: ".vercel/output/static",
  server: {
    url: process.env.NOBI_IOS_SERVER_URL ?? "https://noble-study-companion.vercel.app",
    // Production HTTPS only — never allow cleartext.
    cleartext: false,
  },
  ios: {
    // Match the app's default light theme so the web view does not flash a
    // dark background before the first paint.
    backgroundColor: "#fafaf8",
    // Nobi handles its own scrolling inside the note editor.
    scrollEnabled: true,
    contentInset: "always",
  },
};

export default config;
