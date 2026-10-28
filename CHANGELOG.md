# Changelog

## Faza 2 — Kostur (u tijeku, nije deployano)

### Napravljeno
- Next.js 16 (App Router, TypeScript, Tailwind), `lang="hr"`, font s `latin-ext` (č, ć, š, ž, đ).
- Supabase: `supabase/config.toml` (Google provider, lokalni redirect URL-ovi), migracija `20261028000001_profiles.sql`:
  - tablica `profiles` (plan, `trial_tests_left` default 3, `paid_until`),
  - RLS: korisnik čita samo svoj redak i mijenja samo stupac `ime`; plan/proba/`paid_until` samo server,
  - trigger `on_auth_user_created` stvara profil pri prvoj prijavi.
- Google prijava (PKCE): `/prijava`, `/auth/callback`, `/auth/odjava`; sesija se osvježava u `src/proxy.ts` (Next 16: `proxy`, ne `middleware`), provjera preko `getClaims()`.
- Zaštićena ruta `/app` (preusmjerenje na `/prijava` bez prijave) i `safeNextPath` protiv open redirecta.
- Testovi: jedinični (`npm test`, 4/4 prolaze), RLS (`npm run test:rls`, **još nije pokrenut**, traži Docker).

### Provjereno
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` prolaze.

### Nije provjereno / otvoreno
- RLS testovi nisu pokrenuti (Docker Desktop se ne pokreće na ovom računalu).
- Nema Supabase projekta, Google OAuth klijenta ni Vercel deploya, pa prijava nije isprobana ni lokalno ni u produkciji.

## Lokalni rad

```bash
cp .env.example .env.local        # popuniti ključeve iz `npx supabase status -o env`
npm run db:start                  # lokalni Supabase (treba Docker)
npm run dev
npm run test:rls                  # treba .env.rls.local sa SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY
```

Za lokalni Supabase s uključenim Google providerom treba `supabase/.env` s `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` i `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET` (za RLS testove mogu biti proizvoljne vrijednosti).
