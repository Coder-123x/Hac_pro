import { NextResponse } from "next/server";
import { createCutoffSourceRecordKey, parseCutoffImportCsv, type CutoffV2Record } from "@/lib/data-quality";
import { createClient } from "@/lib/supabase/server";

const MAX_CSV_BYTES = 5 * 1024 * 1024;
const SHA256 = /^[a-f0-9]{64}$/;

type PreviewRequest = {
  csv?: unknown;
  sourceSystem?: unknown;
  sourceTitle?: unknown;
  sourceUrl?: unknown;
  artifactSha256?: unknown;
  academicYear?: unknown;
  academicPeriod?: unknown;
  retrievalDate?: unknown;
  extractionMethod?: unknown;
};

function text(value: unknown, max: number): string | null {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max ? value.trim() : null;
}

export async function POST(request: Request) {
  let body: PreviewRequest;
  try {
    body = await request.json() as PreviewRequest;
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const csv = typeof body.csv === "string" ? body.csv : "";
  if (!csv || new TextEncoder().encode(csv).byteLength > MAX_CSV_BYTES) {
    return NextResponse.json({ error: "A non-empty CSV up to 5 MB is required." }, { status: 400 });
  }
  const sourceSystem = text(body.sourceSystem, 80);
  const sourceTitle = text(body.sourceTitle, 240);
  const sourceUrl = text(body.sourceUrl, 2048);
  const artifactSha256 = text(body.artifactSha256, 64);
  const academicPeriod = text(body.academicPeriod, 160);
  const extractionMethod = text(body.extractionMethod, 4000);
  const retrievalDate = text(body.retrievalDate, 10);
  const academicYear = typeof body.academicYear === "number" && Number.isInteger(body.academicYear) ? body.academicYear : null;
  if (!sourceSystem || !sourceTitle || !sourceUrl?.startsWith("https://") || !artifactSha256 || !SHA256.test(artifactSha256) || !academicPeriod || !extractionMethod || !retrievalDate || !/^\d{4}-\d{2}-\d{2}$/.test(retrievalDate) || academicYear === null || academicYear < 2000 || academicYear > 2100) {
    return NextResponse.json({ error: "Valid source provenance metadata is required." }, { status: 400 });
  }

  const parsed = parseCutoffImportCsv(csv);
  if (parsed.version !== 2) {
    return NextResponse.json({ error: "Catalogue imports require the documented v2 cutoff CSV contract." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const parsedRows = parsed.rows as CutoffV2Record[];
  const deterministicRows: CutoffV2Record[] = [];
  const identityIssues = [] as Array<{ details: { field: string; message: string }; rowNumber: number | null }>;
  for (const row of parsedRows) {
    const expectedKey = await createCutoffSourceRecordKey(artifactSha256, row.sourceRowNumber, row.cutoffCategory);
    if (expectedKey !== row.sourceRecordKey) {
      identityIssues.push({
        rowNumber: row.sourceRowNumber,
        details: { field: "sourceRecordKey", message: "Source record key does not match the artifact, source row and category." },
      });
    } else {
      deterministicRows.push(row);
    }
  }
  const rejectedRows = parsed.issues.map((issue) => ({ details: issue, rowNumber: Number(issue.field.match(/row\.(\d+)/)?.[1] ?? 0) || null })).concat(identityIssues);
  const { data, error } = await supabase.rpc("education_preview_cutoff_import", {
    p_source_system: sourceSystem,
    p_source_title: sourceTitle,
    p_source_url: sourceUrl,
    p_artifact_sha256: artifactSha256,
    p_academic_year: academicYear,
    p_academic_period: academicPeriod,
    p_retrieval_date: retrievalDate,
    p_extraction_method: extractionMethod,
    p_source_row_count: Math.max(0, csv.split(/\r?\n/).filter(Boolean).length - 1),
    p_rows: deterministicRows,
    p_rejected_rows: rejectedRows,
  });
  if (error) {
    const status = error.code === "42501" ? 403 : error.code === "23505" ? 409 : 400;
    return NextResponse.json({ error: status === 403 ? "Reviewer authorization required." : "Import preview could not be created." }, { status });
  }
  return NextResponse.json({ preview: data }, { status: 201 });
}
