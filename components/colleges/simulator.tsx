"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/supabase/messages";
import { Button } from "@/components/ui/button";
import { calculateCollegeAffordability, compareRankToCutoff } from "@/lib/college-simulator";
import { formatPaise, parseRupeesToPaise, type Paise } from "@/lib/affordability";

type Props = { familyId: string; role: "parent" | "student" };
type Comparison = { id: string; family_id: string; student_id: string; title: string; eapcet_rank: number; preferred_branches: string[] };
type Option = {
  id: string; comparison_id: string; college_name: string; branch_name: string; cutoff_rank: number | null;
  cutoff_year: number | null; cutoff_category: string | null; counselling_round: string | null; source_url: string | null;
  last_verified_at: string | null; data_status: "official_verified" | "historical" | "estimate" | "unverified" | "missing";
  annual_tuition_paise: string | number | null; annual_hostel_living_paise: string | number | null;
};
type Budget = { monthly_family_contribution_paise: string | number; annual_family_contribution_paise: string | number; confirmed_available_funds_paise: string | number; plan_duration_years: number };

const emptyOption = { college: "", branch: "", cutoff: "", year: "", category: "", round: "", source: "", verified: "", status: "missing", tuition: "", living: "" };
const statusLabels = { official_verified: "Official verified", historical: "Historical guidance", estimate: "Estimate", unverified: "Unverified", missing: "Missing data" } as const;
function bigintValue(value: string | number | null): bigint | null { return value === null ? null : BigInt(String(value)); }

export function CollegeSimulator({ familyId, role }: Props) {
  const [userId, setUserId] = useState<string | null>(null);
  const [comparisons, setComparisons] = useState<Comparison[]>([]);
  const [options, setOptions] = useState<Option[]>([]);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rank, setRank] = useState("");
  const [branches, setBranches] = useState("");
  const [title, setTitle] = useState("AP EAPCET college comparison");
  const [form, setForm] = useState(emptyOption);

  async function load() {
    setLoading(true); setMessage(null);
    const supabase = createClient();
    const [{ data: authData }, { data: comparisonData, error: comparisonError }, { data: optionData, error: optionError }, { data: budgetData }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from("college_comparisons").select("id, family_id, student_id, title, eapcet_rank, preferred_branches").eq("family_id", familyId).order("created_at", { ascending: false }),
      supabase.from("college_comparison_options").select("id, comparison_id, college_name, branch_name, cutoff_rank, cutoff_year, cutoff_category, counselling_round, source_url, last_verified_at, data_status, annual_tuition_paise, annual_hostel_living_paise").eq("family_id", familyId).order("created_at"),
      supabase.from("family_budgets").select("monthly_family_contribution_paise, annual_family_contribution_paise, confirmed_available_funds_paise, plan_duration_years").eq("family_id", familyId).maybeSingle(),
    ]);
    setUserId(authData.user?.id ?? null);
    if (comparisonError || optionError) setMessage("We could not load comparison data. Check that the Phase 5 migration is applied.");
    setComparisons((comparisonData ?? []) as Comparison[]); setOptions((optionData ?? []) as Option[]); setBudget((budgetData ?? null) as Budget | null); setLoading(false);
  }
  useEffect(() => { void load(); }, [familyId]);

  async function saveComparison() {
    const parsedRank = Number(rank);
    const preferred = branches.split(",").map((item) => item.trim()).filter(Boolean);
    if (!userId) return setMessage("Your session expired. Please sign in again.");
    if (!Number.isInteger(parsedRank) || parsedRank < 1) return setMessage("Enter a positive AP EAPCET rank.");
    if (!preferred.length) return setMessage("Enter at least one preferred branch.");
    setBusy(true); setMessage(null);
    const { error } = await createClient().from("college_comparisons").insert({ family_id: familyId, student_id: userId, created_by: userId, title: title.trim() || "AP EAPCET college comparison", eapcet_rank: parsedRank, preferred_branches: preferred });
    if (error) setMessage(friendlyError(error)); else { setRank(""); setBranches(""); await load(); }
    setBusy(false);
  }

  async function saveOption() {
    const comparison = comparisons.find((item) => item.student_id === userId) ?? comparisons[0];
    if (!comparison || !userId) return setMessage("Create a comparison first.");
    if (!form.college.trim() || !form.branch.trim()) return setMessage("Enter a college and branch name.");
    const cutoff = form.cutoff ? Number(form.cutoff) : null;
    const year = form.year ? Number(form.year) : null;
    if (cutoff !== null && (!Number.isInteger(cutoff) || cutoff < 1)) return setMessage("Cutoff rank must be a positive integer.");
    if (year !== null && (!Number.isInteger(year) || year < 2000 || year > 2100)) return setMessage("Enter a valid cutoff year.");
    let tuition: Paise | null = null; let living: Paise | null = null;
    try { tuition = form.tuition ? parseRupeesToPaise(form.tuition) : null; living = form.living ? parseRupeesToPaise(form.living) : null; } catch (error) { return setMessage(error instanceof Error ? error.message : "Enter valid rupee amounts."); }
    if (form.status === "official_verified" && (!form.source || !form.year || !form.verified || cutoff === null)) return setMessage("Official data requires cutoff, year, source URL and last-verified date.");
    setBusy(true); setMessage(null);
    const { error } = await createClient().from("college_comparison_options").insert({ comparison_id: comparison.id, family_id: familyId, college_name: form.college.trim(), branch_name: form.branch.trim(), cutoff_rank: cutoff, cutoff_year: year, cutoff_category: form.category.trim() || null, counselling_round: form.round.trim() || null, source_url: form.source.trim() || null, last_verified_at: form.verified || null, data_status: form.status, annual_tuition_paise: tuition?.toString() ?? null, annual_hostel_living_paise: living?.toString() ?? null, created_by: userId });
    if (error) setMessage(friendlyError(error)); else { setForm(emptyOption); await load(); }
    setBusy(false);
  }

  const primary = comparisons.find((item) => item.student_id === userId) ?? comparisons[0];
  const funding = budget ? { monthlyContributionPaise: bigintValue(budget.monthly_family_contribution_paise) ?? 0n, annualContributionPaise: bigintValue(budget.annual_family_contribution_paise) ?? 0n, confirmedFundsPaise: bigintValue(budget.confirmed_available_funds_paise) ?? 0n } : null;
  const visibleOptions = useMemo(() => options.filter((option) => !primary || option.comparison_id === primary.id), [options, primary]);

  if (loading) return <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600" aria-busy="true">Loading AP EAPCET comparisons…</section>;
  return <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
    <div><p className="text-sm font-medium text-slate-600">Phase 5</p><h3 className="text-xl font-semibold text-slate-950">AP EAPCET college and branch affordability</h3><p className="mt-1 text-sm text-slate-600">Manual comparison workspace. Cutoffs are guidance, not admission guarantees.</p></div>
    {message && <p className="mt-4 rounded-md bg-rose-50 p-3 text-sm text-rose-800" role="alert">{message}</p>}
    {role === "student" && <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4"><h4 className="font-medium text-slate-900">Your rank and preferences</h4><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">AP EAPCET rank<input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" inputMode="numeric" value={rank} onChange={(event) => setRank(event.target.value)} placeholder="Positive rank" /></label><label className="text-sm font-medium">Comparison name<input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" value={title} onChange={(event) => setTitle(event.target.value)} /></label><label className="text-sm font-medium sm:col-span-2">Preferred branches<input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" value={branches} onChange={(event) => setBranches(event.target.value)} placeholder="CSE, ECE, Mechanical" /></label></div><Button className="mt-3" type="button" disabled={busy} onClick={() => void saveComparison()}>Save rank and preferences</Button></div>}
    {!primary ? <p className="mt-4 rounded-md bg-slate-50 p-4 text-sm text-slate-600">No comparison has been saved yet. A student can create one above.</p> : <>
      <div className="mt-5 rounded-lg border border-slate-200 p-4"><h4 className="font-medium text-slate-900">{primary.title}</h4><p className="mt-1 text-sm text-slate-700">Rank: <strong>{primary.eapcet_rank.toLocaleString("en-IN")}</strong> · Preferred branches: {primary.preferred_branches.join(", ")}</p><p className="mt-2 text-xs text-slate-500">Only student-owned comparisons or comparisons explicitly shared through the student profile are visible.</p></div>
      {role === "student" && <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4"><h4 className="font-medium text-slate-900">Add a college/branch option</h4><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">College<input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" value={form.college} onChange={(e) => setForm({ ...form, college: e.target.value })} /></label><label className="text-sm font-medium">Branch<input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })} /></label><label className="text-sm font-medium">Cutoff rank (optional)<input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" inputMode="numeric" value={form.cutoff} onChange={(e) => setForm({ ...form, cutoff: e.target.value })} /></label><label className="text-sm font-medium">Data status<select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as typeof form.status })}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="text-sm font-medium">Cutoff year<input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" inputMode="numeric" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} /></label><label className="text-sm font-medium">Counselling round<input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" value={form.round} onChange={(e) => setForm({ ...form, round: e.target.value })} /></label><label className="text-sm font-medium">Category<input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></label><label className="text-sm font-medium">Source URL<input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" type="url" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="https://…" /></label><label className="text-sm font-medium">Last verified<input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" type="date" value={form.verified} onChange={(e) => setForm({ ...form, verified: e.target.value })} /></label><label className="text-sm font-medium">Annual tuition (₹)<input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" inputMode="decimal" value={form.tuition} onChange={(e) => setForm({ ...form, tuition: e.target.value })} /></label><label className="text-sm font-medium">Annual hostel/living (₹)<input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" inputMode="decimal" value={form.living} onChange={(e) => setForm({ ...form, living: e.target.value })} /></label></div><p className="mt-3 text-xs text-slate-500">Blank costs remain unavailable and will not be treated as zero.</p><Button className="mt-3" type="button" disabled={busy} onClick={() => void saveOption()}>Save option</Button></div>}
      <div className="mt-5 space-y-3">{visibleOptions.length === 0 ? <p className="rounded-md bg-slate-50 p-4 text-sm text-slate-600">No college options yet. Add manual records with their source and verification context.</p> : visibleOptions.map((option) => { const rankStatus = compareRankToCutoff(primary.eapcet_rank, option.cutoff_rank); const result = funding ? calculateCollegeAffordability({ annualTuitionPaise: bigintValue(option.annual_tuition_paise), annualHostelLivingPaise: bigintValue(option.annual_hostel_living_paise) }, funding, budget?.plan_duration_years ?? 4) : null; return <article key={option.id} className="rounded-lg border border-slate-200 p-4"><div className="flex flex-wrap justify-between gap-2"><div><h4 className="font-medium text-slate-900">{option.college_name} · {option.branch_name}</h4><p className="text-sm text-slate-700">Rank guidance: {rankStatus === "missing_cutoff" ? "Cutoff unavailable" : rankStatus === "rank_meets_cutoff" ? "Rank is at or better than the recorded cutoff" : "Rank is above the recorded cutoff"}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">{statusLabels[option.data_status]}</span></div><p className="mt-2 text-xs text-slate-500">Cutoff: {option.cutoff_rank?.toLocaleString("en-IN") ?? "not available"}{option.cutoff_year ? ` · ${option.cutoff_year}` : ""}{option.cutoff_category ? ` · ${option.cutoff_category}` : ""}{option.counselling_round ? ` · ${option.counselling_round}` : ""}{option.source_url ? <> · <a className="underline" href={option.source_url} target="_blank" rel="noreferrer">source</a></> : " · no source URL"}{option.last_verified_at ? ` · verified ${option.last_verified_at}` : ""}</p>{result ? <div className="mt-3 grid gap-2 sm:grid-cols-5 text-sm"><Metric label="4-year cost" value={formatPaise(result.totalCostPaise)} /><Metric label="Confirmed funds" value={formatPaise(result.confirmedFundsPaise)} /><Metric label="Future contributions" value={formatPaise(result.projectedContributionsPaise)} /><Metric label="Funding gap" value={formatPaise(result.fundingGapPaise)} /><Metric label="Status" value={result.fundingGapPaise === 0n ? "Within plan" : "Gap remains"} /></div> : <p className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-900">Four-year affordability is unavailable until both annual tuition and hostel/living estimates are entered. Missing values are not treated as zero.</p>}</article>; })}</div>
    </>}
  </section>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-md bg-slate-50 p-2"><p className="text-xs text-slate-600">{label}</p><p className="mt-1 font-semibold text-slate-950">{value}</p></div>; }
