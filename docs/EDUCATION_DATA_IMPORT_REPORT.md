# AP education data import report

Retrieval date: 2026-10-18
Status: **staging only — historical/estimate records awaiting independent review**
No live database, remote project, migration, schema, RLS policy or application recommendation was changed.

## Batch summary

This batch contains a full non-blank-cell extraction of the retained APSCHE AP EAPCET historical workbook and one separately sourced APHERMC fee record. The datasets are intentionally not joined: the APSCHE workbook contains 273 institution codes, while the APHERMC fee order uses `SAVEOC`. The existing import format has no institution-code, affiliation or source-row fields, so exact source identifiers are preserved in sidecar CSVs and the original files remain under `data/staging/sources/`.

| Staged file | Source | Rows | Classification | Review state |
| --- | --- | ---: | --- | --- |
| `data/staging/ap_eapcet_2024_last_ranks.csv` | APSCHE portal-linked XLS | 25,505 | Historical cutoff guidance | Awaiting independent review; not current or admission-guaranteeing |
| `data/staging/ap_btech_2024_25_fee_records.csv` | APHERMC / Government of Andhra Pradesh G.O.Ms.No.48 | 1 | Official-source tentative historical fee estimate | Awaiting independent review and final-fee/court-status review |
| `data/staging/ap_eapcet_2024_source_rows.csv` | APSCHE source-row mapping | 1,565 | Provenance sidecar | Preserves all 273 institution codes, branch codes and source-row metadata |
| `data/staging/ap_eapcet_2024_cutoff_source_map.csv` | APSCHE cutoff-to-source mapping | 25,505 | Provenance sidecar | Maps every staged cutoff row to its exact XLS row/code/category |
| `data/staging/ap_eapcet_2024_blank_categories.csv` | APSCHE blank-cell mapping | 2,665 | Missing-data sidecar | Records blank category cells without inventing ranks |
| `data/staging/ap_btech_2024_25_fee_source_rows.csv` | APHERMC annexure transcription | 1 | Provenance sidecar | Preserves `SAVEOC`, `HERMC0212`, and fee basis |

The complete source manifest is [`data/staging/education_data_source_manifest.json`](../data/staging/education_data_source_manifest.json). Downloaded source artifacts are retained but are not imported into Supabase.

## Source 1: APSCHE AP EAPCET last ranks

- Portal: <https://cets.apsche.ap.gov.in/EAPCET25/Eapcet/EAPCET_HomePage.aspx>
- Original linked file: <https://apsche.ap.gov.in/Pdf/APEAMCET2024LASTRANKDETAILSNONSW.XLS>
- Portal title: **AP EAPCET-2025**; link text: **AP EAPCET-2024 Last Rank Details**.
- File title: `APEAPCET-2024 [MPC STREAM] LAST RANK DETAILS`.
- Academic year: 2024 admission/counselling data as stated by the file title; not 2025 current data.
- Publication date: not stated on the portal or in the workbook. Workbook metadata reports a last-saved timestamp of 2025-06-16, which is not treated as a publication date.
- Retrieval date: 2026-10-18.
- Extraction: downloaded the XLS and read all numeric source rows with `xlrd`; retained every non-blank rank under all source category columns.
- Source rows: 1,565 across 273 institution codes and 1,476 unique code/branch pairs.
- Extracted rows: 25,505 non-blank cutoff cells.
- Blank category cells: 2,665, recorded in a separate missing-data sidecar; no cutoff was inferred.
- Source-row and cutoff mapping sidecars preserve exact institution codes, branch codes and source row numbers.

The source disclaimer states that ranks are at the end of web counselling, exclude special reservation categories and may not reflect dropouts or spot admissions. It explicitly says the statement is informational and does not indicate the rank at which a seat can be allotted in the present academic year. `counselling_round` is blank because the source does not provide a round field. Blank category cells were omitted from the historical CSV because a historical row without a positive cutoff cannot pass the existing validator; their exact source locations are retained in the blank-category sidecar. The source workbook’s `COLLFEE` values were not mapped into the fee dataset because they are a separate field in the cutoff workbook and would create an unsupported join between cutoff and fee sources.

All rows are marked `historical`, not `official_verified`. The CSV’s `last_verified_at` value is the repository retrieval/inspection date, not an independent review or a claim that the historical cutoff is current.

## Source 2: APHERMC B.Tech fee order

- APHERMC index: <https://aphermc.ap.gov.in/news.html>
- Original PDF: <https://aphermc.ap.gov.in/Gos-2023-26/B.Tech_GO%20Ms%20No%2048_2024-25.pdf>
- Source title: **Government of Andhra Pradesh, G.O.Ms.No.48, Higher Education (R.M.) Department — Higher Education — Fixation of fee structure for Engineering Programmes**.
- Academic year: AY 2024-25.
- Publication/order date: 2024-08-06, printed on page 1.
- Retrieval date: 2026-10-18.
- Extraction: downloaded scanned PDF; manually transcribed the single page-4 annexure row after rendering the page. The PDF has no machine-readable text layer.
- Extracted row: one private unaided institution, convener quota, B.Tech, annual APHERMC proposed fee ₹43,000 (`4,300,000` paise).
- College identity: `SAVEOC`, institution `ALWAR COLLEGE OF ENGINEERING-VISAKHAPATNAM - VSP`, society code `HERMC0212`.

The order describes the fee as tentative and subject to pending writ appeals and later fee finalization. It says the annual fee is all-inclusive for listed recurring items but excludes hostel, transport, mess, registration, admission and refundable deposits. This is therefore not a complete four-year cost or hostel dataset. The row is staged as `estimate` despite its government source because the order itself is tentative and the application has no separate “official-source tentative fee” status. It must not be described as a current final fee.

## Source rejected from conversion

The downloadable APHERMC workbook is preserved at [`data/staging/sources/aphermc_btech_fee_annexure_2023_2026.xls`](../data/staging/sources/aphermc_btech_fee_annexure_2023_2026.xls).

- URL: <https://aphermc.ap.gov.in/Doc2023-26/ANNEXURES-Block_Period_2023-2026.xls>
- Academic context: block period 2023-24 to 2025-26.
- Retrieval date: 2026-10-18.
- Result: **0 rows staged**.

Inspection showed a fee-proposal proforma/template rather than an approved fee-order dataset. Sample sheets contain placeholder values such as `ABC INSTITUTE OF TECHNOLOGY & SCIENCE`, `AITS` and `XYZ TRUST`; these were not treated as real colleges or fees. No values from this workbook are used in the CSVs.

## CSV format and validation

The staged CSVs use the documented college-option header from `docs/DATA_IMPORT_FORMAT.md`. No new format or schema was introduced.

Validation was run with the existing `validateCollegeImport`, `duplicateKeys` and `duplicateKey` functions through a temporary `tsx` script (not committed):

```text
ap_eapcet_2024_last_ranks.csv — 25,505 rows; validator rejects: 0; duplicate contract keys: 1,576 groups
  missing comparison_id: 25,505; missing counselling_round: 25,505; missing tuition: 25,505; missing hostel: 25,505
  status values: historical only

ap_btech_2024_25_fee_records.csv — 1 row; validator rejects: 0; duplicate keys: 0
  missing comparison_id: 1; missing cutoff rank/year: 1; missing counselling_round: 1; missing hostel: 1
  status values: estimate only
```

`comparison_id` is blank because no family comparison exists in staging. It must be assigned by an approved import workflow, not fabricated here. Blank hostel and cutoff fields remain unknown. The fee row’s blank cutoff fields are intentional and must not be used as a cutoff record.

No conflicting values were found within the extracted APSCHE data or the single APHERMC fee row. Cross-source identity was deliberately not attempted because `SAVEOC` does not match any APSCHE institution code in this batch.

## Review limitations and safe-use rules

1. These files are not live application data and must not be imported without a human review of source content, identity, academic scope and freshness.
2. APSCHE rows are historical last-rank guidance only; they are not admission thresholds, probabilities or guarantees.
3. The APHERMC amount is a tentative AY 2024-25 annual fee for one institution/quota and excludes several cost categories.
4. Neither source provides hostel/living, travel, equipment or complete four-year cost data.
5. No scholarship or financial-aid records were sourced in this batch.
6. No source was independently verified by the application; `last_verified_at` records retrieval/inspection only.
7. The existing validator permits HTTP as well as HTTPS at runtime, while the import documentation requires official HTTPS. Any future official batch should enforce HTTPS consistently before import.
8. The records are not recommendations. They should remain in a staging review state until stable identities, source checks, duplicate/conflict review and an approved import path exist.

## Source-to-CSV verification audit

Audit date: 2026-10-18. The retained source files were re-read; no source file or staged data file was rewritten.

### APSCHE cutoff comparison

**PASS — row-level extraction match for the expanded scope.** A mechanical comparison of every staged row against the original XLS found:

- Source data rows: 1,565 across 273 institution codes.
- Included source rows: 1,565; excluded source rows: 0.
- Source non-blank rank cells across all rows: 25,505.
- Staged rows: 25,505.
- Institution code mismatches: 0.
- Branch-code mismatches: 0.
- Category-column mismatches: 0.
- Cutoff-value mismatches: 0.
- Source-row mapping mismatches: 0.
- Blank source cells omitted: 2,665; all are listed in `ap_eapcet_2024_blank_categories.csv`.

The 25,505 rows cover all non-blank category cells for all 1,565 numeric source rows. They represent historical source cells, not current recommendations. `counselling_round` remains blank because no round is present in the source.

### APHERMC fee-row trace

**PASS — transcription of the visible page-4 table.** The rendered page image was inspected because the PDF has no text layer. The annexure heading identifies AY 2024-25 and convener quota seats. Its single row visibly reads:

`1 | SAVEOC | HERMC0212 | ALWAR COLLEGE OF ENGINEERING-VISAKHAPATNAM - VSP | 43000/-`

Thus ₹43,000 (`4,300,000` paise) is the correct value printed as the APHERMC proposed annual fee for that row and scope. The order text also makes it tentative and subject to court proceedings/finalization; the staged `estimate` label is retained for that reason.

**Identity limitation — NOT VERIFIED beyond the order.** In this table, `SAVEOC` is the college code paired with the named Alwar College row, while `HERMC0212` is the society code. A society code is not sufficient by itself to establish a unique college identity; other APHERMC materials can associate the same society code with related institution records. Therefore the source row is traceable as the exact pair printed in this order, but no broader identity join or equivalence with APSCHE `ACEE` has been made.

### Contract and provenance checks

**PASS — both staged CSV headers exactly match the documented college-option contract** in `docs/DATA_IMPORT_FORMAT.md` (12 columns, same order). Source URLs, academic/cutoff year, historical/estimate status and retrieval/inspection date are retained. College and society codes are preserved in sidecar CSVs because the documented row contract has no code columns. Original XLS/PDF files and SHA-256 values remain in the manifest.

**PASS with review required — existing validators.** `validateCollegeImport` rejected 0 of 25,506 staged college rows and normalized duplicate checks found 1,576 duplicate contract-key groups (3,152 rows). These duplicates reflect repeated source records and distinctions not expressible in the documented 12-column contract; they are flagged, not collapsed or silently deduplicated. The fee row intentionally has no cutoff fields; the cutoff file intentionally has no tuition/hostel values.

### Duplicate contract-key analysis

Audit date: 2026-10-18. Every one of the 1,576 duplicate groups was joined through `ap_eapcet_2024_cutoff_source_map.csv` to the corresponding rows in the retained XLS/source-row sidecar. No duplicate was removed, averaged, overwritten or treated as a repeated import.

The validator key is `(college_name, branch_name, cutoff_year, cutoff_category, counselling_round)`. The source has no counselling-round column, so the round component is blank for every staged row. Every duplicate group has exactly two staged rows (3,152 rows total, or 1,576 rows beyond the first row in each group).

| Cause observed in source evidence | Groups | Rows | Evidence / interpretation |
| --- | ---: | ---: | --- |
| Same institution code and branch, but distinct source admission-region (`A_REG`) rows | 1,355 | 2,710 | Each pair has the same code/name/branch and differs in `A_REG` (normally `AU` versus `SVU`). 1,316 pairs have different ranks; 39 pairs repeat the same rank while retaining the two source rows. |
| Same displayed institution/branch/category but different institution codes | 221 | 442 | The source contains separate institution records that collapse to the same displayed contract key. All 221 have different ranks. In 89 groups the remaining visible metadata matches apart from code/established-year; in 132 groups the source also differs in place and/or other institution metadata. |
| Repeated source row with no source distinction | 0 | 0 | No group mapped twice to one source row number. |
| Same source context with a different cutoff only | 0 | 0 | Rank differences occur, but every duplicate is also attributable to one of the two source distinctions above. |

Across all groups, 1,537 have two different cutoff ranks and 39 have the same cutoff rank. The same-rank examples are still distinct source records, not safe duplicates. For example:

* `BHARATIYA ENGG SCI. &TECH INNOVATION UNIVERSITY / AI / SC_BOYS`: source rows 1385 and 1386, code `BESTPU`, `A_REG` `AU` and `SVU`, rank `146120` in both rows.
* `KAKINADA INSTITUTE OF ENGG. AND TECHNOLOGY / AID / OC_BOYS`: source rows 76 and 81, codes `KIEK` and `KIET`, ranks `124116` and `85843`; the source also shows establishment years `2009` and `2001`.
* `NARAYANA ENGINEERING COLLEGE / CIV / OC_BOYS`: source rows 1331 and 1346, codes `NARN` and `NRNG`, ranks `72148` and `158042`; the source rows differ in establishment year and other displayed institution context.

**Import-readiness decision: NOT READY for direct import into the current 12-column contract.** The 12 columns can carry both cutoff values as separate rows, but cannot identify which institution-code/source-row/admission-region record each value belongs to. A consumer that keys on the documented fields therefore sees an ambiguous duplicate and could not safely distinguish or update the records. The sidecar mapping makes the staging batch auditable, but it does not make the main CSV unambiguous.

The smallest safe future change is to extend the reviewed import contract (and its duplicate key) with stable source identity fields: at minimum `institution_code`, `source_row_number` (or an equivalent source-record ID), and the source admission-region discriminator (`A_REG`); retaining `source_sno` is useful for human reconciliation. Those fields should be carried through the eventual catalog schema/import workflow and validated as part of the uniqueness key. Until that change is reviewed and implemented, this batch must remain historical staging data with its sidecars, not live college-option records.

### Outcome summary

| Check | Outcome | Evidence |
| --- | --- | --- |
| Every staged APSCHE row matches source code/branch/category/rank | **PASS** | 25,505/25,505 exact comparisons; 0 mismatches |
| APSCHE coverage correctly described | **PASS** | All 1,565 numeric source rows, 273 institution codes and 25,505 non-blank cells included |
| APSCHE blank cells preserved as missing | **PASS** | 2,665 blank cells recorded separately; no cutoff inferred |
| Duplicate contract keys analyzed | **PASS for source tracing; NOT READY for direct import** | All 1,576 groups traced to two source rows; 1,576 groups remain flagged because source identity distinctions are outside the documented contract |
| APHERMC page image readable for the staged row | **PASS** | Page 4 table inspected; all five displayed fields transcribed |
| `SAVEOC`/`HERMC0212` broader identity uniqueness | **NOT VERIFIED** | Exact pairing is verified in the order; society-code uniqueness was not established |
| ₹43,000 applicable to this order row | **PASS with scope** | AY 2024-25, private unaided, B.Tech, convener quota, tentative proposed annual fee |
| CSV contract and provenance | **PASS** | Exact headers, source URLs, years/statuses, sidecars and source artifacts retained |
| Current fee, admission recommendation or current-year conclusion | **FAIL / NOT CLAIMED** | Historical data only; no current-year or admission guarantee permitted |

## v2 contract implementation status

The additive v2 cutoff parser and non-destructive import planner described in
[`docs/CUTOFF_IMPORT_CONTRACT_PROPOSAL.md`](CUTOFF_IMPORT_CONTRACT_PROPOSAL.md)
are now implemented in `lib/data-quality.ts`. They preserve the unchanged v1
reader, require source identity/provenance for v2 historical rows, keep
AU/SVU and different institution-code records separate, quarantine malformed
rows and business-key conflicts, and treat exact source-record replays as
idempotent. The planner is pure validation logic only: no staged cutoff rows
were imported into the application or database.

Focused regression coverage includes 9 data-quality tests for v1 compatibility,
v2 parsing, source identities, AU/SVU distinctions, different institution
codes, same-rank distinct source rows, malformed/missing identities, conflict
quarantine, idempotent replay and deterministic source keys.

## v2 historical conversion dry run

The retained v1 staging rows were converted to
[`data/staging/ap_eapcet_2024_last_ranks_v2.csv`](../data/staging/ap_eapcet_2024_last_ranks_v2.csv)
using the original XLS-derived cutoff source map and source-row sidecar. The
conversion preserved all 25,505 non-blank cutoff cells and added institution
code, branch code, `A_REG`, source row/SNO and a SHA-256 source-record key
derived with `createCutoffSourceRecordKey` and the retained source artifact
hash.

| Dry-run check | Result |
| --- | --- |
| v2 output rows | 25,505 |
| Parser/validator rejected | 0 |
| Empty synthetic existing set: accepted | 25,505 |
| Empty synthetic existing set: quarantined | 0 |
| Empty synthetic existing set: rejected | 0 |
| Second plan using first accepted set: idempotent replays | 25,505 |
| Second plan: new accepted rows | 0 |
| Second plan: quarantined/rejected | 0 / 0 |
| Unique source-record keys | 25,505 |
| Repeated conversion byte comparison | PASS |
| v2 rows with missing admission region/category/rank | 0 / 0 / 0 |

### Source comparison

**PASS — no conversion mismatches.** Every v2 row was compared with its
`ap_eapcet_2024_cutoff_source_map.csv` row and the corresponding original XLS
source-row metadata. Institution code, branch code/name representation,
category, cutoff rank, source row number, source SNO and admission region all
matched exactly (25,505/25,505; 0 mismatches). The existing XLS audit also
continues to report 25,505/25,505 source-cell matches and 2,665 blank category
cells omitted from the numeric cutoff dataset and retained in the missing-data
sidecar.

This is a reproducible staging conversion, not production import approval. The
source remains historical 2024 guidance, not a current cutoff or admission
guarantee. No row was inserted into Supabase or the application. The v2 file is
safe for further human review, but a production shared catalogue and its RLS/
conflict-history design remain outstanding.

## Checks run

```text
npx --yes tsx /tmp/validate_all_staging.ts — PASS; 25,506 college/fee rows, 0 validator rejects; 1,576 APSCHE duplicate-key groups flagged
PYTHONPATH=/tmp/hac_xlrd python3 /tmp/audit_apsche_expanded.py — PASS; 25,505/25,505 APSCHE row comparisons exact
CSV header contract check — PASS; both files match the 12 documented columns exactly
Duplicate source-trace analysis — PASS; 1,576/1,576 groups mapped to distinct XLS source rows; 1,355 A_REG-distinguished groups and 221 different-code groups; 0 repeated-source-row groups
Page-4 rendered-image inspection — PASS; APHERMC row legible
v2 data-quality focused tests — PASS; 9 tests
npx --yes tsx /tmp/convert_cutoff_v2.ts — PASS; generated 25,505 v2 rows
npx --yes tsx /tmp/validate_cutoff_v2.ts — PASS; parser 0 issues; empty plan 25,505 accepted; replay 25,505 idempotent; 0 quarantined/rejected; 0 key mismatches
v2 source comparison script — PASS; 25,505/25,505 exact field comparisons; 0 mismatches; 25,505 unique source keys
repeated conversion byte comparison — PASS
full unit suite — PASS; 44 tests across 11 files
npm run typecheck — PASS
npm run build — PASS
git diff --check — PASS
```

No database reset, migration application, remote change, deployment or live recommendation test was performed.
