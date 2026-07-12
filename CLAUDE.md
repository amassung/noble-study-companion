# Nobi — Study Companion

AI-powered study app for college students. Students take notes; Nobi turns them into structured study guides (key concepts, terms, practice questions).

## Tech stack

- **Framework**: [TanStack Start](https://tanstack.com/start) (SSR React meta-framework on Vite + Nitro)
- **Router**: TanStack Router (file-based, `routeTree.gen.ts` is auto-generated — do not edit)
- **Data**: TanStack Query
- **UI**: React 19, Tailwind CSS v4 (`@tailwindcss/vite`), shadcn/ui components (Radix primitives) in `src/components/ui/`
- **Auth + DB**: Supabase (`@supabase/ssr`, `@supabase/supabase-js`)
- **AI**: Anthropic Claude API (direct `fetch` to `/v1/messages`, no SDK)
- **Language**: TypeScript
- **Runtime/PM**: Bun (`bun.lock`, `bunfig.toml`)
- **Forms/validation**: react-hook-form + Zod
- **Notifications**: Sonner toasts
- **Deploy target**: Vercel (Nitro `vercel` preset, see `vite.config.ts`); `src/server.ts` is a generic fetch-handler wrapper, not Cloudflare-specific

## Run

```bash
bun install
bun run dev          # vite dev
bun run build
bun run lint
bun run format
```

Required env vars (in `.env.local`):
- `ANTHROPIC_API_KEY` — for study guide generation
- `ANTHROPIC_MODEL` — optional, defaults to `claude-haiku-4-5`
- Supabase URL + anon key (see `src/lib/supabase/client.ts`)

`VITE_*` vars are public/client-visible; everything else is server-only.

## Structure

```
src/
  start.ts              TanStack Start instance + global error middleware
  server.ts             Worker fetch entry; normalizes h3-swallowed SSR 500s
  router.tsx            Router factory with QueryClient context
  routeTree.gen.ts      AUTO-GENERATED — do not edit
  styles.css            Tailwind v4 entry
  routes/
    __root.tsx          Root shell, head/meta, AuthProvider + AuthGate, Toaster
    index.tsx           Landing
    login.tsx, signup.tsx
    notes.tsx           Notes list/editor
    study.tsx           Study guide view
    progress.tsx, search.tsx, settings.tsx, profile.tsx
  components/
    AppShell.tsx, NoteCard.tsx, NoteEditor.tsx,
    StudyGuideModal.tsx, Placeholder.tsx
    ui/                 shadcn/ui primitives
  hooks/
    use-mobile.tsx
  lib/
    study-guide.functions.ts   AI study guide generation (server fn) ★
    config.server.ts           Server-only config helper
    error-capture.ts           Captures last unhandled error for SSR fallback
    error-page.ts              HTML for 500 page
    lovable-error-reporting.ts Client-side error reporter
    utils.ts                   `cn()` Tailwind merge helper
    auth/
      auth-provider.tsx        Supabase session context
      auth-gate.tsx            Redirects unauth users; allows public paths
      public-paths.ts          Routes that bypass AuthGate
    supabase/
      client.ts                Supabase browser + SSR client factory
    notes/
      types.ts                 Note shape, Subject union ('violet'|'blue'|'green'|'amber')
      notes-api.ts             CRUD against Supabase
      use-notes.ts             TanStack Query hooks
      format.ts                Display helpers
      migrate-local-notes.ts   One-time localStorage → Supabase migration
    api/
      example.functions.ts     Server fn example/template
supabase/
  migrations/20250603000000_initial.sql   Schema + RLS
```

## Key file: study guide generation

`src/lib/study-guide.functions.ts` exports `generateStudyGuide`, a TanStack Start `createServerFn` (`method: "POST"`):

- Input validator: `{ title, body, subjectLabel? }`; body capped at 12k chars.
- Reads `process.env.ANTHROPIC_API_KEY` **inside the handler** (Cloudflare binds env per request — never read at module scope).
- Model: `process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5"`, `max_tokens: 4096`.
- Direct `fetch` to `https://api.anthropic.com/v1/messages` with `anthropic-version: 2023-06-01`.
- System prompt instructs JSON-only output matching `StudyGuide` shape:
  ```ts
  { title, keyConcepts[], importantTerms[], practiceQuestions[] }
  ```
- `tryParse` strips code fences and falls back to slicing the first `{…}` block.
- Defensive coercion + array length caps before returning.
- Maps 429 / 401 / 403 to user-facing error messages.

## Database (Supabase)

Schema in `supabase/migrations/20250603000000_initial.sql`. Both tables have **RLS enabled**; all policies key off `auth.uid() = user_id`.

### `public.notes`
- `id uuid pk`, `user_id uuid → auth.users(id) on delete cascade`
- `title text`, `body text`, `subject text` (check: `'violet'|'blue'|'green'|'amber'`), `subject_label text`
- `test_date timestamptz`, `created_at`, `updated_at`
- Indexes on `user_id` and `(user_id, updated_at desc)`
- Policies: select / insert / update / delete own

### `public.study_guides`
- `id uuid pk`, `note_id uuid → notes(id) on delete cascade`, `user_id uuid → auth.users(id) on delete cascade`
- `guide jsonb` (stores the `StudyGuide` JSON), `created_at`
- Index on `note_id`
- Policies: select / insert / delete own; insert also verifies the referenced note belongs to the user.

## Conventions

- **Server functions**: use `createServerFn` from `@tanstack/react-start` with an `.inputValidator()` before `.handler()`. Server-only files use `.server.ts` (or `.functions.ts` for server fns) so Vite excludes them from the client bundle.
- **Env access**: read `process.env.*` *inside* handlers, not at module scope (Cloudflare Workers binds per-request). Public values use `VITE_` prefix + `import.meta.env`. See `src/lib/config.server.ts` for the rationale comment.
- **Error handling**: a `startInstance` middleware wraps every request; `server.ts` additionally unwraps h3's `{"unhandled":true,"message":"HTTPError"}` 500 bodies into a real error page via `error-capture` + `error-page`. Client errors are reported via `reportLovableError`.
- **Auth flow**: `AuthProvider` exposes session; `AuthGate` redirects unauthenticated users except for paths in `public-paths.ts`.
- **Subjects** are a fixed enum of color tokens (`violet`, `blue`, `green`, `amber`) with a free-text `subject_label` for display.
- **UI**: shadcn/ui style — primitives live in `src/components/ui/`, composed in feature components. Use `cn()` from `lib/utils.ts` for class merging. Dark theme is the design target.
- **Routes**: file-based; `routeTree.gen.ts` regenerates on dev — never hand-edit.
- **Toasts**: `sonner` (`<Toaster richColors position="top-center" />` mounted in `__root.tsx`).
- **No README in routes**: `src/routes/README.md` exists as routing reference; not a route.
