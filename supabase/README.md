# Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. **Authentication → Providers → Email**: enable Email sign-in.
3. **Authentication → Providers → Email**: turn **off** “Confirm email” so users can sign in immediately after sign-up.
4. Open **SQL Editor**, paste and run `migrations/20250603000000_initial.sql`.
5. Copy **Project URL** and **anon public** key into `.env.local` (see `.env.example`).
