# Local end-to-end verification report

Date: 2026-10-18

This report records a focused local verification run against the existing Next.js app and local Supabase services. No database reset, remote change, deployment or source-data deletion was performed. The browser run used synthetic disposable accounts only; their local test records were left in place.

## Test setup

- Next.js development server: `npm run dev` already running on `http://localhost:3000`.
- Local Supabase: Docker services running and the local REST/Auth/database endpoints responding. `npx supabase status` showed the core stack; no reset was run.
- Browser tooling: no Playwright/Cypress dependency or repository E2E suite exists. The available in-app browser automation was used for the interactive checks.
- Synthetic accounts: separate disposable student, invited student, wrong-email, intended-email and unrelated-family accounts. Credentials and invitation tokens are intentionally omitted.

## Browser results

### PASS

| Workflow | Evidence |
| --- | --- |
| Registration and session entry | Created disposable accounts through `/signup`; each reached the authenticated workspace. |
| Family workspace creation | Owner created `E2E Synthetic Family`; the workspace rendered with the owner as parent. |
| Correct-email invitation acceptance | Invitation issued to the intended disposable student account was accepted and the account rendered `Your role: student`. |
| Wrong-email rejection | A signed-in account with a different email received the visible error “This invitation was issued to a different email address.” |
| Student onboarding | Student saved aspirant direction, AP EAPCET exam/rank, preferred branches and career goal; the setup form disappeared after reload. |
| Budget persistence and affordability | Parent saved consistent monthly/annual contributions and confirmed funds. The workspace displayed the four-year plan, future contributions, confirmed funds, coverage and funding gap. Contradictory contribution inputs were rejected before save. |
| Roadmap creation | Student roadmap creation initially exposed a client/database column mismatch; after the minimal fix below, the roadmap and generated milestones persisted and rendered. |
| Roadmap milestone/task progress | After the trigger fix, the student changed a milestone and a task to completed; both values remained completed after page reload. |
| Opportunity persistence | Student created an unverified synthetic opportunity, tracked its application status, added an eligibility criterion and added a preparation task. All were visible after reload. |
| Sharing defaults and consent | Student sharing switches were initially unchecked. Budget, college and scholarship sharing were then explicitly enabled; the parent saw the shared scholarship record. |
| Sharing revocation | Scholarship sharing was switched off by the student; the parent no longer saw the scholarship record and saw “Scholarship and application progress: Not shared.” |
| Unrelated-family isolation | A separate disposable account created `Unrelated Synthetic Family` and did not see the original family or its records. |
| Telugu switch | The language selector changed the document language to `te` and translated major shell/authenticated headings. |

### FAIL / DEFECTS FIXED

1. **Roadmap creation failed** because `components/roadmap/roadmap.tsx` spread a `sortOrder` property into a database insert, while the migration column is `sort_order`. Fixed by explicitly mapping the template fields to the SQL column name.

2. **Scholarship records crashed the workspace** after a record existed. `components/scholarships/navigator.tsx` cast snake_case Supabase rows directly to camelCase UI rows and called `BigInt(undefined)`. Fixed by normalizing the fetched scholarship fields and treating undefined nullable amounts as null.

Both fixes were reloaded and re-exercised in the browser. The roadmap trigger correction was applied only through the new follow-up migrations documented below; existing RLS policies, grants and constraints were preserved.

### NOT VERIFIED

- Mobile viewport behavior was not verified because the available in-app browser did not expose a viewport override capability. Responsive CSS remains covered only by code inspection/build.
- Live Groq behavior was not tested. `.env.local` contains configured values, so no credential-less browser process was started. Existing unit tests verify the rule-based fallback, malformed response handling and validation; the live route with missing credentials remains unverified.
- Email-confirmation behavior, invitation email delivery, token expiry and reused-token rejection were not exercised in this browser run. Local Auth is configured with confirmations disabled; pgTAP covers database invitation boundaries.
- A simultaneous two-browser session was not available. Accounts were switched sequentially in the same browser profile, so cookie isolation between concurrently open sessions remains unverified.

## Automated checks

Executed after the fixes:

- `npm run test:unit` — **PASS**, 11 files / 39 tests.
- `npm run typecheck` — **PASS**.
- `npm run build` — **PASS**; routes `/`, `/signup`, `/invite` and `/api/ai/guidance` compiled.
- `npx supabase db lint --local` — **PASS**, no schema errors.
- `npx supabase test db --local supabase/tests/affordability_rls.test.sql` — **PASS**, 9 assertions.
- `npx supabase test db --local supabase/tests/college_affordability_rls.test.sql` — **PASS**, 8 assertions.
- `npx supabase test db --local supabase/tests/education_career_roadmap_rls.test.sql` — **PASS**, 15 assertions, including authorized milestone/task status persistence and an unrelated-family update denial.
- `npx supabase test db --local supabase/tests/family_foundation_rls.test.sql` — **PASS**, 26 assertions.
- `npx supabase test db --local supabase/tests/family_sharing_rls.test.sql` — **PASS**, 8 assertions.
- `npx supabase test db --local supabase/tests/opportunity_action_plan_rls.test.sql` — **PASS**, 10 assertions.
- `npx supabase test db --local supabase/tests/scholarship_navigator_rls.test.sql` — **PASS**, 7 assertions.
- Combined pgTAP total: **83 assertions passed**.
- `git diff --check` — **PASS**.

## Focused follow-up evidence

- Roadmap milestone status: **PASS**. The student selected `completed`, the UI reflected the change, and the value remained `completed` after reload.
- Roadmap task status: **PASS**. The student selected `completed`, and the task remained `completed` after reload.
- Cross-family roadmap update: **PASS** in pgTAP; the unrelated family received no update rows.
- Mobile widths: **NOT VERIFIED**; no viewport control is exposed by the available browser backend.
- Groq with no key: **NOT VERIFIED at HTTP level**. Rule-based fallback behavior remains covered by the passing `tests/ai-guidance.test.ts` cases.
- Invitation expiry/reuse: **PASS at database-policy level** through `family_foundation_rls.test.sql` (26 assertions); **NOT VERIFIED in browser**.
- Email confirmation/delivery: **NOT VERIFIED / not applicable locally** because `supabase/config.toml` disables confirmation requirements. No confirmation email was expected from the local setup.

The complete command rerun after this pass was:

```text
npm run test:unit                         PASS (39 tests)
npm run typecheck                         PASS
npm run build                             PASS
npx supabase db lint --local              PASS
npx supabase test db --local <all 7 SQL>  PASS (83 assertions)
git diff --check                          PASS
```

## Remaining blockers

1. **Mobile responsiveness: NOT VERIFIED.** The available browser backend has no viewport override capability, so no narrow-width browser evidence was obtained. No layout defect was fixed based on guesswork.
2. **Groq HTTP fallback: NOT VERIFIED.** `.env.local` remains unchanged and was not printed. Existing unit tests pass for the bilingual rule-based fallback, malformed model responses and validation, but a credential-less running Next.js process was not started.
3. **Invitation token edge cases:** local pgTAP family-foundation tests pass 26 assertions, including invitation authorization/expiry/reuse boundaries. Browser expiry/reuse was not exercised. Local Auth has `enable_confirmations = false`, so email confirmation is not supported by this local configuration; email delivery is therefore NOT VERIFIED separately (Inbucket is running, but no confirmation email is generated when confirmations are disabled).
4. Add a supported mobile-browser test path and a separate-browser or Playwright E2E harness for concurrent account isolation.
5. Keep the existing product limitations: no independently verified AP college/scholarship dataset, incomplete Telugu coverage, no academic-year scholarship allocation, and no production Supabase/Vercel smoke test.

## Roadmap migration remediation

- Root cause: `roadmap_milestones` has `plan_id` and no `milestone_id`; only `roadmap_tasks` has `milestone_id`. The original trigger accessed `new.milestone_id` while updating every roadmap table.
- New local migrations: `20261018112000_roadmap_identity_trigger_fix.sql` and `20261018112100_roadmap_identity_trigger_field_guard.sql`. The second migration makes field access table-specific and preserves immutable student/plan/milestone identity checks.
- Applied locally with `npx supabase db push --local`; no reset or remote operation was used.

The local release is improved but is not fully end-to-end verified or production-ready.
