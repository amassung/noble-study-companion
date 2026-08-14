# Nobi — iOS / TestFlight release

Nobi ships to iOS as a Capacitor app built **in the cloud on Codemagic**, so no
local Xcode install is needed.

## How the iOS app works

The native shell loads the deployed site (`capacitor.config.ts` → `server.url`,
currently `https://noble-study-companion.vercel.app`). Nobi is a TanStack Start
SSR app whose server functions (AI study guides, PDF import, account deletion)
run server-side, so there is no static `index.html` to bundle.

Consequences to be aware of:

- The app **requires a network connection** — there is no offline mode yet.
- Shipping a new web version to Vercel updates the iOS app instantly, with no
  new build required.
- Before **public App Store** submission, move to TanStack Start's SPA +
  prerender mode so the shell is bundled locally and the app opens offline.
  Apple applies guideline 4.2 ("minimum functionality") most strictly to apps
  that are only a hosted web view. TestFlight **internal** testing does not go
  through this review, so this setup is fine for beta testing now.

## One-time setup

1. **App Store Connect API key**
   App Store Connect → Users and Access → Integrations → App Store Connect API
   → generate a key with the **App Manager** role. Download the `.p8` (you can
   only download it once) and note the Key ID and Issuer ID.

2. **Register the app**
   App Store Connect → Apps → **+** → New App
   - Platform: iOS
   - Bundle ID: `app.nobi.study` (register it in the Developer Portal first if
     it is not in the dropdown)
   - SKU: `nobi-study`

3. **Codemagic**
   - Sign in at [codemagic.io](https://codemagic.io) with GitHub and add the
     `noble-study-companion` repository.
   - Teams → Integrations → **Apple Developer Portal** → connect the API key
     from step 1 and name the integration exactly:
     ```
     nobi_app_store_connect
     ```
     (`codemagic.yaml` references this name.)

4. **Run it** — start the `ios-testflight` workflow. Codemagic builds, signs,
   and uploads to TestFlight. Build numbers auto-increment from Codemagic's
   build counter.

## Testers

- **Internal** (up to 100 App Store Connect users): available minutes after
  processing, **no Apple review**. Use this to test Apple Pencil on a real iPad.
- **External** (up to 10,000): requires Beta App Review — lighter than App Store
  review, usually about a day.

## Environment / server checklist

The iOS app talks to the same backend as the website, so these must be correct
in **Vercel** or features fail inside the app:

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Auth + data |
| `ANTHROPIC_API_KEY` | AI study guides, PDF condense |
| `SUPABASE_SERVICE_ROLE_KEY` | **Account deletion** (App Store 5.1.1(v)) — server-only |

Database migrations in `supabase/migrations/` must all be applied, including:
`notebook_paper`, `note_paper`, `note_boxes`, `note_ink`.

## Local commands

```bash
npm run ios:sync   # copy web assets + update the native project
npm run ios:open   # open in Xcode (only if Xcode is installed)
```

## Before public App Store submission

- [ ] Bundle the app shell (SPA + prerender) and add offline support
- [ ] Privacy policy URL + App Privacy answers (Nobi stores notes and email)
- [ ] Screenshots (6.7" iPhone + 12.9" iPad)
- [ ] Confirm account deletion works end-to-end in the built app
