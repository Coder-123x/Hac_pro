# Historical AP EAPCET cutoff import contract proposal

Status: contract implemented in validation/parsing only. No schema, migration,
database import, staged data or remote resource was changed. This document
remains the design reference for a future reviewed catalogue import.

## Decision summary

The current 12-column college-option CSV is suitable for user-entered records,
but it is not a safe lossless contract for the retained APSCHE workbook. It
collapses source records that share displayed college name, branch name,
category and year. The expanded staging batch contains 1,576 such groups (3,152
rows), all traced to distinct XLS rows.

The smallest safe change is an **additive v2 CSV contract**: retain the current
12 columns in the same order and append source-identity columns. Existing v1
files remain readable. v2 is required for any reviewed historical cutoff
import; v1 rows may remain user/manual records but must not be used to import
this batch. The parser and non-destructive import planner are implemented in
`lib/data-quality.ts`; they do not write to Supabase.

## Required source grain and fields

One cutoff record represents one non-blank cutoff cell from one source row:

`source batch + original source row + institution code + branch code + admission region + category + academic year + counselling scope`

The following fields are required to distinguish and audit that grain:

| Field | Source / rule | Requiredness |
| --- | --- | --- |
| `college_name` | Displayed institution name from the source row | Required, trimmed only for validation; retain source spelling in the staged value |
| `institution_code` | Source `INSTCODE` | Required for reviewed source imports |
| `branch_name` | Displayed branch label or a reviewed branch mapping | Required |
| `branch_code` | Source `branch_code` | Required for reviewed source imports |
| `admission_region` | Source `A_REG` (`AU`, `SVU`, or another source value) | Required when present in source; never inferred |
| `cutoff_category` | Source category column, for example `OC_BOYS` | Required for a numeric cutoff cell |
| `cutoff_rank` | Source cell value, positive integer | Required for a cutoff record |
| `cutoff_year` | Academic/counselling year represented by the source | Required; 2024 for this retained workbook |
| `counselling_round` | Source round when supplied | Nullable; blank in the retained workbook because no round is provided |
| `source_row_number` | Physical/original source-row identity from the retained workbook | Required for this batch |
| `source_sno` | Source `SNO` logical row identity | Required when supplied |
| `source_record_key` | Deterministic key derived from source batch identity, source row and category | Required for idempotent import |
| `source_url` | Original official file URL | Required |
| `source_file_sha256` | Hash of the retained source artifact, kept in the manifest or import batch metadata | Required for a reviewed batch; may be metadata rather than a repeated CSV column |
| `last_verified_at` | Retrieval/review date, not a claim that historical data is current | Required |
| `data_status` | `historical` for this batch | Required; must not be upgraded automatically |
| `annual_tuition_paise` / `annual_hostel_living_paise` | Separate fee sources only; unknown remains null | Nullable; never copied from an unrelated source or replaced with zero |

`source_affiliation` (`AFFL.`), `institution_region` (`INST_REG`), district,
place, co-ed flag and establishment year should be retained in the provenance
sidecar or an optional metadata extension when available. They are useful for
review, but they are not substitutes for `institution_code`, `branch_code`,
`admission_region` and `source_row_number`.

## Proposed additive CSV v2

Keep the existing header exactly as the first 12 columns, then append:

```text
comparison_id,college_name,branch_name,cutoff_rank,cutoff_year,cutoff_category,counselling_round,source_url,last_verified_at,data_status,annual_tuition_paise,annual_hostel_living_paise,institution_code,branch_code,admission_region,source_row_number,source_sno,source_record_key
```

This is backward-compatible at the file-reading level: a v1 reader can still
read the first 12 fields, while a reviewed importer must reject a historical
source batch if the appended identity fields are absent. A future importer may
also accept `source_file_sha256` and source metadata through a batch manifest
rather than repeating it on every row.

The current v1 contract loses these distinctions from the XLS/sidecars:

- `INSTCODE` (institution identity);
- source `branch_code` (the displayed `branch_name` is not a stable key);
- `A_REG` (`AU` versus `SVU`);
- original `source_row_number` and logical `SNO`;
- a deterministic source-record identity and source-batch identity;
- optional source context such as affiliation and institution region.

The v1 contract does retain category, cutoff rank, year, source URL, review
date and historical status, but those fields alone do not identify the source
record. Sidecars currently restore the missing provenance for audit; they do
not make the main CSV safe to import by itself.

## Evidence-based example rows

These examples use only values already present in the retained APSCHE XLS and
sidecars. The `source_record_key` values are intentionally shown as
`<computed-at-import>` rather than fabricated constants.

| college_name | institution_code | branch_name | branch_code | admission_region | category | cutoff_rank | year | source_row_number | source_sno |
| --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: |
| BHARATIYA ENGG SCI. &TECH INNOVATION UNIVERSITY | BESTPU | AI | AI | AU | SC_BOYS | 146120 | 2024 | 1385 | 1383 |
| BHARATIYA ENGG SCI. &TECH INNOVATION UNIVERSITY | BESTPU | AI | AI | SVU | SC_BOYS | 146120 | 2024 | 1386 | 1384 |
| KAKINADA INSTITUTE OF ENGG. AND TECHNOLOGY | KIEK | AID | AID | AU | OC_BOYS | 124116 | 2024 | 76 | 74 |
| KAKINADA INSTITUTE OF ENGG. AND TECHNOLOGY | KIET | AID | AID | AU | OC_BOYS | 85843 | 2024 | 81 | 79 |

The first pair has one institution code and branch but two source rows and two
`A_REG` values. The second pair has the same displayed name/branch/category but
different institution codes and ranks. Both pairs would collide under the v1
contract and must remain separate under v2.

## Keys, idempotency and conflicts

### Source-record key

For a reviewed import, compute a canonical `source_record_key` from the source
artifact identity and source cell identity, for example:

```text
sha256(source_file_sha256 + "|" + source_row_number + "|" + cutoff_category)
```

The exact canonicalization must be specified in the importer and tested. It
must not depend on display-name whitespace or a generated UUID. Re-running the
same source artifact is then idempotent: the key is recognized and the record
is not inserted twice.

### Business comparison key

For conflict detection, separately compare:

```text
(institution_code, branch_code, admission_region, cutoff_year,
 cutoff_category, counselling_round)
```

If a later source batch contains the same business key with a different rank,
the importer must create a review conflict (with both source batches and
values) rather than overwrite, average or silently choose one. A changed
source artifact should be a new batch/version, not an update that destroys the
historical value. Exact duplicate rows with the same source-record key and
same values may be treated as an idempotent re-run; mismatching values for the
same key must fail the batch or remain quarantined.

## Historical and incomplete values

- This workbook is 2024 admission/counselling data linked from the AP EAPCET
  2025 portal. Import it only as `data_status=historical` and `cutoff_year=2024`.
- Historical cutoffs are guidance, not current thresholds, probabilities or
  admission guarantees. They must be separated from current-year data in
  queries and UI labels.
- The source has no counselling-round field; `counselling_round` remains null,
  not an invented round.
- Blank category cells and blank cutoff cells are missing data. The current
  staging process records 2,665 such cells in
  `ap_eapcet_2024_blank_categories.csv`; they must not be converted into zero,
  a guessed category or a cutoff row.
- Unknown tuition and hostel/living values remain null. The workbook's fee
  column is not automatically joined to the separate APHERMC fee source.

## Validator and test changes required

The proposal does not implement these changes. Before accepting v2 data, the
validator suite should:

1. require `institution_code`, `branch_code`, `source_row_number`,
   `source_record_key`, year, category, rank, URL, review date and
   `data_status=historical` for this batch;
2. validate `admission_region` against the source value set without assuming
   only `AU`/`SVU` when a future source documents another value;
3. reject non-positive ranks, malformed source identities, inconsistent source
   hashes, invalid dates/URLs and invented counselling rounds;
4. use the v2 source-record key for duplicate detection, while retaining the
   business-key conflict check described above;
5. allow a repeated exact v2 row to be idempotent but flag a same-key/different-
   rank conflict;
6. preserve null costs and missing-category sidecar records without converting
   them to numeric zeros.

Focused tests should cover:

- the two `BESTPU` rows remaining distinct for `AU` and `SVU`;
- the `KIEK` and `KIET` rows remaining distinct despite the same displayed
  college/branch/category;
- a second import of the same source hash producing no new records;
- a changed rank for the same business key producing a conflict, not an
  overwrite;
- duplicate source-row/category keys being rejected unless they are an exact
  idempotent replay;
- blank category/cutoff cells remaining missing and historical records never
  being treated as current or official-verified.

## Database implications (future work only)

`public.college_comparison_options` is currently a family-owned comparison
table with required `comparison_id`, `family_id` and `created_by` fields. It is
appropriate for user-entered options, not a shared AP catalogue imported once
for all families. A future production import should therefore use a separate,
read-only, provenance-aware catalogue table (or an explicitly reviewed
catalogue migration) with the v2 identity and batch fields, and then copy a
selected catalogue row into a user's comparison through existing RLS. It must
not use a service-role key in the browser or weaken family policies to make a
global import fit the user-owned table.

No database migration is proposed in this document. Any catalogue migration
would require its own RLS, conflict-history, refresh and authorization review.

## Phased implementation plan

1. **Contract and validator phase:** implement the additive v2 parser and
   canonical key rules; keep v1 parsing for existing manual files.
2. **Staging verification phase:** generate v2 rows from the retained XLS,
   compare every value to the XLS, and quarantine conflicts/missing identities.
3. **Review phase:** approve source URL, academic scope, category/region
   meaning and freshness; retain the source hash and review evidence.
4. **Catalogue design phase:** add a separate read-only catalogue schema and
   RLS only after identity and conflict behavior are accepted.
5. **Import and UI phase:** import historical records as guidance, expose
   provenance and uncertainty, and keep current-year recommendations disabled
   until a current reviewed source exists.

## Acceptance criteria

The batch is safe to import only when every numeric cutoff row has a stable
source identity, every duplicate contract key is explained by source fields,
the source-to-output comparison has zero mismatches, repeated imports are
idempotent, conflicts are quarantined, and historical labels remain visible.
Until then, the retained expanded CSV is staging-only and **not ready for
direct import**.
