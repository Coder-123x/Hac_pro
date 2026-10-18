# Andhra Pradesh data import format

The repository intentionally contains no seeded college, cutoff, fee or scholarship dataset. The pgTAP fixtures are synthetic and must never be shown as production opportunities.

Imports should be reviewed before insertion and must preserve provenance. Use one UTF-8 CSV row per record with the following fields.

## College and branch options

`comparison_id,college_name,branch_name,cutoff_rank,cutoff_year,cutoff_category,counselling_round,source_url,last_verified_at,data_status,annual_tuition_paise,annual_hostel_living_paise`

`data_status` is one of `official_verified`, `historical`, `estimate`, `unverified`, or `missing`. Official records require an official HTTPS source, year and verification date. Historical cutoffs are guidance only and never an admission guarantee. Blank costs remain unknown; do not replace them with zero.

### Historical cutoff v2 contract

The v1 header remains supported unchanged for manual/user records. Reviewed
historical source imports must use the additive v2 header, which appends
`institution_code,branch_code,admission_region,source_row_number,source_sno,source_record_key`.
These fields preserve source identity that v1 cannot represent. `source_record_key`
is a lowercase SHA-256 identity derived from the source artifact hash, source
row and cutoff category. v2 rows must remain `historical`; source identity,
positive cutoff rank, academic year, URL and review date are required. The
parser quarantines malformed rows and conflicting business keys instead of
deduplicating or overwriting them. Exact replays of an existing
`source_record_key` are idempotent.

The v2 parser and safe import planner are in `lib/data-quality.ts`
(`parseCutoffImportCsv`, `validateCutoffV2Row`,
`createCutoffSourceRecordKey` and `planCutoffImport`). No v2 rows have been
imported into the application or database.

## Scholarships

`name,provider,award_min_paise,award_max_paise,eligibility_rules,deadline,official_source_url,source_type,verification_status,last_verified_at,applicable_academic_year,state_code,category,income_limit_paise,course,institution_type,required_documents,application_steps,notes`

`source_type` is `official`, `secondary` or `user_provided`. Verified records require a source URL; official verification additionally requires an official source and last-checked date. A scholarship listing is not proof of eligibility, application or approval. Amounts and deadlines must be copied from the cited source and reviewed for the relevant academic year.

## Review rules

- Reject invalid URLs, years, dates, negative paise amounts and award ranges where the maximum is below the minimum.
- Flag duplicate records using normalized provider/name/year or college/branch/year/category/round keys.
- Mark records older than the freshness window as stale and re-check them before presenting them as current.
- Keep source URL, source type, verification status, academic year and last-checked date with every imported row.
- Do not import a record when the official source cannot be verified. Use the application's manual unverified state instead.

The pure validators live in `lib/data-quality.ts` and are suitable for a future server-side batch importer. No remote database or official source has been imported by this repository.
