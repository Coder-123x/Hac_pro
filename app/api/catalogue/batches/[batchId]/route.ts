import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ACTIONS = new Set(["approve", "publish", "retire"]);

export async function POST(request: Request, context: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(batchId)) return NextResponse.json({ error: "Invalid batch identifier." }, { status: 400 });
  let body: { action?: unknown };
  try { body = await request.json() as { action?: unknown }; } catch { return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 }); }
  const action = typeof body.action === "string" ? body.action : "";
  if (!ACTIONS.has(action)) return NextResponse.json({ error: "Unsupported batch action." }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { data, error } = await supabase.rpc("education_catalogue_batch_action", { p_batch_id: batchId, p_action: action });
  if (error) {
    const status = error.code === "42501" ? 403 : error.code === "P0002" ? 404 : 409;
    return NextResponse.json({ error: status === 403 ? "Reviewer authorization required." : "Batch action could not be completed." }, { status });
  }
  return NextResponse.json({ result: data });
}
