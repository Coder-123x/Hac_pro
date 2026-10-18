# Engineering Education Planner

Decision-support platform for families planning engineering education, initially for Andhra Pradesh. The current app includes authenticated family workspaces, affordability, manual AP EAPCET comparisons, provenance-aware scholarships, opportunity action plans and a private-by-default education-to-career roadmap.

## Stack

- Next.js, React, TypeScript, and Tailwind CSS
- Supabase PostgreSQL and Authentication
- Groq API for optional server-side AI guidance with a rule-based fallback
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
| `GROQ_API_KEY` | Server-only Groq API key. |
| `GROQ_MODEL` | Server-only Groq model identifier selected from the currently supported Groq models. |

The current application does not use a Supabase service-role key. Never commit `.env.local` or real credentials.

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
7. `20261018090000_opportunity_action_plan.sql`
8. `20261018100000_education_career_roadmap.sql`
9. `20261018101000_roadmap_identity_hardening.sql`
10. `20261018112000_roadmap_identity_trigger_fix.sql`
11. `20261018112100_roadmap_identity_trigger_field_guard.sql`
12. `20261018120000_education_catalogue_foundation.sql`
13. `20261018120100_education_catalogue_reviewer_lockdown.sql`
14. `20261018120200_education_catalogue_reviewer_access.sql`
15. `20261018120300_education_catalogue_import_workflow.sql`

These migrations have not been applied to a remote Supabase project by this repository. Review them in timestamp order and apply them to a new or approved Supabase Cloud project only with `npx supabase db push`; never use `db reset` against Cloud.

After installing and authenticating the Supabase CLI, either start a local Supabase stack and run `supabase migration up`, or link the intended project and run `supabase db push`. Review the migration before applying it: it creates RLS policies and authenticated RPCs for creating family workspaces and issuing or accepting invitations.

### Database authorization tests

The pgTAP suites in `supabase/tests/` exercise family/invitation, affordability, college, scholarship and sharing RLS boundaries. They require Docker (or a compatible container runtime) and the Supabase CLI; they do not require remote credentials.

```bash
npx supabase start
# db reset is only for a disposable local database whose data can be discarded.
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

## Education-to-career roadmap (Phase 9)

Students can create either a B.Tech aspirant journey or a current B.Tech journey with a career goal, optional branch/year, skill level and weekly study-time constraint. The app generates a small set of deterministic planning milestones for entrance/application, selection, first-year readiness, semester skills, portfolio and experience preparation. Students explicitly update milestone status and may later attach evidence links; completion is never inferred from watching a resource or from model output. No course, internship or college catalog is seeded by this migration.

Roadmaps, milestones, tasks and curated resources are private to the student by default. A student may enable the existing `professional_development` sharing switch for parent read access; parents cannot create or mutate roadmap records. Resource records require an HTTPS source URL and retain pricing and verification metadata, with unknown pricing allowed. The roadmap does not make eligibility, employment or admissions claims and does not call Groq.

Apply the roadmap migrations in timestamp order. The focused authorization suite is `supabase/tests/education_career_roadmap_rls.test.sql`; run all suites with the loop above. The roadmap is a planning foundation: task-level evidence, resource curation and optional AI explanations remain future work.

## Unified decision workflow

Each linked family workspace now starts with a student direction profile (aspirant or current B.Tech student), then shows a unified summary of budget status, saved college comparisons, tracked opportunities, roadmap progress and next actions. The dashboard reuses the deterministic affordability engine and confirmed-scholarship rules; it never turns projected contributions, unverified aid or missing college data into confirmed recommendations. Parents see only data already permitted by the existing family sharing switches. A primary or alternative pathway is not auto-selected when preference, academic or source data is incomplete; the dashboard instead identifies the missing planning step.

## Server-side Groq guidance

The workspace includes an optional guidance panel for affordability, college options, opportunity checklists and career-roadmap explanations. It calls Groq’s official OpenAI-compatible chat-completions endpoint from `app/api/ai/guidance/route.ts`; the browser never receives `GROQ_API_KEY`. Set both `GROQ_API_KEY` and a currently supported `GROQ_MODEL` in the server environment. If either is absent, the request times out, or Groq returns an invalid/error response, the UI uses a bilingual rule-based explanation. Inputs are bounded and reduced to non-sensitive planning facts; deterministic calculations and eligibility decisions remain outside the model.

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

See [`docs/DEPLOYMENT_CHECKLIST.md`](docs/DEPLOYMENT_CHECKLIST.md) for the release gate, Supabase Auth URL configuration, Cloud migration review, GitHub/Vercel preview workflow and smoke test checklist. The current checkout is not deployed: it has uncommitted changes and no configured Git remote.

## Data provenance and refresh

This repository does not seed Andhra Pradesh colleges, branches, cutoffs, fees, scholarships or schemes. The SQL fixtures contain synthetic records only for authorization tests. Production records are manually entered or imported by an authenticated student and retain source URL, source type, verification status, academic year and last-checked date. Missing tuition, living costs, cutoffs, deadlines and award amounts remain unknown rather than becoming zero.

Use [`docs/DATA_IMPORT_FORMAT.md`](docs/DATA_IMPORT_FORMAT.md) for reviewed CSV imports. `lib/data-quality.ts` validates official/historical provenance, HTTPS/HTTP source URLs, academic years, dates, award ranges and non-negative integer-paise amounts, and detects normalized duplicate keys. Records older than the freshness window should be re-checked and marked stale before being presented as current. No official Andhra Pradesh record has been verified or imported by this repository as of the current release.
