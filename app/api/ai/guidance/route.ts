import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fallbackGuidance, guidanceSystemPrompt, guidanceUserPrompt, parseGroqText, validateGuidanceRequest } from "@/lib/ai-guidance";

const requestsByUser = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 10;

function allowed(userId: string): boolean {
  const now = Date.now();
  const recent = (requestsByUser.get(userId) ?? []).filter((time) => now - time < WINDOW_MS);
  if (recent.length >= MAX_REQUESTS) { requestsByUser.set(userId, recent); return false; }
  recent.push(now); requestsByUser.set(userId, recent);
  return true;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  if (!allowed(user.id)) return NextResponse.json({ error: "Please wait before requesting another explanation." }, { status: 429 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const validation = validateGuidanceRequest(body);
  if (!validation.ok) return NextResponse.json({ error: validation.message }, { status: 400 });
  const input = validation.value;
  const fallback = fallbackGuidance(input);
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL;
  if (!apiKey || !model) return NextResponse.json({ text: fallback, source: "rule_based" });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, temperature: 0.2, max_tokens: 320, messages: [{ role: "system", content: guidanceSystemPrompt(input.language) }, { role: "user", content: guidanceUserPrompt(input) }] }),
      signal: controller.signal,
    });
    if (!response.ok) return NextResponse.json({ text: fallback, source: "rule_based" });
    const text = parseGroqText(await response.json());
    return NextResponse.json({ text: text ?? fallback, source: text ? "groq" : "rule_based" });
  } catch {
    return NextResponse.json({ text: fallback, source: "rule_based" });
  } finally {
    clearTimeout(timeout);
  }
}
