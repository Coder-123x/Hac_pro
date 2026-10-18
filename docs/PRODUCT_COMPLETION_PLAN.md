# Product Completion Plan

## Audit baseline (2026-10-18)

The repository is a Next.js 16 App Router application using React 19, TypeScript, Tailwind CSS, Supabase SSR/Auth/Postgres/RLS, and Vitest. The stack is appropriate for the product; no replacement or rewrite is planned.

### Verified working surface

- Routes currently present: `/`, `/signup`, and `/invite`.
- Authentication UI exists in `components/auth/auth-panel.tsx` and uses the browser Supabase client for sign-in/sign-up. `app/signup/page.tsx` reuses that component. SSR cookies are handled by `lib/supabase/server.ts` and `lib/supabase/proxy.ts` through root `proxy.ts`.
- Family workspace creation is a database RPC (`create_family_workspace`) called by `components/workspace/workspace.tsx`. Membership listing is filtered by the authenticated user and active membership.
- Parent invitations are created by the `create_family_invitation` RPC and accepted through `accept_family_invitation`. Invitation digests remain server-side; the one-time token is held in page memory and removed from the URL after load.
- Affordability calculations are pure integer-paise functions in `lib/affordability.ts`. The planner persists budgets and expenses through authenticated Supabase access and includes confirmed scholarship aid through the scholarship RLS path.
- AP EAPCET comparisons are manual/import-oriented in `components/colleges/simulator.tsx` and `lib/college-simulator.ts`. Cutoff and cost records carry provenance fields, but no catalog is seeded.
- Scholarship records and application tracking are manual/import-oriented in `components/scholarships/navigator.tsx` and `lib/scholarships.ts`. Confirmed funding rules distinguish approved/received aid, verification state, received-versus-awarded precedence, and duplicate application IDs.
- Consent switches and parent visibility are implemented by `components/sharing/family-sharing.tsx`, `lib/sharing.ts`, and `family_sharing_preferences` RLS policies. Sharing defaults to private and revocation blocks future reads.
- SQL migrations are ordered from family foundation through affordability, college, scholarships, sharing, and invitation-email hardening. Five pgTAP suites cover 58 assertions across the current RLS boundaries.

### Checks run for this audit

- `npm run test:unit` — passed: 5 files, 23 tests.
- `npm run typecheck` — passed.
- `npm run build` — passed; routes `/`, `/signup`, and `/invite` built successfully.
- `npx supabase db lint --local` — passed with no schema errors.
- All five local suites were executed successfully: affordability (9), college (8), family foundation (26), family sharing (8), and scholarship navigator (7), 58 total.

### Current working-tree caution

The audit preserved existing changes and did not edit them. `git status` currently reports modified `AGENTS.md`, `components/auth/auth-panel.tsx`, and `next-env.d.ts`, plus untracked `.DS_Store` and `app/signup/`. Review those items separately before committing. `.env.local` exists locally; its values were not read or printed.

## What is incomplete or disconnected

The following capabilities are not present in the source tree and must not be described as implemented:

- No student profile/onboarding UI exists for choosing the B.Tech-aspirant versus current-B.Tech journey, preferred language, entrance context, or education goals.
- No opportunity action-plan model or UI exists. Scholarships can be tracked by status, but there are no tasks, required documents, due-date reminders, evidence attachments, or next-best actions.
- No professional-development roadmap, milestones, projects, skills, internships, or preparation tracking exists.
- No recommendation engine connects goals, affordability, college comparisons, scholarship eligibility, and preparation actions into a personalized plan.
- No Groq route, server action, prompt layer, structured output validation, or explanation audit trail exists. `GROQ_API_KEY` is only documented as a placeholder.
- No English/Telugu translation catalog, language preference UI, locale routing, or Telugu content exists.
- No official college, cutoff, fee, or scholarship dataset is shipped. Existing records are manual/user-provided and may be unverified.
- No browser E2E test framework or CI workflow exists. Unit and pgTAP coverage does not prove real email confirmation, invitation navigation, consent UX, or production Auth behavior.
- No deployment configuration/verification is present beyond README guidance for Vercel and Supabase. A disposable hosted Supabase project and production redirect/cookie checks remain outstanding.
- Confirmed scholarship aid has no academic-plan-year field, so it is included in the overall plan but cannot yet be allocated year by year.

## Ordered implementation phases

### Phase 0 — Reproducible end-to-end foundation

**Goal:** make the existing journey testable and safe before adding breadth.

**Files/modules:**

- Add `e2e/` and a browser test tool only after choosing the smallest supported dependency.
- Add focused route/auth helpers around `app/page.tsx`, `app/signup/page.tsx`, `app/invite/page.tsx`, `components/auth/auth-panel.tsx`, and `components/invitations/invitation-acceptance.tsx`.
- Add CI workflow (for example `.github/workflows/ci.yml`) for unit, typecheck, build, migration lint, and disposable database tests.
- Keep SQL changes limited to test fixtures unless a reproduced security defect requires a migration.

**Dependencies:** stable local Supabase startup, isolated test accounts/mailbox, browser runner decision, and GitHub repository setup.

**Acceptance criteria:**

1. A test can register or sign in, create a family, invite a second account, accept with the intended email, and reach the workspace.
2. Wrong-email, expired, reused-token, unrelated-family, and revoked-sharing cases are exercised in a real browser/database environment.
3. CI runs all 23 unit tests, typecheck, build, lint, and all 58 pgTAP assertions without secrets in logs.

**Risks:** email confirmation settings, cookie domain/redirect differences, test data leakage, and rate limits. Use disposable accounts only.

**Commands:** `npm run test:unit`, `npm run typecheck`, `npm run build`, `npx supabase db lint --local`, `npx supabase test db --local <suite>`, and the selected browser test command.

### Phase 1 — Complete student journeys and opportunity action plans

**Goal:** turn the current workspace into two explicit journeys: aspiring B.Tech student and current B.Tech student.

**Files/modules:**

- Extend `student_profiles` with only the minimum journey fields (or add a versioned migration if the existing columns cannot represent them).
- Add `components/onboarding/` and typed validation in `lib/validation.ts`.
- Extend `components/workspace/workspace.tsx` with journey-aware navigation and empty states.
- Add an action-plan domain (`lib/action-plan.ts`, `components/action-plan/`) and migration tables for tasks, source/provenance, due dates, status, owner, and family/student scope.
- Connect scholarship and college records to suggested tasks without fabricating eligibility or deadlines.

**Dependencies:** Phase 0 E2E coverage, consent rules, verified source model, and a decision on document storage (avoid documents initially if not essential).

**Acceptance criteria:**

1. An aspiring student sees entrance, branch, affordability, scholarship, and application-preparation steps.
2. A current B.Tech student sees year/semester, skills, projects, internship, and placement-preparation steps.
3. Every task has an owner, status, optional due date, source/evidence context, and RLS boundary.
4. Parent visibility follows explicit sharing; private notes and documents remain private.

**Risks:** confusing guidance with guarantees, over-collecting sensitive data, and task duplication when a scholarship status changes.

### Phase 2 — Career-development roadmap

**Goal:** provide concrete, measurable career preparation without promising employment.

**Files/modules:**

- Add `career_roadmap` migration(s) for goals, milestones, skills, projects, evidence links, target dates, and completion status.
- Add `lib/career-roadmap.ts`, `components/career/roadmap.tsx`, and focused unit tests.
- Add a sharing category only if the module has a defined least-privilege summary; otherwise keep details student-private.

**Dependencies:** student journey profile and action-plan primitives from Phase 1.

**Acceptance criteria:**

1. Students can choose a broad goal, break it into milestones, and record evidence/progress.
2. Roadmap suggestions are clearly labeled guidance and do not claim jobs, salaries, eligibility, or placement.
3. Parents see only the explicitly shared summary, never private notes or documents.

**Risks:** advice becoming generic or misleading, sensitive portfolio links, and excessive scope across engineering branches.

### Phase 3 — Integrated recommendation layer

**Goal:** connect existing facts into explainable next actions.

**Files/modules:**

- Add pure recommendation rules in `lib/recommendations.ts` and tests first.
- Add a server-side recommendation route/action under `app/api/recommendations/` or a server action using the authenticated Supabase server client.
- Add a workspace recommendation panel in `components/recommendations/`.
- Reuse `lib/affordability.ts`, `lib/college-simulator.ts`, `lib/scholarships.ts`, action plans, and career roadmap data; do not duplicate money or eligibility formulas.

**Dependencies:** Phases 1–2, complete provenance fields, and explicit missing-data behavior.

**Acceptance criteria:**

1. Recommendations cite the exact user record/source and its academic year or last-verified date when applicable.
2. Missing or unverified data produces a “needs verification” action, not a fabricated conclusion.
3. A recommendation never bypasses RLS or exposes another family’s records.
4. Users can dismiss or mark a recommendation complete.

**Risks:** opaque scoring, stale data, false confidence, and leaking sensitive inputs into logs.

### Phase 4 — Groq explanations and guidance

**Goal:** add useful AI explanations without making Groq the source of truth.

**Files/modules:**

- Add a server-only Groq client and validated route/action under `app/api/ai/` or `app/actions/ai/`.
- Add schemas/prompts in `lib/ai/` with strict structured-output validation and redaction helpers.
- Add a small explanation UI in `components/ai/` that receives only the minimum authorized context.
- Add tests for authorization, validation failures, provider failures, prompt-size limits, and refusal/fallback behavior.

**Dependencies:** Phase 3 recommendation objects, `GROQ_API_KEY` in server-only deployment configuration, rate limiting, and an explicit privacy review.

**Acceptance criteria:**

1. No browser bundle, response payload, log, or error includes the Groq key.
2. AI output is labeled explanation/guidance, cites supplied verified sources, and cannot mutate financial or membership data.
3. Provider timeout/error returns a deterministic non-AI fallback.
4. Parent requests cannot include private student fields unless the sharing policy permits them.

**Risks:** hallucinated facts, prompt injection from user notes/source pages, cost/rate limits, and sensitive-data retention.

### Phase 5 — Bilingual, accessible product UX

**Goal:** support English and Telugu across the decision journey.

**Files/modules:**

- Add a typed translation catalog under `lib/i18n/` and locale-aware UI helpers.
- Extend `profiles.preferred_language` UI and server persistence.
- Update `app/layout.tsx`, navigation, forms, validation messages, empty/error states, and recommendation/action-plan labels.
- Add accessibility tests/checks for labels, focus order, keyboard use, contrast, and responsive layouts.

**Dependencies:** stable information architecture from Phases 1–4 and reviewed Telugu translations; do not machine-generate unreviewed financial/legal wording.

**Acceptance criteria:**

1. A user can switch English/Telugu and the preference persists per profile.
2. Critical warnings, source/provenance labels, money units, consent explanations, and errors are translated.
3. Screen-reader and keyboard flows remain usable at mobile widths.

**Risks:** translation drift, mixed-language content from AI, and ambiguous financial terminology.

### Phase 6 — Verified data operations and production deployment

**Goal:** make the product trustworthy and deployable without claiming an unverified catalog.

**Files/modules:**

- Add a server-only import/verification pipeline under `lib/data/` or a protected admin route, plus import-format documentation.
- Extend college/scholarship schemas only when provenance, academic year, effective dates, verification state, and source URLs require it.
- Add data freshness checks and UI filters for official, historical, estimate, unverified, and missing records.
- Add `vercel.json`/deployment configuration only if required, GitHub CI, environment validation, and a production runbook in `docs/`.
- Add the missing scholarship `academic_plan_year` (or equivalent) only after deciding how approved versus received aid is allocated and tested.

**Dependencies:** verified source agreements/processes, disposable hosted Supabase project, production Auth redirect URLs, RLS review, and CI from Phase 0.

**Acceptance criteria:**

1. Every surfaced fact has source, academic year/effective period, verification state, and last-checked date where applicable.
2. No invented college, fee, cutoff, scholarship, deadline, eligibility rule, or admission probability is shipped.
3. Production Supabase migrations, Auth redirects, cookies, RLS, and invite flows pass with separate accounts.
4. Deployment rollback, secret rotation, backups, monitoring, and incident contacts are documented.

**Risks:** source licensing/freshness, operational access, migration drift, and treating historical guidance as a guarantee.

## Product-wide definition of done

- Domain mutations are authenticated server-side or through RLS-protected Supabase access; no service-role shortcut is used in browser code.
- Every family/student record has explicit ownership and tests for unrelated-family isolation.
- Money remains integer paise with documented rounding; confirmed scholarship aid remains separate from savings and future contributions.
- Missing/uncertain data produces a clear limitation and next verification action.
- English/Telugu copy, accessibility, responsive layouts, loading/error/empty states, and consent language are reviewed.
- Unit, typecheck, production build, database lint, pgTAP, browser E2E, and dependency audit results are recorded with exact commands.
- A final manual runbook covers sign-up, confirmation, family creation, invitation acceptance/wrong-email rejection, sharing/revocation, affordability, college comparison, scholarship funding, action plans, AI explanations, and sign-out.

## Recommended immediate next action

Run Phase 0 against a disposable local/hosted Supabase setup with two real test accounts and a browser test runner. This is the highest-leverage blocker: it validates the current security-sensitive journey before adding action plans, career features, or AI. Do not seed production-like scholarship or college data until the provenance/import process in Phase 6 is agreed.
