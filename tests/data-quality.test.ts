import { describe, expect, it } from "vitest";
import { CUTOFF_V1_COLUMNS, CUTOFF_V2_COLUMNS, createCutoffSourceRecordKey, duplicateKey, duplicateKeys, parseCutoffImportCsv, planCutoffImport, recordFreshness, validateCollegeImport, validateProvenance, validateScholarshipImport, type CutoffV2Record } from "../lib/data-quality";

describe("education data quality", () => {
  it("requires provenance for official and historical records", () => {
    expect(validateProvenance({ verificationStatus: "official_verified", sourceType: "official" }).map((issue) => issue.field)).toEqual(["sourceUrl", "verificationStatus"]);
    expect(validateProvenance({ verificationStatus: "historical", sourceUrl: "https://example.gov", sourceType: "official" }).some((issue) => issue.field === "academicYear")).toBe(true);
  });

  it("rejects invalid college values and preserves unknown costs", () => {
    const issues = validateCollegeImport({ collegeName: "", branchName: "CSE", cutoffRank: 0, cutoffYear: 2025, dataStatus: "official_verified", annualTuitionPaise: null, annualHostelLivingPaise: null });
    expect(issues.map((issue) => issue.field)).toEqual(expect.arrayContaining(["collegeName", "sourceUrl", "cutoffRank"]));
  });

  it("rejects contradictory scholarship awards and flags stale records", () => {
    expect(validateScholarshipImport({ name: "Scheme", provider: "Provider", verificationStatus: "unverified", awardMinPaise: 200n, awardMaxPaise: 100n })).toEqual(expect.arrayContaining([{ field: "awardMaxPaise", message: "Maximum award cannot be below minimum award." }]));
    expect(recordFreshness("2024-01-01", "2026-10-18")).toBe("stale");
    expect(recordFreshness(null, "2026-10-18")).toBe("unknown");
  });

  it("detects normalized duplicate import keys", () => {
    const rows = [{ name: " Scheme ", provider: "Provider", year: 2026 }, { name: "scheme", provider: "provider", year: 2026 }, { name: "Other", provider: "Provider", year: 2026 }];
    expect(duplicateKeys(rows, (row) => duplicateKey([row.name, row.provider, row.year]))).toEqual(new Set(["scheme|provider|2026"]));
  });

  it("keeps v1 parsing compatible and validates the additive v2 header", () => {
    const v1 = `${CUTOFF_V1_COLUMNS.join(",")}\n,College,CSE,100,2024,OC_BOYS,,https://example.gov,2026-10-18,historical,,`;
    expect(parseCutoffImportCsv(v1)).toMatchObject({ version: 1, issues: [], rows: [{ college_name: "College", cutoff_rank: "100" }] });
    const v2 = `${CUTOFF_V2_COLUMNS.join(",")}\n,College,CSE,100,2024,OC_BOYS,,https://example.gov,2026-10-18,historical,,,KIEK,AID,AU,76,74,${"a".repeat(64)}`;
    const parsed = parseCutoffImportCsv(v2);
    expect(parsed.version).toBe(2);
    expect(parsed.issues).toEqual([]);
    expect((parsed.rows[0] as CutoffV2Record).institutionCode).toBe("KIEK");
  });

  it("keeps AU/SVU rows and different institution codes as separate valid records", () => {
    const base = (overrides: Partial<CutoffV2Record>): CutoffV2Record => ({
      comparisonId: "", collegeName: "University", branchName: "AI", cutoffRank: 146120, cutoffYear: 2024,
      cutoffCategory: "SC_BOYS", counsellingRound: null, sourceUrl: "https://apsche.ap.gov.in/source.xls", lastVerifiedAt: "2026-10-18", dataStatus: "historical",
      annualTuitionPaise: null, annualHostelLivingPaise: null, institutionCode: "BESTPU", branchCode: "AI", admissionRegion: "AU", sourceRowNumber: 1385, sourceSno: 1383, sourceRecordKey: "a".repeat(64), ...overrides,
    });
    const rows = [base({}), base({ admissionRegion: "SVU", sourceRowNumber: 1386, sourceSno: 1384, sourceRecordKey: "b".repeat(64) }), base({ institutionCode: "KIEK", sourceRowNumber: 76, sourceSno: 74, sourceRecordKey: "c".repeat(64) })];
    const plan = planCutoffImport([], rows);
    expect(plan.toInsert).toHaveLength(3);
    expect(plan.conflicts).toHaveLength(0);
  });

  it("quarantines conflicting ranks instead of overwriting an existing business key", () => {
    const row = { collegeName: "University", branchName: "AI", cutoffRank: 100, cutoffYear: 2024, cutoffCategory: "OC_BOYS", counsellingRound: null, sourceUrl: "https://example.gov/source.xls", lastVerifiedAt: "2026-10-18", dataStatus: "historical" as const, annualTuitionPaise: null, annualHostelLivingPaise: null, institutionCode: "CODE1", branchCode: "AI", admissionRegion: "AU", sourceRowNumber: 1, sourceSno: 1, sourceRecordKey: "d".repeat(64), comparisonId: "" } satisfies CutoffV2Record;
    const changed = { ...row, cutoffRank: 101, sourceRowNumber: 2, sourceSno: 2, sourceRecordKey: "e".repeat(64) };
    const plan = planCutoffImport([row], [changed]);
    expect(plan.toInsert).toHaveLength(0);
    expect(plan.conflicts[0]?.reason).toContain("business key");
  });

  it("makes exact source-record replays idempotent and rejects malformed or incomplete v2 rows", () => {
    const row = { collegeName: "University", branchName: "AI", cutoffRank: 100, cutoffYear: 2024, cutoffCategory: "OC_BOYS", counsellingRound: null, sourceUrl: "https://example.gov/source.xls", lastVerifiedAt: "2026-10-18", dataStatus: "historical" as const, annualTuitionPaise: null, annualHostelLivingPaise: null, institutionCode: "CODE1", branchCode: "AI", admissionRegion: "AU", sourceRowNumber: 1, sourceSno: 1, sourceRecordKey: "f".repeat(64), comparisonId: "" } satisfies CutoffV2Record;
    expect(planCutoffImport([], [row]).toInsert).toHaveLength(1);
    expect(planCutoffImport([row], [row]).idempotent).toHaveLength(1);
    const bad = { ...row, institutionCode: "", sourceRowNumber: 0, sourceRecordKey: "not-a-key" };
    expect(planCutoffImport([], [bad]).rejected[0]?.issues.map((issue) => issue.field)).toEqual(expect.arrayContaining(["institutionCode", "sourceRowNumber", "sourceRecordKey"]));
  });

  it("creates a stable source-record identity from the source artifact and cell", async () => {
    const hash = "4b216e35375320f0c97a640e67ec6e568e149420e5adb8bf4729e4b07cd363a8";
    const first = await createCutoffSourceRecordKey(hash, 1385, "SC_BOYS");
    expect(first).toHaveLength(64);
    expect(first).toBe(await createCutoffSourceRecordKey(hash, 1385, "SC_BOYS"));
    expect(first).not.toBe(await createCutoffSourceRecordKey(hash, 1386, "SC_BOYS"));
  });
});
