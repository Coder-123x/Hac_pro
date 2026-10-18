# Final MVP gap audit

Audit date: 2026-10-18
Scope: current working tree only. This is an evidence-based release audit, not a feature-completion claim.

## Verification commands

| Command | Result |
| --- | --- |
| `npm run test:unit` | PASS — 12 files, 48 tests |
| `npm run typecheck` | PASS |
| `npm run build` | PASS — Next.js 16.4.2; `/`, `/signup`, `/invite`, `/api/ai/guidance`, catalogue API routes compiled |
| `npx supabase db lint --local` | PASS — no schema errors |
| `for test in supabase/tests/*.sql; do npx supabase test db --local "$test"; done` | PASS — 8 suites, 123 pgTAP assertions |
| `git diff --check` | PASS |

The database checks ran against the existing local Supabase instance only. No reset, remote migration, deployment, browser E2E run, or staged-data import was performed during this audit.

## Requirements coverage matrix

| Capability | Status | Evidence and limitation |
| --- | --- | --- |
| Sign-up/sign-in/sign-out/session refresh | Partial | `app/signup/page.tsx`, `components/auth/auth-panel.tsx`, SSR clients and `proxy.ts` exist and build. No current automated two-account browser test or production Auth configuration evidence. |
| Student/parent family workspace | Partial | `create_family_workspace`, membership queries and invitation RPCs are wired in `app/page.tsx` and `components/workspace/workspace.tsx`. Local RLS tests pass; email delivery and deployed acceptance are unverified. |
| Student onboarding and goal | Partial | `ProfileSetup` persists `student_profiles`; aspirant/current selection and richer skill/timeline inputs are limited. No single persisted plan object joins goal, selected college, funding and roadmap. |
| Budget and four-year affordability | Complete for current calculation scope | `lib/affordability.ts` uses integer paise, inflation, annual gaps and separate confirmed/future funding. Academic-year aid allocation is absent. |
| College/branch comparison | Partial | Manual comparison and deterministic rank/cost calculations are usable. The shared catalogue is not connected to the simulator; no current official AP dataset is published. Pathway signals are not saved decisions and do not choose on affordability alone. |
| Scholarships and confirmed aid | Partial | Manual records, statuses, explicit confirmation and received-over-awarded precedence are implemented. No verified live scheme dataset, refresh workflow or academic-year allocation. |
| Opportunity action plans | Partial | Criteria/tasks/lifecycle and RLS exist in `components/opportunities/plan.tsx`. It is nested inside tracked scholarship cards, has no direct opportunity entry on the dashboard, and does not surface/manage stored alternatives as a complete workflow. |
| Career roadmap | Partial | `components/roadmap/roadmap.tsx` and roadmap migrations provide templates, milestones, tasks and evidence fields. Deeper semester/skill/resource curation and unified deadline view remain limited. |
| Primary and alternative pathways | Partial | `recommendCollegePathways` can show rank/preference-based primary and alternative signals. It does not persist a route, cover scholarship/career alternatives, or prove affordability; missing values produce no recommendation. |
| Consent-based sharing | Complete for tested policy boundaries | Student switches and RLS policies exist; local family-sharing and roadmap pgTAP suites pass. Parent presentation is family-wide and ambiguous with multiple students; browser revocation/isolation is not currently automated. |
| English/Telugu | Partial | `LanguageProvider` persists a local preference and translates shell/dashboard labels. Most forms, validation messages, affordability, opportunity and roadmap copy are hardcoded English. |
| Groq guidance | Partial | `/api/ai/guidance` authenticates, bounds input, times out, uses a configurable model and falls back safely. The rate limit is process-local, live provider behavior is unverified, and the panel sends generic facts rather than full verified context. |
| Catalogue import/review | Partial | Migrations through `20261018120300` implement reviewer-gated preview, quarantine, idempotency, approve/publish/retire and append-only audit events. API routes exist but no reviewer management/import UI exists; reviewer provisioning is out-of-band and the 25,505-row CSV remains staging-only. |
| Trustworthy education data | Missing for live recommendations | Staged AP EAPCET 2024 data is historical and awaiting review; APHERMC staging is limited. No published current official college, cutoff, fee or scholarship catalogue exists. |
| Mobile/accessibility | Partial/unverified | Semantic labels, focus styles and reduced-motion CSS are present. No viewport, screen-reader or automated accessibility regression suite exists. |
| Deployment | Missing/unverified | No Git remote is configured, no Vercel CLI/config evidence exists, and no Supabase Cloud project/migration/smoke test is verified. |

## Actual journey trace

1. **Entry and authentication:** `/` server-renders `AuthPanel` for unauthenticated users. Authenticated users are resolved through cookie-backed Supabase SSR and active `family_members` rows. `/signup` is a real route. This is code/build evidence, not a current end-to-end account proof.
2. **Family and invitation:** `WorkspaceCreationForm` calls the existing family RPC; `InvitationForm` calls the protected invitation RPC and keeps the returned token in component memory. `/invite` calls the acceptance flow. Database tests cover recipient, expiry, reuse and family isolation; email delivery and simultaneous sessions are not verified.
3. **Onboarding:** `DecisionDashboard` loads profile/budget/comparison/scholarship/roadmap data and `ProfileSetup` writes the student profile. It does not collect every product goal input or persist a selected pathway tying later modules together.
4. **Affordability:** `AffordabilityPlanner` loads and persists family budget/expenses through the browser client under RLS. `calculateDecisionAffordability` combines exact-money budget values and explicitly confirmed scholarship aid. The result is presented in the dashboard, but aid is not assigned to academic years.
5. **College:** `CollegeSimulator` accepts user-entered options and displays provenance/status, rank guidance and four-year affordability. It does not query the published shared catalogue, and the staged historical file is not live data.
6. **Funding/opportunity:** `ScholarshipNavigator` is manual-entry/search/filter state plus application tracking. `OpportunityPlan` appears only after a scholarship is tracked; tasks and criteria persist directly under RLS. Stored alternatives and a cross-module deadline queue are not surfaced.
7. **Roadmap:** `CareerRoadmap` creates a deterministic aspirant/current template and persists milestones/tasks. Status persistence is covered by local pgTAP and prior browser evidence, but no current browser run was performed here.
8. **Sharing:** `FamilySharing` gives the student consent switches. Parent queries rely on RLS and sharing helpers. Policies pass local tests, but the parent UI lacks explicit per-student selection and no current two-account browser run proves revocation behavior.
9. **AI:** `GuidancePanel` calls the authenticated server route. Missing credentials and malformed responses have unit-tested rule-based fallback; live Groq and production rate limiting remain unverified.

## Security, privacy and integrity findings

**Strengths verified by source review and local tests**

- Browser code uses only public Supabase URL/anon-key configuration. `GROQ_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are not referenced by client components.
- Catalogue functions use `security definer`, fixed `search_path`, reviewer helper checks, advisory locks and append-only audit events. Direct authenticated DML is revoked; ordinary catalogue reads are limited to published rows by RLS.
- Family, scholarship, roadmap and sharing suites cover unrelated-family access and role boundaries. All 123 local assertions pass.
- Invitation secrets are hashed and acceptance is recipient-bound, expiring and single-use in the tested database path.

**Risks or unverified assumptions**

- The repository has no configured GitHub remote and all feature work is uncommitted. Production deployment and rollback have not been exercised.
- Reviewer allowlist provisioning is intentionally out-of-band. There is no operational UI or documented production operator runbook in the app.
- User-entered records may claim `official_verified`; validation checks metadata but does not independently verify an issuer or source.
- The Groq rate limiter is in process memory and is not a durable, multi-instance production control.
- Direct browser mutations are safe only insofar as the deployed schema matches the tested migrations; no Supabase Cloud migration run is evidenced.
- No browser test currently proves wrong-email invitation rejection, revoked sharing, concurrent account cookie isolation or parent visibility in a deployed environment.

## Data and product claims that must stay qualified

- A historical cutoff is guidance, not an admission threshold or guarantee.
- A scholarship listing is not proof of eligibility, application, approval or receipt.
- “Primary” and “alternative” college labels are recorded-data signals, not institutional recommendations.
- A completed roadmap task is not proof of skill mastery, admission or employment.
- Confirmed funding is not academic-year scheduled funding.
- Groq output is explanatory text, not a verified financial or eligibility decision.
- The staged AP EAPCET file and APHERMC record are not live published catalogue data.

## Prioritized implementation plan

### P0 — release/security blockers

1. **Establish a controlled deployment path.** Configure a GitHub remote, Vercel project and Supabase Cloud project; apply and verify migrations on a disposable cloud project before production. Relevant files: `.env.example`, `README.md`, `docs/DEPLOYMENT_CHECKLIST.md`, `supabase/migrations/*`.
2. **Run two-account browser smoke tests.** Verify signup/session, family creation, correct/wrong-email invitation, expiry/reuse, sharing/revocation and unrelated-family isolation using disposable accounts. Add a small Playwright or equivalent harness only after choosing a supported CI/browser environment.
3. **Keep live catalogue empty until review.** Create an operator-only reviewer provisioning/runbook and review/import preview evidence before publishing any staged rows. Do not use the 25,505-row CSV as live recommendations.

### P1 — coherent user journey/data correctness

4. Connect published catalogue records to `components/colleges/simulator.tsx` without joining unreviewed institution identities; keep historical status visible.
5. Make opportunity plans first-class in the dashboard, expose alternatives, and combine opportunity/roadmap deadlines into a next-action view (`components/opportunities/plan.tsx`, `components/dashboard/decision-dashboard.tsx`, related schema).
6. Add academic-year allocation to confirmed scholarship aid before presenting year-by-year funding decisions (`lib/scholarships.ts`, `lib/affordability.ts`, migration only after design review).
7. Add explicit student scoping to parent views and finish Telugu coverage for all core forms/errors (`components/workspace`, `components/i18n`, domain components).

### P2 — polish and operations

8. Add durable distributed AI rate limiting/observability and a controlled live Groq test.
9. Add mobile viewport/accessibility regression tests, loading skeletons and clearer action anchors.
10. Add reviewed catalogue import UI with conflict/quarantine resolution and audit export.

## Top five blockers for a reliable demonstration

1. No verified GitHub, Vercel or Supabase Cloud deployment path.
2. No current official AP college/scholarship data is published; a realistic-looking demo dataset would be unsafe.
3. Complete two-account browser journey and deployed RLS behavior are not currently verified.
4. Opportunity plans, alternatives and deadlines are not integrated into one actionable dashboard flow.
5. Telugu coverage and mobile/browser accessibility evidence are incomplete.

## Disclosure checklist

Disclose that this MVP is a planning aid; historical/estimated/unverified records are not guarantees; scholarship funding counts only after explicit confirmation; aid is not year-allocated; AI may be unavailable and cannot replace source verification; parents see only consented data but revocation cannot erase information already viewed/copied; production deployment and cloud migration remain unverified; and no live official AP catalogue is currently available.

## Audit conclusion

The current tree is buildable and has strong local deterministic/RLS coverage, but it is not deployment-ready or a complete product journey. The smallest safe sequence is: establish disposable cloud deployment and two-account smoke tests, keep the catalogue unpublished while provisioning/review is documented, then connect reviewed catalogue data and integrate opportunity/deadline/academic-year funding flows before visual polish.
