# Education catalogue and reviewed import design

Status: The catalogue foundation, secure reviewer gate and reviewer-only
import-preview/approval workflow are implemented. No staged production CSV was
imported and no remote resource was changed. Reviewer provisioning remains an
administrator-only operational step; a catalogue management UI is not
implemented.

## Phase 1 validation evidence

The local Supabase instance was already running and the migration history was
checked before applying changes. The exact non-destructive command used to
apply the pending local migration was:

```bash
npx supabase migration up --local --yes
```

No `db reset`, volume deletion, remote migration, seed import or deployment was
performed. The local history now includes the foundation, reviewer-access and
workflow migrations through
`20261018120300_education_catalogue_import_workflow.sql`, with no pending
local migrations.

Validation results from the current working tree:

| Check | Result |
| --- | --- |
| `npx supabase test db --local supabase/tests/education_catalogue_foundation_rls.test.sql` | PASS — 40 tests |
| All `supabase/tests/*.sql` suites | PASS — 8 suites, 123 tests total |
| `npx supabase db lint --local` | PASS — no schema errors |
| `npm run test:unit` | PASS — 11 files, 44 tests |
| `npm run typecheck` | PASS |
| `npm run build` | PASS |
| `git diff --check` | PASS |

The database tests cover unpublished-row visibility, ordinary authenticated
write denial, namespaced identifiers, foreign-key and uniqueness constraints,
reviewer allowlist isolation, positive reviewer publication, revoked-reviewer
denial, non-destructive reviewer privileges and append-only audit events.

The staged CSV was not imported. The workflow is ready for a separately
approved synthetic or reviewed staging batch, but publication still requires
operational reviewer provisioning, source review and an import-management UI.

## Import-preview and approval workflow

The server endpoint `POST /api/catalogue/import-preview` accepts the documented
v2 CSV plus explicit source provenance metadata. It limits payloads to 5 MB,
requires an authenticated reviewer, parses the v2 contract, verifies every
`source_record_key` against the artifact SHA-256/source-row/category formula,
and sends only validated rows to the database RPC. Malformed parser rows and
key mismatches are passed as quarantine evidence; no source row is silently
dropped.

`education_preview_cutoff_import` is a security-definer, fixed-search-path
RPC. It atomically creates a `review_required` source batch, resolves only
approved institution/branch aliases in the requested source namespace, stores
accepted cutoff rows as `draft`, quarantines rejected/unresolved/replay/conflict
rows and writes a `preview` audit event. Its summary separates accepted,
rejected, duplicate/replay, conflict and quarantined counts. Artifact-level and
source-key advisory locks serialize concurrent requests. Repeating the same
artifact returns the original batch summary; it does not create a second batch.

`POST /api/catalogue/batches/{batchId}` accepts only `approve`, `publish` or
`retire`. `education_catalogue_batch_action` locks the batch, enforces the
state transition (`review_required -> approved -> published -> retired`),
updates draft/publication state atomically and appends an audit event with the
authenticated actor. Direct client DML is revoked, so reviewers cannot bypass
these transitions or delete source evidence. Retirement hides the batch and
marks its cutoff rows retired without deleting rows or audit history.

Operational sequence:

1. A database administrator provisions an approved reviewer out-of-band.
2. The reviewer submits a small, source-faithful v2 CSV to the preview endpoint.
3. The reviewer inspects the summary and quarantine rows, resolves identity
   mappings outside the import, and calls `approve`.
4. Only after source review does the reviewer call `publish`; `retire` is the
   rollback action if a published batch must be withdrawn.

The full 25,505-row staged file was not submitted. Production use still
requires a separately approved staging import, operational monitoring and a
reviewer UI. No service-role credential is used by the routes.

## Executive decision

The staged AP EAPCET v2 CSV is a source-faithful batch, but it is not itself a
canonical college catalogue. The application currently stores
`college_comparison_options` inside a student's family comparison, with
`family_id`, `comparison_id` and `created_by` required. That table is suitable
for private/user-entered options, not one shared AP dataset imported once for
all families.

The safe next phase is a separate, provenance-aware education catalogue with a
reviewer-controlled staging/import workflow. A student can
select a catalogue record into a private comparison, but the catalogue must
not inherit or expose the student's family, budget, rank, scholarship or
sharing data.

## Verified repository facts

- The retained APSCHE artifact is a 2024 last-rank workbook linked from the
  AP EAPCET 2025 portal. It contains 1,565 numeric source rows, 273
  institution codes and 25,505 non-blank cutoff cells.
- The source map preserves `institution_code`, `branch_code`, category, rank,
  source row and source SNO. The v2 CSV additionally preserves `A_REG`, source
  provenance and a deterministic source-record key.
- There are 1,576 v1 contract-key duplicate groups. They are legitimate source
  distinctions, including `AU`/`SVU` rows and separate institution codes.
- The source has no counselling-round field; the v2 value is blank rather than
  inferred. 2,665 blank category cells are retained in a missing-data sidecar,
  not converted into cutoff records.
- `college_comparison_options` has nullable cutoff/fee fields, provenance
  status and family-scoped RLS. It has no institution code, branch code,
  admission region, source-row identity or catalogue foreign key.
- The current simulator reads and writes family-owned comparison options. It
  labels historical data as guidance and does not claim admission probability
  or guarantee.
- APHERMC `SAVEOC` and society code `HERMC0212` are a separate source
  namespace. No identity join with APSCHE codes is established.

## Canonical catalogue model

The following is a design target, not a request to apply a migration now.

### Institution identity

`education_institutions` should have a generated internal `institution_id`,
display/legal names, institution type, district/place and an identity review
state. Source identifiers must be namespaced:

```text
(source_system, source_institution_code) UNIQUE
```

Examples are `(APSCHE_EAPCET, BESTPU)` and `(APHERMC, SAVEOC)`. A society code
such as `HERMC0212` is stored as a separately typed source identifier; it is
never used as an APSCHE institution code. A display-name match alone must not
merge institutions. If two source codes appear to represent one institution,
the mapping is a reviewed alias decision with evidence and history, not an
automatic join.

`education_institution_source_ids` should retain source system, raw code, raw
name, source batch and reviewer decision. This allows a correction without
destroying the original source identity.

### Branch identity

`education_branches` should have an internal `branch_id`, canonical display
name and course family. Source branch codes belong in a namespaced alias table:

```text
(source_system, source_branch_code) UNIQUE -> branch_id
```

The same code must not be assumed to mean the same branch across sources. The
APSCHE v2 `branch_code` is retained exactly; `branch_name` is a presentation
field and must not replace the code as an identity key. Unmapped branch codes
remain quarantined rather than being guessed from a similar name.

### Historical cutoff record

`education_cutoffs` should reference canonical `institution_id` and
`branch_id`, and contain:

```text
admission_region              -- source value, e.g. AU or SVU
cutoff_category               -- source category, e.g. OC_BOYS
cutoff_rank                   -- positive integer
academic_year                 -- 2024 for this batch
counselling_round             -- nullable when source omits it
source_batch_id
source_record_key             -- unique within the catalogue
source_row_number
source_sno
data_status                   -- historical until a separately reviewed status exists
publication_state             -- draft, approved, published, retired
```

The cutoff row owns region, category, year and round because those values are
properties of an admission result, not permanent institution attributes. The
source batch owns URL, artifact hash, title, retrieval date and reviewer
approval. The row retains source row/SNO for exact reconciliation.

The natural comparison key for conflict detection is:

```text
(institution_id, branch_id, admission_region, academic_year,
 cutoff_category, counselling_round)
```

The source-record key remains the idempotency key. A later source batch with
the same comparison key and a different rank is a conflict/version, never an
overwrite. Historical rows from different years are separate records.

## Source and review entities

### Source batches

`education_source_batches` should record source URL, source title, source
system, artifact SHA-256, academic year/scope, retrieval date, extraction
method, row counts, manifest path, and a lifecycle such as:

```text
staged -> parsed -> review_required -> approved -> published -> retired
```

Only an approved batch may contribute rows to the published catalogue. A
retrieval date is not an approval date and must not be displayed as proof of
currentness.

### Import preview and quarantine

The server-side importer should produce a preview before any catalogue write:

- input/header/version and artifact hash;
- source and parsed row counts;
- accepted, malformed, missing-identity, duplicate-replay and conflict counts;
- institution/branch mappings requiring review;
- historical/stale status and missing-value counts;
- sample rows with source-row links, never family/student data.

Rows with invalid identity, missing required v2 fields, duplicate source keys,
unmapped institution/branch aliases or conflicting business keys go to an
append-only `education_import_quarantine` record with reason and raw row
reference. They are not silently dropped.

### Reviewer approval and audit

Approval should require a named reviewer, reviewed source URL and scope,
identity mapping decisions, conflict disposition, verification date and an
immutable preview snapshot. `education_import_audit_events` should record
upload, parse, preview, approval, publication, retirement and rollback events.
Audit rows are append-only; corrections create new events and versions.

The reviewer is approving provenance and representation, not claiming that a
historical cutoff guarantees admission. The current staged APSCHE batch should
remain historical even after review.

## Import, conflict and rollback behavior

1. Receive a v2 file and manifest; calculate the artifact hash server-side.
2. Parse and validate with the existing v2 parser. Require exact source key
   recomputation from the batch hash, row number and category.
3. Resolve institution and branch aliases by source namespace. Unresolved or
   ambiguous mappings are quarantined.
4. Generate a preview and require reviewer approval. No catalogue row is
   visible yet.
5. In one transaction, insert the source batch, approved cutoff rows and audit
   event. Enforce unique `source_record_key`.
6. Compare the business key against already published versions. Quarantine
   changed ranks or contradictory metadata; do not update in place.
7. Publish a batch atomically by changing its publication state. Queries use
   an approved/published view, never the staging tables.
8. To roll back, retire the published batch and restore the prior published
   batch/view. Preserve the imported rows and audit history; do not delete
   source evidence or rewrite a cutoff rank.

Exact reprocessing of the same artifact is an idempotent replay. A new artifact
hash is a new source version even when its displayed rows look similar.

## RLS and privacy boundaries

### Trusted shared catalogue

- Published catalogue tables contain no `family_id`, `student_id`, budget,
  rank, scholarship or sharing columns.
- Authenticated users may `SELECT` only rows with approved/published state. An
  unauthenticated policy should remain disabled unless a separate public-data
  decision is made.
- End-user roles receive no direct `INSERT`, `UPDATE` or `DELETE` privileges
  on source batches, mappings, cutoffs, quarantine or audit tables.
- Reviewer writes use the existing authenticated role only after an
  administrator has provisioned the private allowlist; fixed-search-path RLS
  checks the reviewer predicate on every operation. No client-held service
  role or user-editable reviewer claim is used.
- RLS tests must cover cross-family attempts, ordinary authenticated writes,
  unapproved batch visibility and reviewer-only mutation.

### Phase 1.1 reviewer authorization and provisioning

Reviewer assignment is intentionally out-of-band. A trusted database
administrator provisions or revokes a reviewer by connecting with the
administrator role and changing `public.education_catalogue_reviewers.active`.
The table has RLS enabled, no `anon`/`authenticated` grants and no client
policies, so an ordinary user cannot add, remove or activate any reviewer.
The operation must be recorded in the administrator's operational audit trail;
the catalogue audit table is reserved for catalogue actions and remains
append-only.

The `20261018120200_education_catalogue_reviewer_access.sql` migration grants
`SELECT`/`INSERT`/`UPDATE` only on catalogue staging tables to the existing
`authenticated` role. Every such operation is still gated by
`is_education_catalogue_reviewer()`, whose security-definer function has a
fixed `search_path`. Reviewer `DELETE` is explicitly revoked. Reviewers may
read unpublished batches and audit history, stage records, update review
state, publish or retire batches, and append audit events; they cannot alter
or delete audit history. Revoking `active` immediately makes subsequent
requests fail the helper and removes reviewer visibility/write access.

Operational provisioning example (run only by the trusted database
administrator, never from browser code or a user-facing RPC):

```sql
insert into public.education_catalogue_reviewers (user_id)
values ('<trusted-auth-user-uuid>')
on conflict (user_id) do update set active = true;

update public.education_catalogue_reviewers
set active = false
where user_id = '<trusted-auth-user-uuid>';
```

The UUID must be resolved from the trusted Supabase Auth administration
process; it must not be accepted from an untrusted client as a role grant.
Positive authorization was verified locally with a synthetic reviewer, along
with ordinary-user denial, revocation, unpublished visibility and audit
immutability. Real reviewer provisioning and production operations remain
**not verified**.

### Private family data

The existing `college_comparisons` and
`college_comparison_options` policies remain the privacy boundary for student
rank, preferences, affordability and selected options. A catalogue query must
not join to those tables in a way that returns private rows or reveals which
student selected an institution.

When a student selects a catalogue cutoff, the eventual private option should
carry a catalogue cutoff reference and a snapshot of displayed provenance. The
student/family RLS still controls the option. Parent visibility remains subject
to the student's existing college-comparison sharing preference; catalogue
read access alone must not grant access to the private comparison.

Unrelated users must see the same public catalogue rows but no other family's
selected options, rank, budget or sharing state. Catalogue availability is not
evidence that a student is eligible or considering that institution.

## UI and recommendation safeguards

The published catalogue view should display, in text and not only color:

- source title/URL, academic year, admission region, category and round;
- `Historical guidance`, `Current verified`, `Stale`, `Unknown` or `Retired`
  status;
- last checked/reviewed date separately from source publication date;
- missing costs and missing rounds as `Not available`, never zero or inferred;
- a warning that historical last ranks are guidance, not admission thresholds
  or guarantees.

The simulator may compare a student's rank to a historical cutoff, but a
historical row must not be labelled current, likely, guaranteed or officially
recommended. A stale or retired row can remain visible for context but must not
be used as the default current recommendation. Affordability remains the
existing deterministic calculation and must not be derived from cutoff data.

## Connection to the existing application

The first integration should be read-only catalogue search plus a deliberate
“Add to my comparison” action. It should pass only the selected catalogue ID
and verified provenance into a server-side mutation that creates a private
comparison option. It must not create a global row in
`college_comparison_options` for every family.

The smallest private-schema extension is a nullable catalogue-cutoff reference
and source snapshot on `college_comparison_options`, preserving existing user
rows and RLS. That migration is optional for the initial catalogue preview but
required before selected records can be refreshed safely. It must retain the
student's editable notes/cost estimates separately from catalogue facts.

## Smallest implementation sequence

1. **Contract hardening:** keep v1 parsing, require v2 for reviewed source
   batches, and add batch-hash/key recomputation and identity-mapping checks.
2. **Catalogue migration design:** create source batches, namespaced
   institution/branch identities, cutoff rows, quarantine and append-only audit
   records. Add read-only published views and least-privilege RLS.
3. **Importer preview:** build a server-only dry-run/import action with
   transaction boundaries, reviewer authorization, conflict quarantine and
   rollback-by-retirement. Do not use browser service-role credentials.
4. **2024 review:** run the staged v2 file through preview, resolve every
   institution/branch mapping and confirm the 2024 historical scope. Do not
   publish until reviewed.
5. **Read-only UI:** add catalogue search/provenance/status display with empty,
   stale and retired states. Keep historical guidance language explicit.
6. **Private selection link:** add the nullable catalogue reference/snapshot to
   family options, then test selection, refresh, sharing and cross-family RLS.
7. **Current-year policy:** only after a separately reviewed current source is
   available may a current-year status be introduced; never upgrade 2024 rows
   automatically.

## Required tests and acceptance criteria

Unit tests should cover v2 key recomputation, AU/SVU separation, different
institution codes, duplicate replay, changed-rank conflicts, stale labels and
missing values. Database tests should cover:

- published rows readable to authenticated users;
- draft/quarantined rows invisible to ordinary users;
- reviewer-only import and approval;
- no direct writes by authenticated users;
- same source key idempotency;
- changed business-key rank quarantine;
- institution-code/branch alias uniqueness;
- catalogue reads never exposing family/student rows;
- selected private options following existing family and sharing RLS;
- rollback retiring a batch without deleting audit history.

The 2024 batch is acceptable for catalogue publication only when every numeric
row has a reviewed institution/branch mapping, the source hash and URL are
recorded, conflicts are dispositioned, the preview counts reconcile to 25,505
rows, and the published UI keeps the historical guidance warning. This would
still not make the data current or an admission guarantee.

## Unresolved questions and risks

1. Which authoritative identifier should be the long-term national/AP college
   identity when APSCHE, APHERMC and institutions use different namespaces?
2. Does `A_REG` have a stable meaning across future counselling sources, and
   what other admission dimensions must be captured (local area, gender,
   reservation or special rounds)?
3. What reviewer role and operational approval process is acceptable for
   Supabase Cloud without introducing an unsafe service-role path?
4. Should branch aliases be curated centrally or source-versioned for every
   academic year?
5. How should revised official files be displayed when two historical sources
   disagree but neither can be discarded?
6. Which current-year fee and hostel sources can be reviewed independently?
7. How long should retired data remain queryable, and what retention policy
   applies to raw source artifacts and audit records?

Until these questions are answered and the catalogue migration/import review is
complete, the project remains **not production-ready for data-backed AP college
recommendations**. The v2 file is a validated staging artifact, not a live
catalogue.
