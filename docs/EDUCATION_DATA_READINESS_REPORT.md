# Education data readiness report

Audit date: 2026-10-18
Scope: repository contents only. No data was downloaded, imported, changed, or verified against an external provider.

## Executive finding

The application has a useful provenance-aware storage and validation foundation, but it does not currently ship an Andhra Pradesh education or financial-aid dataset. There are no production college, branch, AP EAPCET cutoff, tuition, hostel, scholarship, or government-aid records in the repository. The only populated rows are synthetic fixtures used by pgTAP authorization tests and locally created user/demo records. A reliable AP affordability recommendation therefore cannot be demonstrated from preloaded data; the safe product state is manual entry or an explicit unavailable-data state.

## Evidence reviewed

- `docs/DATA_IMPORT_FORMAT.md`: explicitly says no seeded college, cutoff, fee or scholarship dataset exists and identifies pgTAP fixtures as synthetic.
- `README.md`: states that no AP record has been verified or imported and that missing values remain unknown.
- `supabase/seed.sql`: absent; `supabase/config.toml` points to it but no seed file is present.
- `lib/data-quality.ts`: provenance, amount, date, year, freshness and normalized-duplicate validators.
- `lib/college-simulator.ts`, `components/colleges/simulator.tsx`: manual comparison and deterministic affordability integration.
- `lib/scholarships.ts`, `components/scholarships/navigator.tsx`: manual scholarship/application tracking and confirmed-aid rules.
- Migrations `20261017173000_college_affordability.sql`, `20261017180000_scholarship_navigator.sql` and `20261018090000_opportunity_action_plan.sql`: schema, constraints and RLS; comments explicitly say records are manual/imported and no schemes are seeded.
- `tests/data-quality.test.ts`, `tests/college-simulator.test.ts`, `tests/scholarships.test.ts` and pgTAP fixtures: validation/calculation/security evidence, not external data verification.

## Dataset inventory and classification

“Verified official” below means independently attributable evidence in this repository. No dataset meets that standard.

| Dataset | Classification | Source URL in repository | Academic year / validity | Last checked | Eligibility coverage | Evidence and missing fields |
| --- | --- | --- | --- | --- | --- | --- |
| AP college catalogue and branches | **Missing** | None | None | None | None | `college_comparison_options` stores names supplied by a student/import, but there is no catalogue, institution identifier, affiliation or source record. |
| AP EAPCET entrance cutoffs | **Missing production data; synthetic test data only** | None in records | Schema supports `cutoff_year`; no production value | None | Category and counselling round are optional fields; no verified category/round coverage | The migration stores `cutoff_rank`, year, category and round and labels historical values as guidance. Test rows are authorization fixtures, not AP evidence. |
| Tuition and mandatory college fees | **Missing verified data; user estimates supported** | None in records | No production year | None | No fee-component coverage beyond annual tuition | Schema has nullable `annual_tuition_paise`; unknown remains null. It does not capture institution fee schedule, mandatory charges, reimbursement rules or effective dates. |
| Hostel/living costs | **Missing verified data; user estimates supported** | None in records | No production year | None | No location, hostel type or living-cost coverage | Schema has nullable `annual_hostel_living_paise`; blank is intentionally not zero. Travel, food, equipment and other costs are handled separately by the affordability planner, not as an AP source dataset. |
| Scholarships and financial-aid schemes | **Missing production data; synthetic test data and manual records only** | None in records | Schema supports `applicable_academic_year`; no populated official year | None | Fields support state, category, income, course and institution type, but no scheme has verified eligibility coverage | `scholarship_records` supports award ranges, rules, deadlines, documents and application steps. No official provider catalogue, refresh process or independently checked rule exists. |
| Scholarship applications/awards | **User-entered planning data, not an external dataset** | Not applicable | No academic-plan-year allocation | User-entered timestamps; no source freshness for an award event | Status/amount/confirmation are user assertions | RLS and constraints separate potential, approved and received amounts. This is not evidence that a provider approved or paid an award. |
| Family budgets and expenses | **User-entered estimates/planning data** | Not applicable | Plan duration and plan year are user-configured | User-entered timestamps | No external eligibility | These are family planning inputs, not official education prices. Confirmed funds and future contributions are deterministic calculations from user inputs. |
| Opportunity criteria, tasks and alternatives | **User-entered planning data; no official opportunity catalogue** | Optional per-record URL; no populated URL | Opportunity records can carry an applicable academic year | User-entered | Criteria can be fixed/actionable and eligible/not eligible/unknown, but evidence is user-recorded | The safe default is `unknown`; task completion does not prove submission or approval. |
| Roadmap resources | **Missing catalogue; user-curated records supported** | Required per resource when records are created | User-provided metadata | User-provided | No preloaded course/resource eligibility | No resource catalogue or independently verified learning-provider data is shipped. |

### URLs actually present

No college, cutoff, fee, scholarship or aid record in the repository contains a source URL. URLs found are implementation/configuration URLs only (local Supabase endpoints, the Groq API endpoint, framework documentation, and placeholder/example URLs in tests or deployment docs). They are not evidence for an AP dataset and must not be presented as such.

## Provenance and validation behavior

### College records

`college_comparison_options` requires a non-negative integer-paise tuition/living value when supplied, allows unknown values as `NULL`, and constrains `data_status` to `official_verified`, `historical`, `estimate`, `unverified` or `missing`. Official rows require a source URL, cutoff year and last-verified date; historical rows require a cutoff rank. The UI requires cutoff, year, source and verification date for an official label and displays historical cutoffs as guidance rather than a guarantee.

The database does not independently establish that a URL is an official AP counselling, government or institution source. There is also no college/provider ID, duplicate business key or source conflict record in the schema.

### Scholarship records

`scholarship_records` constrains non-negative award ranges, requires the maximum not to be below the minimum, and supports `official`, `secondary` and `user_provided` source types. `official_verified` requires an official source type, URL and last-verified date; verified records require a URL. Opportunity fields add academic year, required documents and application steps. No row is preloaded.

`confirmedScholarshipFunding` counts only an explicitly confirmed application in `approved` or `received` status, with a positive award/received amount and a linked record not marked `unverified` or `missing`. A received amount replaces the awarded amount and application IDs are counted once. This protects the affordability calculation from potential, pending, rejected and unverified aid, but it does not prove that the provider actually approved or paid the amount.

### Validator observations

- `validateProvenance` checks year range, date shape, URL shape, required verified metadata and historical-year presence.
- `validateCollegeImport` checks names, positive verified/historical cutoffs and non-negative costs.
- `validateScholarshipImport` checks names, non-negative amounts and award-range order.
- `recordFreshness` marks records older than 366 days stale or unknown when no date exists.
- `duplicateKeys` detects normalized duplicate keys, but the application does not yet execute a reviewed batch import or resolve conflicts.
- The validator accepts both `http` and `https` URLs (`validHttpUrl`), while the documented import rule says official HTTPS and the database checks use `^https?://`. This is a provenance hardening gap: official imports should be rejected unless HTTPS is required consistently.
- A user can select an `official_verified` status after supplying metadata. This is metadata validation, not independent verification of the source, issuer, amount, cutoff or eligibility rule.
- There is no validator for contradictory cutoff category/round combinations, institution identity, fee effective period, source content, or scholarship eligibility completeness.

## Can unverified data become a confirmed recommendation or aid?

### Financial aid

The confirmed-funding calculation is protected in application logic and by the scholarship application check constraint. Potential, applied-for, rejected, unverified and missing aid cannot reduce the funding gap through the normal calculation path. Received-versus-awarded precedence and duplicate application-ID handling are covered by unit tests. RLS prevents unrelated families from reading or mutating these rows in the tested local fixtures.

This is not a substitute for provider evidence: a student can still self-assert an official URL/verification label and then explicitly confirm an approved amount. That assertion remains a product trust limitation until an import review or independent verification process exists.

### College recommendations

The simulator compares a user-entered rank with a stored cutoff and labels the result as rank meets/above/missing cutoff. It does not compute admission probability or guarantee. Affordability is calculated only when both tuition and hostel/living costs are present; unknown values return no affordability result. The unified dashboard treats primary/alternative signals as recorded-data guidance, not an official recommendation. There is no preloaded record that could currently be mistaken for verified AP advice.

### Opportunity and roadmap claims

Criteria default to unknown, tasks are explicitly student-recorded, and completion is not evidence of application, skill mastery or approval. The UI states that no schemes are preloaded and that records must be attributable. This is the correct safe posture, but the system still relies on the person entering status and provenance accurately.

## Import format and smallest safe acquisition path

The existing format in `docs/DATA_IMPORT_FORMAT.md` is sufficient for a first reviewed import; adding a parallel importer would duplicate functionality. Use the current CSV shapes:

- College option: `comparison_id,college_name,branch_name,cutoff_rank,cutoff_year,cutoff_category,counselling_round,source_url,last_verified_at,data_status,annual_tuition_paise,annual_hostel_living_paise`.
- Scholarship: `name,provider,award_min_paise,award_max_paise,eligibility_rules,deadline,official_source_url,source_type,verification_status,last_verified_at,applicable_academic_year,state_code,category,income_limit_paise,course,institution_type,required_documents,application_steps,notes`.

Smallest safe process:

1. Obtain a reviewed export from a named official counselling, institution or scheme source and retain the exact source URL, publication/academic year and review date outside the application’s display text.
2. Normalize one record per college/branch/category/round/year or scholarship/provider/year. Keep unknown numeric values `NULL`; never substitute zero.
3. Run the existing validators, require HTTPS for official sources, reject invalid years/dates/amounts/ranges, and flag normalized duplicate business keys before insertion.
4. Stage the CSV for a human review of source content, eligibility scope, effective year and conflicts. Do not label a row `official_verified` merely because the URL looks official.
5. Insert through an authenticated, protected server-side import path or a reviewed migration. Do not use the browser’s service-role key or bypass RLS. Preserve the existing student/family ownership model for user-created comparisons; a future shared catalogue should use a separately designed read-only/public data model rather than weakening those policies.
6. Record refresh date and mark old rows stale before they can be described as current. Keep historical cutoffs explicitly historical and never present them as admission thresholds or guarantees.

No schema change is required for this first acquisition step. A later reviewed catalogue may need stable institution/scheme identifiers, effective dates, conflict history and an independent verification/audit field; those should be added only with a separate design and RLS review.

## Highest-impact AP EAPCET data gaps

1. **Official counselling cutoffs** by academic year, college, branch, category, gender/local-area rule where applicable, and counselling round. Without these, rank comparison is only manual historical guidance.
2. **Official fee schedules** by institution and year, including tuition, mandatory charges, reimbursement/fee-waiver treatment and whether hostel costs are institution-provided or estimated.
3. **A stable college/branch identity map** so duplicate names, abbreviations and branch codes do not create contradictory comparisons.
4. **Verified scholarship and fee-reimbursement schemes** with current academic year, domicile/category/income/course/institution eligibility, award basis, deadline, required documents, application channel and official URL.
5. **Freshness and conflict handling** for counselling rounds, revised fee notices and changed deadlines.
6. **Student-specific interpretation rules** for rank category, local status, course/branch and year; a cutoff match must remain guidance, not an admission prediction.
7. **Academic-year aid allocation** so an approved/received scholarship is not treated as available in every plan year.

## Prioritized data-acquisition plan

| Priority | Deliverable | Acceptance criteria | Main risk |
| --- | --- | --- | --- |
| P0 | Reviewed AP EAPCET cutoff import for one clearly bounded academic year and counselling scope | Every row has official URL, year, category, round, cutoff rank, review date and stable college/branch identity; duplicates/conflicts are reviewed | Treating historical or round-specific cutoffs as guarantees |
| P0 | Reviewed fee/hostel import for the same colleges | Fee components and effective year are attributable; unknown components remain null; no invented living costs | Mixing institution fees with family estimates or stale notices |
| P0 | One verified scholarship/fee-reimbursement source set | Rules, amounts, deadlines and documents map to cited official pages and current academic year; source review is recorded | Self-attested “official” rows being treated as independently verified |
| P1 | Protected staging/review workflow using existing validators | Invalid provenance/amounts and normalized duplicates are rejected before insertion; reviewer can resolve conflicts | Import bypassing RLS or partial batches |
| P1 | Freshness and correction process | Last-checked date, stale marking and correction history are visible; refreshed rows do not silently overwrite conflicting history | Users seeing outdated cutoffs/deadlines |
| P1 | Stable identifiers and eligibility coverage | College/branch/scheme IDs and explicit missing/unknown eligibility fields are available | Name-based joins and overconfident eligibility matching |
| P2 | Academic-year affordability allocation for aid | Approved and received aid is assigned once to the relevant year, with tests for timing and no double count | Overstating yearly affordability |

## Readiness decision

**Not ready for a data-backed AP college or scholarship demonstration.** The code is ready for a transparent manual-entry/import-oriented workflow and safely communicates missing data, but no external education facts are evidenced in this repository. The next safe step is a small, human-reviewed official cutoff/fee sample with provenance preserved end to end, followed by the same treatment for one current scholarship source. Until then, demonstrate the empty state and clearly marked user estimates rather than realistic-looking sample records.

## Validation command

The requested repository check was run:

```text
git diff --check
```

Result: **PASS** (no whitespace errors). No source or data files were modified by this audit; only this report was added.
