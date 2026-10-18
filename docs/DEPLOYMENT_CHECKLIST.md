# Hackathon deployment checklist

This is a preparation checklist. It does not push to GitHub, create a Vercel deployment, link Supabase, or apply a remote migration.

## Current repository state

- Branch: `main`.
- Existing commit: `2389364 chore: establish project foundation`.
- No remote is configured in the current checkout.
- The working tree contains uncommitted product, migration and test changes. Review and commit intentionally before connecting GitHub; do not include `.env.local`, `.DS_Store`, `.next`, `node_modules`, databases or logs.

## Environment variables

Configure these in Vercel Project Settings → Environment Variables for Preview and Production as appropriate:

| Variable | Required | Exposure | Purpose |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Browser-safe | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Browser-safe, RLS-protected | Supabase publishable/anon key. |
| `GROQ_API_KEY` | Optional | Server-only | Groq API credential. Never prefix with `NEXT_PUBLIC_`. |
| `GROQ_MODEL` | Optional with fallback | Server-only | A currently supported Groq model identifier. |

The current application does not use a Supabase service-role key. Never paste secrets into source files, client components, browser storage, logs or issue trackers. `.env.example` contains names only.

## Supabase Cloud setup

1. Create or select the intended Supabase Cloud project.
2. In Authentication → URL Configuration, set the production Site URL to the final Vercel URL, for example `https://your-production-domain.example`.
3. Add the exact production URL to Additional Redirect URLs. During preview testing, add only the specific Vercel preview URL(s) being tested; remove temporary URLs afterward.
4. Confirm email confirmation and password policies before inviting test users.
5. Review every migration in `supabase/migrations/` in timestamp order.
6. From a checked-out release branch, link the Supabase CLI to the intended project and inspect the planned diff:

   ```bash
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase db diff --linked
   ```

7. Apply only after explicit approval:

   ```bash
   npx supabase db push
   ```

Never use `supabase db reset` against Cloud or any database containing data to preserve. Local `db reset` is for disposable test environments only.

## Local release gate

Run from the release checkout:

```bash
npm ci
npm run test:unit
npm run typecheck
npm run build
npx supabase db lint --local
for test in supabase/tests/*.sql; do npx supabase test db --local "$test" || exit 1; done
git diff --check
```

The current local evidence is 48 unit tests across 12 files, 123 pgTAP assertions across 8 suites, a passing typecheck, production build and local schema lint. These do not prove a Cloud deployment or two-account browser journey.

## GitHub and Vercel

1. Review `git status`, remove unrelated files from the release, and commit the intended source, migrations, tests, docs and `.env.example`.
2. Create or select a GitHub repository and push the reviewed branch. Do not push `.env.local` or secrets.
3. In Vercel, import the GitHub repository. Use the detected Next.js framework, the repository root, `npm ci` for installation and `npm run build` for the build command.
4. Configure the public Supabase variables for Preview and Production. Configure Groq variables only where AI explanations are desired.
5. Deploy a Preview first. Run the smoke checklist below, then promote to Production only after the preview and Cloud migration review pass.

## Demonstration smoke test

- Open the preview URL and confirm `/`, `/signup`, and `/invite` render.
- Register, confirm email if enabled, sign in, refresh, and sign out.
- Create a family workspace and invite a disposable student/parent account.
- Accept with the intended email; verify wrong-email and expired-token rejection.
- Create a student profile, budget and roadmap; confirm paise calculations and funding gaps.
- Add college options with missing and historical provenance; confirm no guarantees are shown.
- Add a scholarship, opportunity criteria and tasks; confirm only explicitly confirmed eligible aid affects funding.
- Toggle each sharing switch and verify the parent sees only consented categories.
- Confirm an unrelated account cannot read or mutate the family.
- Switch English/Telugu and refresh; verify the preference persists.
- With Groq variables absent, confirm rule-based guidance appears and the workspace remains usable.

## Go/no-go

Go only when the intended GitHub commit is reviewed, the Supabase migration plan is approved, the preview has passed two disposable-account smoke testing, and Vercel environment variables are configured without secrets in the repository. Current status is **NO-GO for production deployment** because the working tree is uncommitted, no Git remote is configured, no Cloud project has been linked, and the two-account browser flows remain manual/unverified.
