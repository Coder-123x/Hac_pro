# Engineering Education Planner

Decision-support platform for families planning engineering education, initially for Andhra Pradesh. The current app includes authenticated family workspaces, the Phase 4 education-budget affordability planner, a manual AP EAPCET comparison workflow, and a provenance-aware scholarship navigator. Career and AI guidance modules remain out of scope for this phase.

## Stack

- Next.js, React, TypeScript, and Tailwind CSS
- Supabase PostgreSQL and Authentication
- Groq API for server-side AI guidance (to be connected in the next phase)
- GitHub and Vercel for source control and deployment

## Setup

1. Install Node.js 22 or later and npm.
2. Copy `.env.example` to `.env.local` and supply values from the relevant provider dashboards.
3. Install and run:

   ```bash
   npm install
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL, safe for browser configuration. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable/anonymous key, subject to RLS. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only administrative Supabase key. |
| `GROQ_API_KEY` | Server-only Groq API key. |

Never commit `.env.local` or real credentials.

## Checks

```bash
npm run typecheck
npm run build
```

## Database migrations

The database foundation is defined as versioned SQL in `supabase/migrations/`, applied in timestamp order:

1. `20261017000000_family_foundation.sql`
2. `20261017162044_affordability_foundation.sql`
3. `20261017173000_college_affordability.sql`
4. `20261017180000_scholarship_navigator.sql`
5. `20261017183000_family_sharing_preferences.sql`
6. `20261017190000_invitation_email_hardening.sql`

These migrations have not been applied to a remote Supabase project by this repository.

After installing and authenticating the Supabase CLI, either start a local Supabase stack and run `supabase migration up`, or link the intended project and run `supabase db push`. Review the migration before applying it: it creates RLS policies and authenticated RPCs for creating family workspaces and issuing or accepting invitations.

### Database authorization tests

The pgTAP suites in `supabase/tests/` exercise family/invitation, affordability, college, scholarship and sharing RLS boundaries. They require Docker (or a compatible container runtime) and the Supabase CLI; they do not require remote credentials.

```bash
npx supabase start
npx supabase db reset
for test in supabase/tests/*.sql; do npx supabase test db --local "$test"; done
```

The test transaction rolls back its fixtures. Run the suite locally before pushing migrations to any real Supabase project.

## Authenticated workspace setup

The Phase 3 workspace requires the Phase 2 migration to be applied to the target project and the two `NEXT_PUBLIC_SUPABASE_*` variables in `.env.local`. The browser uses only the public anon key; service-role and Groq credentials are not needed for these workflows and must remain server-only. After applying the migration, restart the dev server so the SSR proxy can refresh auth cookies.

## Affordability calculations

Phase 4 stores money as integer Indian paise (`100 paise = ₹1`). User-entered amounts are estimates and are never presented as verified college fees.

- An expense starts in its configured plan year. In a later year `y`, its estimate is `round(amount × (10,000 + increase_bps)^(y − start_year) / 10,000^(y − start_year))`, rounded half-up to the nearest paise; it contributes zero before its start year.
- Monthly future contributions are annualized as `monthly × 12`; when both monthly and annual values are provided, they must agree exactly. Future contributions are distinct from confirmed funds available now.
- Total funding is `confirmed funds + confirmed scholarship aid + projected future contributions`; funding gap is `max(total cost − total funding, 0)`. Scholarship aid is included only for an application explicitly marked as confirmed, in `approved` or `received` status, with a positive amount, and whose linked record is not marked `unverified` or `missing`. A received amount replaces (rather than adds to) its awarded amount, and application IDs are counted once.
- Coverage is capped at 100%. Annual gaps consume confirmed funds from the earliest plan year first, then apply that year's future contribution.

The calculation functions are pure and live in `lib/affordability.ts`. The Phase 4 migration converts the existing numeric budget/expense amounts to paise and adds plan duration, contribution, plan-year, inflation, and uniqueness constraints.

The affordability planner reads scholarship applications through the authenticated Supabase client and therefore remains subject to the same family/student sharing RLS as the scholarship navigator. If that query is unavailable (for example, before the Phase 6 migration is applied), scholarship aid is excluded and the planner displays a warning rather than guessing. The current application schema has no academic-year field; confirmed aid is therefore treated as available to the plan as recorded, not allocated to a specific year. Add that field before relying on year-by-year aid scheduling.

## AP EAPCET college simulator (Phase 5)

The authenticated workspace includes a manual AP EAPCET comparison workflow. Students can save a rank, preferred branches, and college/branch options. Each option stores cutoff rank context (year, category and counselling round), source URL, last-verified date, provenance status, and annual tuition/hostel-living estimates. Values are not seeded by this repository: blank or missing values remain unavailable, and no admission probability or guarantee is calculated.

The simulator reuses the Phase 4 integer-paise affordability engine for four-year cost, confirmed funds, expected future contributions, funding gap and affordability status. `official_verified` records require a source URL, cutoff year, cutoff rank and verification date; `historical`, `estimate`, `unverified` and `missing` records are displayed with those limitations. Historical cutoffs are guidance only and do not guarantee admission.

Apply `supabase/migrations/20261017173000_college_affordability.sql` after the Phase 2 and Phase 4 migrations. The migration adds family/student-owned comparison tables and RLS policies. The pgTAP authorization fixture is `supabase/tests/college_affordability_rls.test.sql`; it requires the local Supabase stack and Docker as described above.

For imports, use one row per comparison option with these fields: `family_id`, `student_id`, `title`, `eapcet_rank`, `preferred_branches`, `college_name`, `branch_name`, `cutoff_rank`, `cutoff_year`, `cutoff_category`, `counselling_round`, `source_url`, `last_verified_at`, `data_status`, `annual_tuition_paise`, and `annual_hostel_living_paise`. Import only attributable records and preserve the source and verification metadata.

## Family sharing (Phase 7)

Students are the owners of their education-specific records. Parents/guardians are active `parent` family members; students are active `student` members. A student can independently share the education budget summary, college comparisons, scholarship/application progress, and the reserved professional-development category. Every switch defaults to private. The professional-development switch currently shares nothing because that module does not exist yet.

Sharing is enforced by PostgreSQL RLS through `family_sharing_preferences`; changing a client-supplied family ID or role cannot grant access. Parents see only categories whose switches are on. Detailed expenses, personal notes, documents and sensitive profile fields are not included in these sharing grants. Turning a switch off revokes future database reads; it cannot erase information a parent already viewed, downloaded or copied. Existing profile sharing (`student_profiles.is_shared_with_parents`) remains a separate profile-level control.

Apply `supabase/migrations/20261017183000_family_sharing_preferences.sql` after the Phase 6 migration. The authorization fixture is `supabase/tests/family_sharing_rls.test.sql`; run it only against a compatible local Supabase/PostgreSQL environment. No remote migration is applied by this repository.

## Deployment

Push this repository to GitHub, import it into Vercel, and configure the same environment variables in Vercel's project settings. Keep the service-role and Groq keys server-only; do not prefix them with `NEXT_PUBLIC_`.
