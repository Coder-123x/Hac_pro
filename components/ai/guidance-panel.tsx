"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { GuidanceKind, GuidanceLanguage } from "@/lib/ai-guidance";

const labels: Record<GuidanceKind, string> = { affordability: "Affordability", college_options: "College options", opportunity: "Opportunity checklist", roadmap: "Career roadmap" };

export function GuidancePanel() {
  const [kind, setKind] = useState<GuidanceKind>("affordability");
  const [language, setLanguage] = useState<GuidanceLanguage>("en");
  const [text, setText] = useState<string | null>(null);
  const [source, setSource] = useState<"groq" | "rule_based" | null>(null);
  const [busy, setBusy] = useState(false);

  async function explain() {
    setBusy(true);
    try {
      const response = await fetch("/api/ai/guidance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, language, facts: ["Use the verified records currently visible in the workspace.", "Keep confirmed funds, future contributions and unverified aid separate.", "If important source data is missing, identify it and suggest a verification step."] }) });
      const payload = await response.json() as { text?: string; source?: "groq" | "rule_based" };
      setText(payload.text ?? "Guidance is unavailable right now."); setSource(payload.source ?? "rule_based");
    } catch { setText(language === "te" ? "ప్రస్తుతం మార్గదర్శకం అందుబాటులో లేదు. నమోదు చేసిన ఆధారాలు మరియు తదుపరి పనులను సమీక్షించండి." : "Guidance is unavailable right now. Review the recorded evidence and next actions."); setSource("rule_based"); }
    setBusy(false);
  }

  return <section className="mt-6 rounded-xl border border-violet-200 bg-violet-50/70 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-medium text-violet-800">AI guidance</p><h3 className="mt-1 text-lg font-semibold text-slate-950">Understand the plan</h3><p className="mt-1 text-sm text-slate-700">Groq explains recorded facts only. It cannot verify eligibility, change calculations or promise outcomes.</p></div><div className="flex gap-2"><label className="sr-only" htmlFor="guidance-kind">Guidance topic</label><select id="guidance-kind" className="rounded border bg-white p-2 text-sm" value={kind} onChange={(event) => setKind(event.target.value as GuidanceKind)}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><label className="sr-only" htmlFor="guidance-language">Guidance language</label><select id="guidance-language" className="rounded border bg-white p-2 text-sm" value={language} onChange={(event) => setLanguage(event.target.value as GuidanceLanguage)}><option value="en">English</option><option value="te">తెలుగు</option></select></div></div><Button className="mt-3" type="button" disabled={busy} onClick={() => void explain()}>{busy ? "Preparing…" : "Explain this"}</Button>{text && <div className="mt-3 rounded-lg border border-violet-200 bg-white p-3 text-sm leading-6 text-slate-800" role="status"><p>{text}</p><p className="mt-2 text-xs text-slate-500">{source === "groq" ? "AI explanation based on supplied facts." : "Rule-based explanation; AI service was unavailable or not configured."}</p></div>}</section>;
}
