export type ProvenanceStatus = "official_verified" | "secondary_verified" | "historical" | "estimate" | "unverified" | "missing";
export type ProvenanceInput = { sourceUrl?: string | null; sourceType?: "official" | "secondary" | "user_provided" | null; verificationStatus: ProvenanceStatus; academicYear?: number | null; lastVerifiedAt?: string | null };
export type DataQualityIssue = { field: string; message: string };

export const CUTOFF_V1_COLUMNS = [
  "comparison_id", "college_name", "branch_name", "cutoff_rank", "cutoff_year",
  "cutoff_category", "counselling_round", "source_url", "last_verified_at",
  "data_status", "annual_tuition_paise", "annual_hostel_living_paise",
] as const;

export const CUTOFF_V2_COLUMNS = [
  ...CUTOFF_V1_COLUMNS, "institution_code", "branch_code", "admission_region",
  "source_row_number", "source_sno", "source_record_key",
] as const;

export type CutoffV2Record = {
  comparisonId: string;
  collegeName: string;
  branchName: string;
  cutoffRank: number;
  cutoffYear: number;
  cutoffCategory: string;
  counsellingRound: string | null;
  sourceUrl: string;
  lastVerifiedAt: string;
  dataStatus: "historical";
  annualTuitionPaise: bigint | null;
  annualHostelLivingPaise: bigint | null;
  institutionCode: string;
  branchCode: string;
  admissionRegion: string;
  sourceRowNumber: number;
  sourceSno: number;
  sourceRecordKey: string;
};

export type ParsedCutoffImport = {
  version: 1 | 2;
  rows: Array<Record<string, string>> | CutoffV2Record[];
  issues: DataQualityIssue[];
};

function validHttpUrl(value: string | null | undefined): boolean {
  try { const url = new URL(value ?? ""); return url.protocol === "https:" || url.protocol === "http:"; } catch { return false; }
}

export function validateProvenance(input: ProvenanceInput): DataQualityIssue[] {
  const issues: DataQualityIssue[] = [];
  if (input.academicYear !== null && input.academicYear !== undefined && (!Number.isInteger(input.academicYear) || input.academicYear < 2000 || input.academicYear > 2100)) issues.push({ field: "academicYear", message: "Academic year must be between 2000 and 2100." });
  if (input.lastVerifiedAt && !/^\d{4}-\d{2}-\d{2}$/.test(input.lastVerifiedAt)) issues.push({ field: "lastVerifiedAt", message: "Last-verified date must use YYYY-MM-DD." });
  if (input.sourceUrl && !validHttpUrl(input.sourceUrl)) issues.push({ field: "sourceUrl", message: "Source URL must be an HTTP(S) URL." });
  if (["official_verified", "secondary_verified"].includes(input.verificationStatus) && !input.sourceUrl) issues.push({ field: "sourceUrl", message: "A verified record requires a source URL." });
  if (input.verificationStatus === "official_verified" && (input.sourceType !== "official" || !input.lastVerifiedAt)) issues.push({ field: "verificationStatus", message: "Official verification requires an official source and last-verified date." });
  if (input.verificationStatus === "historical" && !input.academicYear) issues.push({ field: "academicYear", message: "Historical records require the cutoff or validity year." });
  return issues;
}

export function recordFreshness(lastVerifiedAt: string | null | undefined, today = new Date().toISOString().slice(0, 10)): "current" | "stale" | "unknown" {
  if (!lastVerifiedAt) return "unknown";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(lastVerifiedAt)) return "unknown";
  const verified = Date.parse(`${lastVerifiedAt}T00:00:00Z`);
  const reference = Date.parse(`${today}T00:00:00Z`);
  if (!Number.isFinite(verified) || !Number.isFinite(reference) || verified > reference) return "unknown";
  return reference - verified <= 366 * 86_400_000 ? "current" : "stale";
}

export function duplicateKey(parts: Array<string | number | null | undefined>): string {
  return parts.map((part) => String(part ?? "").trim().toLowerCase()).join("|");
}

export function duplicateKeys<T>(rows: T[], keyOf: (row: T) => string): Set<string> {
  const counts = new Map<string, number>();
  for (const row of rows) { const key = keyOf(row); counts.set(key, (counts.get(key) ?? 0) + 1); }
  return new Set([...counts].filter(([, count]) => count > 1).map(([key]) => key));
}

export function validateCollegeImport(row: { collegeName: string; branchName: string; cutoffRank?: number | null; cutoffYear?: number | null; sourceUrl?: string | null; lastVerifiedAt?: string | null; dataStatus: ProvenanceStatus; annualTuitionPaise?: bigint | null; annualHostelLivingPaise?: bigint | null }): DataQualityIssue[] {
  const issues = validateProvenance({ sourceUrl: row.sourceUrl, verificationStatus: row.dataStatus, academicYear: row.cutoffYear, lastVerifiedAt: row.lastVerifiedAt, sourceType: row.dataStatus === "official_verified" ? "official" : undefined });
  if (!row.collegeName.trim()) issues.push({ field: "collegeName", message: "College name is required." });
  if (!row.branchName.trim()) issues.push({ field: "branchName", message: "Branch name is required." });
  if (["official_verified", "historical"].includes(row.dataStatus) && (!Number.isInteger(row.cutoffRank) || (row.cutoffRank ?? 0) < 1)) issues.push({ field: "cutoffRank", message: "Verified or historical cutoff records require a positive cutoff rank." });
  if (row.annualTuitionPaise !== null && row.annualTuitionPaise !== undefined && row.annualTuitionPaise < 0n) issues.push({ field: "annualTuitionPaise", message: "Tuition cannot be negative." });
  if (row.annualHostelLivingPaise !== null && row.annualHostelLivingPaise !== undefined && row.annualHostelLivingPaise < 0n) issues.push({ field: "annualHostelLivingPaise", message: "Hostel/living cost cannot be negative." });
  return issues;
}

const sourceIdentityPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/;
const sourceRecordKeyPattern = /^[a-f0-9]{64}$/;

export function validateCutoffV2Row(row: Partial<CutoffV2Record>): DataQualityIssue[] {
  const issues: DataQualityIssue[] = [];
  const base = validateCollegeImport({
    collegeName: row.collegeName ?? "", branchName: row.branchName ?? "", cutoffRank: row.cutoffRank,
    cutoffYear: row.cutoffYear, sourceUrl: row.sourceUrl, lastVerifiedAt: row.lastVerifiedAt,
    dataStatus: row.dataStatus ?? "historical", annualTuitionPaise: row.annualTuitionPaise,
    annualHostelLivingPaise: row.annualHostelLivingPaise,
  });
  issues.push(...base);
  if (row.dataStatus !== "historical") issues.push({ field: "dataStatus", message: "AP EAPCET v2 source rows must remain historical." });
  for (const [field, value] of [["institutionCode", row.institutionCode], ["branchCode", row.branchCode], ["admissionRegion", row.admissionRegion]] as const) {
    if (typeof value !== "string" || !sourceIdentityPattern.test(value.trim())) issues.push({ field, message: `${field} must be a non-empty source identifier.` });
  }
  if (!Number.isInteger(row.sourceRowNumber) || (row.sourceRowNumber ?? 0) < 1) issues.push({ field: "sourceRowNumber", message: "Source row number must be a positive integer." });
  if (!Number.isInteger(row.sourceSno) || (row.sourceSno ?? 0) < 1) issues.push({ field: "sourceSno", message: "Source SNO must be a positive integer." });
  if (typeof row.cutoffCategory !== "string" || !row.cutoffCategory.trim()) issues.push({ field: "cutoffCategory", message: "A numeric cutoff requires its source category." });
  if (typeof row.sourceRecordKey !== "string" || !sourceRecordKeyPattern.test(row.sourceRecordKey.trim())) issues.push({ field: "sourceRecordKey", message: "Source record key must be a lowercase SHA-256 hex value." });
  if (!row.sourceUrl || !validHttpUrl(row.sourceUrl)) issues.push({ field: "sourceUrl", message: "A v2 cutoff row requires an HTTP(S) source URL." });
  if (!row.lastVerifiedAt || !/^\d{4}-\d{2}-\d{2}$/.test(row.lastVerifiedAt)) issues.push({ field: "lastVerifiedAt", message: "A v2 cutoff row requires a YYYY-MM-DD review date." });
  return issues;
}

function parseCsvLine(line: string): string[] {
  const values: string[] = []; let value = ""; let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') { value += '"'; index += 1; } else quoted = !quoted;
    } else if (character === "," && !quoted) { values.push(value); value = ""; } else value += character;
  }
  if (quoted) throw new Error("CSV row has an unterminated quoted field.");
  values.push(value); return values;
}

function parseNullableInteger(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value); return Number.isInteger(parsed) ? parsed : Number.NaN;
}

function parseNullableBigInt(value: string): bigint | null {
  if (!value.trim()) return null;
  try { return BigInt(value); } catch { return null; }
}

/** Parses either the unchanged v1 contract or the additive v2 contract. */
export function parseCutoffImportCsv(csv: string): ParsedCutoffImport {
  const lines = csv.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.length > 0);
  if (!lines.length) return { version: 1, rows: [], issues: [{ field: "header", message: "CSV must contain a header." }] };
  let header: string[];
  try { header = parseCsvLine(lines[0]); } catch (error) { return { version: 1, rows: [], issues: [{ field: "header", message: error instanceof Error ? error.message : "Invalid CSV header." }] }; }
  const version = header.join(",") === CUTOFF_V2_COLUMNS.join(",") ? 2 : header.join(",") === CUTOFF_V1_COLUMNS.join(",") ? 1 : null;
  if (!version) return { version: 1, rows: [], issues: [{ field: "header", message: "Header must match the documented v1 or v2 cutoff contract exactly." }] };
  const issues: DataQualityIssue[] = [];
  if (version === 1) {
    const rows: Array<Record<string, string>> = [];
    lines.slice(1).forEach((line, offset) => {
      let values: string[];
      try { values = parseCsvLine(line); } catch (error) { issues.push({ field: `row.${offset + 2}`, message: error instanceof Error ? error.message : "Invalid CSV row." }); return; }
      if (values.length !== header.length) { issues.push({ field: `row.${offset + 2}`, message: "CSV row has the wrong number of columns." }); return; }
      rows.push(Object.fromEntries(header.map((column, index) => [column, values[index]])));
    });
    return { version, rows, issues };
  }
  const rows: CutoffV2Record[] = [];
  lines.slice(1).forEach((line, offset) => {
    let values: string[];
    try { values = parseCsvLine(line); } catch (error) { issues.push({ field: `row.${offset + 2}`, message: error instanceof Error ? error.message : "Invalid CSV row." }); return; }
    if (values.length !== header.length) { issues.push({ field: `row.${offset + 2}`, message: "CSV row has the wrong number of columns." }); return; }
    const raw = Object.fromEntries(header.map((column, index) => [column, values[index]]));
    for (const field of ["annual_tuition_paise", "annual_hostel_living_paise"] as const) {
      if (raw[field].trim() && !/^-?\d+$/.test(raw[field].trim())) issues.push({ field: `row.${offset + 2}.${field}`, message: "Money values must be integer paise." });
    }
    const row: CutoffV2Record = {
      comparisonId: raw.comparison_id, collegeName: raw.college_name, branchName: raw.branch_name,
      cutoffRank: parseNullableInteger(raw.cutoff_rank) as number, cutoffYear: parseNullableInteger(raw.cutoff_year) as number,
      cutoffCategory: raw.cutoff_category, counsellingRound: raw.counselling_round || null, sourceUrl: raw.source_url,
      lastVerifiedAt: raw.last_verified_at, dataStatus: raw.data_status as "historical",
      annualTuitionPaise: parseNullableBigInt(raw.annual_tuition_paise), annualHostelLivingPaise: parseNullableBigInt(raw.annual_hostel_living_paise),
      institutionCode: raw.institution_code, branchCode: raw.branch_code, admissionRegion: raw.admission_region,
      sourceRowNumber: parseNullableInteger(raw.source_row_number) as number, sourceSno: parseNullableInteger(raw.source_sno) as number,
      sourceRecordKey: raw.source_record_key,
    };
    issues.push(...validateCutoffV2Row(row).map((issue) => ({ ...issue, field: `row.${offset + 2}.${issue.field}` })));
    rows.push(row);
  });
  return { version, rows, issues };
}

export async function createCutoffSourceRecordKey(sourceFileSha256: string, sourceRowNumber: number, cutoffCategory: string): Promise<string> {
  if (!/^[a-f0-9]{64}$/i.test(sourceFileSha256) || !Number.isInteger(sourceRowNumber) || sourceRowNumber < 1 || !cutoffCategory.trim()) throw new Error("Invalid source identity inputs.");
  const payload = `${sourceFileSha256.toLowerCase()}|${sourceRowNumber}|${cutoffCategory.trim().toLowerCase()}`;
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export type CutoffImportPlan = { toInsert: CutoffV2Record[]; idempotent: CutoffV2Record[]; conflicts: Array<{ row: CutoffV2Record; reason: string }>; rejected: Array<{ row: CutoffV2Record; issues: DataQualityIssue[] }> };

function sameCutoffRecord(left: CutoffV2Record, right: CutoffV2Record): boolean {
  return left.sourceRecordKey === right.sourceRecordKey && left.cutoffRank === right.cutoffRank && left.institutionCode === right.institutionCode && left.branchCode === right.branchCode && left.admissionRegion === right.admissionRegion && left.cutoffCategory === right.cutoffCategory && left.cutoffYear === right.cutoffYear;
}

function cutoffBusinessKey(row: CutoffV2Record): string {
  return duplicateKey([row.institutionCode, row.branchCode, row.admissionRegion, row.cutoffYear, row.cutoffCategory, row.counsellingRound]);
}

/** Plans a safe, non-destructive import. Conflicts are quarantined, never overwritten. */
export function planCutoffImport(existing: CutoffV2Record[], incoming: CutoffV2Record[]): CutoffImportPlan {
  const plan: CutoffImportPlan = { toInsert: [], idempotent: [], conflicts: [], rejected: [] };
  const bySourceKey = new Map(existing.map((row) => [row.sourceRecordKey, row]));
  const byBusinessKey = new Map(existing.map((row) => [cutoffBusinessKey(row), row]));
  const incomingBySourceKey = new Map<string, CutoffV2Record>();
  const incomingByBusinessKey = new Map<string, CutoffV2Record>();
  for (const row of incoming) {
    const issues = validateCutoffV2Row(row);
    if (issues.length) { plan.rejected.push({ row, issues }); continue; }
    const existingSource = bySourceKey.get(row.sourceRecordKey);
    if (existingSource) {
      if (sameCutoffRecord(existingSource, row)) plan.idempotent.push(row);
      else plan.conflicts.push({ row, reason: "source_record_key already exists with different source values" });
      continue;
    }
    const existingBusiness = byBusinessKey.get(cutoffBusinessKey(row));
    if (existingBusiness) { plan.conflicts.push({ row, reason: "business key already exists with a different source record or cutoff" }); continue; }
    const duplicateSource = incomingBySourceKey.get(row.sourceRecordKey);
    const duplicateBusiness = incomingByBusinessKey.get(cutoffBusinessKey(row));
    const duplicateIncoming = duplicateSource ?? duplicateBusiness;
    if (duplicateIncoming) {
      if (duplicateSource && sameCutoffRecord(duplicateSource, row)) plan.idempotent.push(row);
      else plan.conflicts.push({ row, reason: "incoming batch contains a duplicate source or business key" });
      continue;
    }
    plan.toInsert.push(row); bySourceKey.set(row.sourceRecordKey, row); byBusinessKey.set(cutoffBusinessKey(row), row);
    incomingBySourceKey.set(row.sourceRecordKey, row); incomingByBusinessKey.set(cutoffBusinessKey(row), row);
  }
  return plan;
}

export function validateScholarshipImport(row: { name: string; provider: string; sourceUrl?: string | null; sourceType?: "official" | "secondary" | "user_provided" | null; verificationStatus: ProvenanceStatus; academicYear?: number | null; lastVerifiedAt?: string | null; awardMinPaise?: bigint | null; awardMaxPaise?: bigint | null }): DataQualityIssue[] {
  const issues = validateProvenance({ sourceUrl: row.sourceUrl, sourceType: row.sourceType, verificationStatus: row.verificationStatus, academicYear: row.academicYear, lastVerifiedAt: row.lastVerifiedAt });
  if (!row.name.trim()) issues.push({ field: "name", message: "Scholarship name is required." });
  if (!row.provider.trim()) issues.push({ field: "provider", message: "Provider is required." });
  if (row.awardMinPaise !== null && row.awardMinPaise !== undefined && row.awardMinPaise < 0n) issues.push({ field: "awardMinPaise", message: "Minimum award cannot be negative." });
  if (row.awardMaxPaise !== null && row.awardMaxPaise !== undefined && row.awardMaxPaise < 0n) issues.push({ field: "awardMaxPaise", message: "Maximum award cannot be negative." });
  if (row.awardMinPaise !== null && row.awardMaxPaise !== null && row.awardMinPaise !== undefined && row.awardMaxPaise !== undefined && row.awardMaxPaise < row.awardMinPaise) issues.push({ field: "awardMaxPaise", message: "Maximum award cannot be below minimum award." });
  return issues;
}
