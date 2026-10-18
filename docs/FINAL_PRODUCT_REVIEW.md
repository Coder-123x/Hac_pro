# Final product review

Review date: 2026-10-18

This review evaluates the working implementation against the product vision. Passing builds and authorization tests are not treated as proof of a complete user journey.

## Requirements coverage

| Product requirement | Status | Evidence and assessment |
| --- | --- | --- |
| Student registration, sign-in, sign-out and SSR session refresh | Partial | `/signup`, `AuthPanel`, Supabase SSR clients and `proxy.ts` exist. Two-account browser completion is not automated or verified. |
| Student education/career goal and aspirant/current-student journey | Partial | `DecisionDashboard` creates a `student_profiles` record and `CareerRoadmap` creates a journey. Profile editing and richer semester/skill inputs are limited. |
| Family workspace and parent/student invitations | Partial | Existing RPCs and invitation UI are implemented and covered by `family_foundation_rls.test.sql`; email delivery and browser acceptance are not verified here. |
| Family budget and exact affordability | Complete for calculation scope | `lib/affordability.ts` uses integer paise, inflation, annual gaps and confirmed/future funding separation. Unit and RLS tests pass. Academic-year scholarship allocation is still absent. |
| College and branch comparison | Partial | Manual AP EAPCET comparison, rank guidance and affordability reuse exist. No official college/cutoff/fee dataset is populated. Historical data is guidance only. |
| Trustworthy college and scholarship provenance | Partial | Schema fields and `lib/data-quality.ts` validate metadata. “Official verified” remains user-entered/self-attested; no external verification pipeline exists. |
| Scholarship discovery and confirmed aid | Partial | Manual records, statuses and confirmed-funding rules exist. No verified scheme dataset, source refresh process or academic-year aid allocation exists. |
| Opportunity action plans | Partial | Criteria, tasks, lifecycle and RLS exist. The UI does not yet manage/display `opportunity_alternatives`, and required-document/application-step editing is incomplete. |
| Career roadmap | Partial | Deterministic aspirant/current-student templates, milestones, tasks and RLS exist. Resource curation, evidence editing and deeper semester/skill planning are limited. |
| Primary and lower-cost alternative routes | Partial | The unified dashboard can show primary/alternative college signals when rank, preference, cutoff and cost data exist. It does not produce alternatives for scholarships, career routes or rejected funding. |
| Student-controlled family sharing | Complete for tested policy boundaries | Sharing switches and RLS policies exist; all local sharing pgTAP tests pass. Parent UX is ambiguous when multiple students belong to one family. |
| English/Telugu support | Partial | Persisted language switcher and major shell/dashboard labels exist. Detailed affordability, college, scholarship, opportunity and roadmap copy remains predominantly English. |
| Groq guidance | Partial | Authenticated server route, bounded inputs, timeout/rate limit, configurable model and fallback exist. The current panel sends generic summaries rather than full contextual option/opportunity/roadmap evidence. Live Groq behavior is not verified. |
| Responsive/accessibility behavior | Partial | Semantic labels, focus styles and reduced-motion support exist. No systematic mobile viewport or screen-reader regression suite exists. |
| Production deployment | Missing/unverified | No Git remote or Cloud project is configured. No preview, Supabase Cloud migration or two-account production smoke test has run. |

## Verified automated evidence

- `npm run test:unit`: 48 tests passed across 12 files.
- `npm run typecheck`: passed.
- `npm run build`: passed; routes include `/`, `/signup`, `/invite` and `/api/ai/guidance`.
- `npx supabase db lint --local`: passed with no schema errors.
- All eight local pgTAP suites passed: 123 assertions covering family foundation/invitations, affordability, college, scholarships, sharing, opportunities, roadmaps and catalogue authorization.
- Browser accessibility inspection confirmed the signup form exposes a language selector, labeled email/password fields, account action and sign-in link.

These results verify code paths and local database policy fixtures. They do not verify a complete browser journey with two real disposable accounts.

## Actual user journey trace

1. An unauthenticated visitor reaches `/` or `/signup` and can submit Supabase Auth credentials.
2. After authentication, `app/page.tsx` reads active memberships using the server Supabase client and renders one workspace card per family.
3. A student can create a profile from the unified dashboard, but a parent-created family still needs an invitation before the student can do so.
4. Parents create invitation tokens through the protected RPC; the token is held in component memory and the acceptance RPC enforces email, expiry, authority and single-use checks.
5. The workspace renders budget, college, scholarship, opportunity, sharing and roadmap modules. Each module independently loads through the browser Supabase client and RLS.
6. The dashboard summarizes counts and affordability using the existing pure calculation functions. It does not persist a single selected “pathway” object tying all modules together.
7. Groq guidance is optional and falls back when credentials or provider responses are unavailable.

## Important usability gaps

- The workspace is a long vertical stack; the student’s next action is easy to lose among all modules.
- Empty state copy says what is missing but does not consistently offer an anchor or action to fix it.
- Parents see a family-wide summary without an explicit student selector. Multiple-student families can be confusing even when RLS filters rows correctly.
- Opportunity alternatives are stored in the database but are not surfaced as a complete user workflow.
- The dashboard’s primary/alternative college signal is a guidance label, not a saved decision or route plan.
- Detailed Telugu translation is incomplete, so switching language still leaves mixed-language forms and error messages.
- No unified deadline view combines scholarship deadlines, opportunity tasks and roadmap milestones.
- The invitation URL is displayed for copying but there is no integrated email delivery or resend management.

## Security and privacy review

Strengths:

- Server Supabase client uses cookie-based SSR sessions; browser code receives only the public Supabase URL/anon key.
- Groq and service-role environment variables are not in client components or static build output.
- Local pgTAP tests cover unrelated-family reads/writes, role boundaries, sharing defaults and revocation.
- Invitation tokens are hashed in the database and acceptance is locked, recipient-bound, expiring and single-use.

Risks or unverified areas:

- No two-account browser test has verified that UI behavior matches the RLS fixtures in a deployed environment.
- User-entered records can be marked `official_verified`; the system validates required metadata but does not independently verify the source or issuer.
- The dashboard issues several family-scoped queries. RLS is the boundary, but multiple-student family presentation needs explicit product scoping.
- No current application code requires a Supabase service-role key; do not configure one for this MVP.
- No production rate-limit store exists for Groq; the current limit is process-local and resets when a server instance restarts.

## Financial and data-provenance risks

- Confirmed scholarship aid is correctly restricted by status, explicit confirmation, positive amount and verification status, with received amount taking precedence.
- Aid is not allocated to academic years, so year-by-year affordability can overstate timing.
- No official college, cutoff, fee or scholarship records are present. A demonstration using invented records would violate the product’s trust requirements.
- Historical cutoffs and estimates are labeled in the schema/UI, but the product still relies on students entering those labels correctly.
- Import validation and documentation exist, but there is no reviewed batch-import UI, duplicate resolution workflow or source refresh job.
- Resource records have provenance fields but no user-facing resource curation workflow.

## Claims that exceed available evidence

The following must remain explicitly qualified in demonstrations:

- A rank meeting a historical cutoff is not an admission prediction or guarantee.
- A scholarship listing is not proof of eligibility, application, approval or receipt.
- “Primary candidate” and “alternative candidate” are recorded-data signals, not recommendations with institutional authority.
- A completed roadmap task is not proof of skill mastery, employment readiness or admission.
- A Groq explanation is not a verified financial, eligibility or career decision.
- A verified status currently means metadata and user/source assertions satisfy validation; it is not independent government or institution verification.

## Prioritized demonstration blockers

1. **P0 — Run the two-account browser journey**: signup/confirmation, family creation, invitation acceptance, wrong-email rejection, sharing/revocation and unrelated-family isolation.
2. **P0 — Use only attributable demo records**: either connect a reviewed official import or demonstrate empty/manual-entry states. Do not seed realistic-looking schemes.
3. **P1 — Fix alternative opportunity presentation**: display and manage `opportunity_alternatives` or disclose that only college alternatives are currently supported.
4. **P1 — Add explicit student scoping for parent views**: avoid family-wide ambiguity when more than one student is linked.
5. **P1 — Complete Telugu coverage for core forms and errors**.
6. **P1 — Add a unified deadline/action view** across opportunities and roadmaps.
7. **P2 — Add a durable Groq rate-limit mechanism and live provider test in a controlled preview environment**.
8. **P2 — Add reviewed import execution and duplicate-resolution tooling.**

## Known limitations to disclose to users

- This release contains no official Andhra Pradesh college or scholarship dataset.
- Users must enter or import source-backed records; unknown values stay unknown.
- Historical data is guidance only and does not guarantee admission or funding.
- Scholarship aid affects affordability only after explicit user confirmation under the approved/received rules.
- Confirmed aid is not scheduled by academic year.
- Roadmaps are planning aids, not proof of skill, eligibility, admission or employment.
- Parent access depends on student sharing choices and cannot erase information already viewed or copied.
- AI guidance is optional, may be unavailable, and must not replace source verification or deterministic calculations.
- Production deployment, Supabase Cloud migration and two-account browser testing are not yet verified.
