"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/supabase/messages";
import { Button } from "@/components/ui/button";
import { buildDecisionActions, calculateDecisionAffordability, recommendCollegePathways, type DecisionAction, type PathwayOption } from "@/lib/decision-support";
import { confirmedScholarshipFunding, type ScholarshipApplication } from "@/lib/scholarships";
import { formatPaise, hasCostEstimates, type ExpenseEstimate } from "@/lib/affordability";
import { buildUnifiedActionPlan, type ActionPlanItem } from "@/lib/action-plan";
import { useLanguage } from "@/components/i18n/language-provider";

type Props = { familyId: string; userId: string; role: "parent" | "student" };
type Profile = { education_stage: string; career_goals: string; preferred_branches: string[]; entrance_exam: string | null; entrance_rank: number | null };
type Budget = { plan_duration_years: number; monthly_family_contribution_paise: string | number; annual_family_contribution_paise: string | number; confirmed_available_funds_paise: string | number };
type Expense = { category: string; amount_paise: string | number; plan_year: number; annual_increase_bps: number };
type Milestone = { status: "not_started" | "in_progress" | "completed" | "blocked" };
type Comparison = { eapcet_rank: number; preferred_branches: string[] };
type ScholarshipDeadline = { id: string; name: string; deadline: string | null; status: ScholarshipApplication["status"] };
type OpportunityTask = { id: string; title: string; status: "todo" | "in_progress" | "completed" | "blocked"; dueDate: string | null; nextStep: string };
type RoadmapTask = { id: string; title: string; status: "not_started" | "in_progress" | "completed" | "blocked"; dueDate: string | null; nextStep: string };

function asBigInt(value: string | number): bigint { return BigInt(String(value)); }

function ProfileSetup({ familyId, userId, onSaved }: { familyId: string; userId: string; onSaved: () => void }) {
  const { t } = useLanguage();
  const [journey, setJourney] = useState<"aspirant" | "current_student">("aspirant");
  const [goal, setGoal] = useState("");
  const [branches, setBranches] = useState("");
  const [exam, setExam] = useState("");
  const [rank, setRank] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!goal.trim()) return setMessage("Enter a goal so the workspace can suggest the next planning step.");
    const parsedRank = rank ? Number(rank) : null;
    if (parsedRank !== null && (!Number.isInteger(parsedRank) || parsedRank < 1)) return setMessage("Enter a positive entrance rank or leave it blank.");
    if (parsedRank !== null && !exam.trim()) return setMessage("Add the entrance exam name when recording a rank.");
    setBusy(true); setMessage(null);
    const payload = { user_id: userId, family_id: familyId, education_stage: journey === "aspirant" ? "entrance_preparation" : "engineering_student", state_code: "AP", entrance_exam: exam.trim() || null, entrance_rank: parsedRank, preferred_branches: branches.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 20), career_goals: goal.trim() };
    const { error } = await createClient().from("student_profiles").upsert(payload, { onConflict: "user_id,family_id" });
    if (error) setMessage(friendlyError(error)); else onSaved();
    setBusy(false);
  }

  return <div className="mt-5 rounded-lg border border-indigo-200 bg-indigo-50 p-4"><h3 className="font-medium text-slate-950">{t("startDirection")}</h3><p className="mt-1 text-sm text-slate-700">{t("privateUnlessShared")}</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-sm">{t("journey")}<select aria-label={t("journey")} className="mt-1 w-full rounded border p-2" value={journey} onChange={(event) => setJourney(event.target.value as "aspirant" | "current_student")}><option value="aspirant">{t("aspirant")}</option><option value="current_student">{t("currentStudent")}</option></select></label><label className="text-sm">{t("careerEducationGoal")}<input aria-label={t("careerEducationGoal")} className="mt-1 w-full rounded border p-2" value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="e.g. software engineer" /></label><label className="text-sm">{t("preferredBranches")}<input aria-label={t("preferredBranches")} className="mt-1 w-full rounded border p-2" value={branches} onChange={(event) => setBranches(event.target.value)} placeholder="CSE, ECE" /></label><label className="text-sm">{t("entranceExam")}<input aria-label={t("entranceExam")} className="mt-1 w-full rounded border p-2" value={exam} onChange={(event) => setExam(event.target.value)} placeholder="e.g. AP EAPCET" /></label><label className="text-sm">{t("entranceRank")}<input aria-label={t("entranceRank")} className="mt-1 w-full rounded border p-2" type="number" min="1" value={rank} onChange={(event) => setRank(event.target.value)} /></label></div>{message && <p className="mt-3 text-sm text-rose-700" role="alert">{message}</p>}<Button className="mt-3" type="button" disabled={busy} onClick={() => void save()}>{busy ? t("loading") : t("saveDirection")}</Button></div>;
}

export function DecisionDashboard({ familyId, userId, role }: Props) {
  const { t } = useLanguage();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [comparisonCount, setComparisonCount] = useState(0);
  const [opportunityCount, setOpportunityCount] = useState(0);
  const [roadmapCount, setRoadmapCount] = useState(0);
  const [blockedMilestones, setBlockedMilestones] = useState(0);
  const [pathway, setPathway] = useState<{ primary: PathwayOption; alternative: PathwayOption | null } | null>(null);
  const [guidance, setGuidance] = useState<string | null>(null);
  const [guidanceSource, setGuidanceSource] = useState<"groq" | "rule_based" | null>(null);
  const [guidanceLanguage, setGuidanceLanguage] = useState<"en" | "te">("en");
  const [guidanceBusy, setGuidanceBusy] = useState(false);
  const [affordability, setAffordability] = useState<ReturnType<typeof calculateDecisionAffordability> | null>(null);
  const [actionPlan, setActionPlan] = useState<ActionPlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true); setMessage(null);
    const supabase = createClient();
    const [profileResult, budgetResult, expenseResult, comparisonResult, optionResult, scholarshipResult, roadmapResult, milestoneResult, opportunityTaskResult, roadmapTaskResult] = await Promise.all([
      supabase.from("student_profiles").select("education_stage, career_goals, preferred_branches, entrance_exam, entrance_rank").eq("family_id", familyId).eq("user_id", userId).maybeSingle(),
      supabase.from("family_budgets").select("plan_duration_years, monthly_family_contribution_paise, annual_family_contribution_paise, confirmed_available_funds_paise").eq("family_id", familyId).maybeSingle(),
      supabase.from("expenses").select("category, amount_paise, plan_year, annual_increase_bps").eq("family_id", familyId),
      supabase.from("college_comparisons").select("id", { count: "exact", head: true }).eq("family_id", familyId),
      supabase.from("college_comparison_options").select("id, college_name, branch_name, cutoff_rank, annual_tuition_paise, annual_hostel_living_paise, data_status").eq("family_id", familyId),
      supabase.from("scholarship_applications").select("id, scholarship_id, status, awarded_amount_paise, received_amount_paise, confirmed_funding, scholarship_records!inner(name, deadline, verification_status)").eq("family_id", familyId),
      supabase.from("roadmap_plans").select("id", { count: "exact", head: true }).eq("family_id", familyId),
      supabase.from("roadmap_milestones").select("id, title, status, due_date").eq("family_id", familyId),
      supabase.from("opportunity_tasks").select("id, title, status, due_date, next_step").eq("family_id", familyId).order("due_date", { ascending: true, nullsFirst: false }),
      supabase.from("roadmap_tasks").select("id, title, status, due_date, next_step").eq("family_id", familyId).order("due_date", { ascending: true, nullsFirst: false }),
    ]);
    if (profileResult.error && role === "student") setMessage("Your direction is unavailable until the family foundation migration is applied.");
    setProfile(profileResult.data as Profile | null);
    setBudget(budgetResult.data as Budget | null);
    setExpenses((expenseResult.data ?? []) as Expense[]);
    setComparisonCount(comparisonResult.count ?? 0);
    const { data: comparison } = await supabase.from("college_comparisons").select("eapcet_rank, preferred_branches").eq("family_id", familyId).limit(1).maybeSingle();
    const pathwayOptions = (optionResult.data ?? []).map((item: any) => ({ id: item.id, collegeName: item.college_name, branchName: item.branch_name, cutoffRank: item.cutoff_rank, annualTuitionPaise: item.annual_tuition_paise === null ? null : asBigInt(item.annual_tuition_paise), annualHostelLivingPaise: item.annual_hostel_living_paise === null ? null : asBigInt(item.annual_hostel_living_paise), dataStatus: item.data_status } satisfies PathwayOption));
    setPathway(comparison ? recommendCollegePathways(pathwayOptions, (comparison as Comparison).preferred_branches, (comparison as Comparison).eapcet_rank) : null);
    setOpportunityCount((scholarshipResult.data ?? []).length);
    setRoadmapCount(roadmapResult.count ?? 0);
    setBlockedMilestones(((milestoneResult.data ?? []) as Milestone[]).filter((item) => item.status === "blocked").length);
    const applications: ScholarshipApplication[] = (scholarshipResult.data ?? []).map((item: any) => ({ id: item.id, scholarshipId: item.scholarship_id, status: item.status, awardedAmountPaise: item.awarded_amount_paise === null ? null : asBigInt(item.awarded_amount_paise), receivedAmountPaise: item.received_amount_paise === null ? null : asBigInt(item.received_amount_paise), confirmedFunding: item.confirmed_funding, verificationStatus: item.scholarship_records?.verification_status }));
    let nextAffordability: ReturnType<typeof calculateDecisionAffordability> | null = null;
    if (budgetResult.data && !expenseResult.error) {
      const expenseEstimates = (expenseResult.data ?? []).map((item) => ({ category: item.category, annualPaise: asBigInt(item.amount_paise), planYear: item.plan_year, annualIncreaseBps: item.annual_increase_bps }));
      if (hasCostEstimates(expenseEstimates)) {
        try { nextAffordability = calculateDecisionAffordability({ budget: { durationYears: budgetResult.data.plan_duration_years, monthly: asBigInt(budgetResult.data.monthly_family_contribution_paise), annual: asBigInt(budgetResult.data.annual_family_contribution_paise), confirmed: asBigInt(budgetResult.data.confirmed_available_funds_paise) }, expenses: expenseEstimates, confirmedScholarshipFundsPaise: confirmedScholarshipFunding(applications) }); } catch { nextAffordability = null; }
      }
    }
    setAffordability(nextAffordability);
    const visibleScholarshipDeadlines: ScholarshipDeadline[] = (scholarshipResult.data ?? []).map((item: any) => ({ id: item.scholarship_id, name: item.scholarship_records?.name ?? "Recorded opportunity", deadline: item.scholarship_records?.deadline ?? null, status: item.status }));
    const visibleOpportunityTasks: OpportunityTask[] = (opportunityTaskResult.data ?? []).map((item: any) => ({ id: item.id, title: item.title, status: item.status, dueDate: item.due_date, nextStep: item.next_step ?? "" }));
    const visibleRoadmapTasks: RoadmapTask[] = (roadmapTaskResult.data ?? []).map((item: any) => ({ id: item.id, title: item.title, status: item.status, dueDate: item.due_date, nextStep: item.next_step ?? "" }));
    setActionPlan(buildUnifiedActionPlan({
      hasProfile: role === "parent" || Boolean(profileResult.data),
      preferredBranches: (profileResult.data as Profile | null)?.preferred_branches ?? [],
      hasBudget: Boolean(budgetResult.data),
      affordability: nextAffordability,
      hasCollegeComparison: (comparisonResult.count ?? 0) > 0,
      hasTrackedOpportunity: (scholarshipResult.data ?? []).length > 0,
      opportunityTasks: visibleOpportunityTasks,
      scholarshipDeadlines: visibleScholarshipDeadlines,
      hasRoadmap: (roadmapResult.count ?? 0) > 0,
      roadmapMilestones: ((milestoneResult.data ?? []) as Array<{ id?: string; title?: string; status: "not_started" | "in_progress" | "completed" | "blocked"; due_date?: string | null }>).map((item, index) => ({ id: item.id ?? `milestone-${index}`, title: item.title ?? "Roadmap milestone", status: item.status, dueDate: item.due_date ?? null })),
      roadmapTasks: visibleRoadmapTasks,
    }));
    setLoading(false);
  }
  useEffect(() => { void load(); }, [familyId, userId]);

  async function explainPlan() {
    setGuidanceBusy(true);
    const facts = [
      affordability ? `Funding gap: ${formatPaise(affordability.fundingGapPaise)}; confirmed funds: ${formatPaise(affordability.confirmedFundsPaise)}; confirmed scholarship aid: ${formatPaise(affordability.confirmedScholarshipFundsPaise)}; future contributions: ${formatPaise(affordability.projectedContributionsPaise)}.` : "Affordability has not been calculated yet.",
      `${comparisonCount} college comparison record(s) are available; pathway signals require verified cutoff and cost data.`,
      `${opportunityCount} scholarship application(s) are tracked; only explicitly confirmed eligible aid is included in the funding calculation.`,
      `${roadmapCount} roadmap plan(s) are available; ${blockedMilestones} milestone(s) are blocked.`,
    ];
    try {
      const response = await fetch("/api/ai/guidance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "affordability", language: guidanceLanguage, facts }) });
      const data = await response.json() as { text?: string; source?: "groq" | "rule_based"; error?: string };
      if (!response.ok || !data.text) { setGuidance(data.error ?? "Guidance is unavailable right now."); setGuidanceSource("rule_based"); }
      else { setGuidance(data.text); setGuidanceSource(data.source ?? "rule_based"); }
    } catch { setGuidance("Guidance is unavailable right now. Review the recorded gap, verified options and next actions above."); setGuidanceSource("rule_based"); }
    setGuidanceBusy(false);
  }

  const actions: DecisionAction[] = useMemo(() => buildDecisionActions({ hasProfile: role === "parent" || Boolean(profile), hasBudget: Boolean(budget), hasComparison: comparisonCount > 0, hasOpportunity: opportunityCount > 0, hasRoadmap: roadmapCount > 0, affordability, blockedMilestones }), [role, profile, budget, comparisonCount, opportunityCount, roadmapCount, affordability, blockedMilestones]);
  if (loading) return <section className="rounded-xl border border-indigo-100 bg-white p-6 text-sm text-slate-600" aria-busy="true">{t("loading")}</section>;

  return <section id="decision-plan" className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-slate-50 p-6 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-medium text-indigo-700">{t("unifiedPlan")}</p><h2 className="mt-1 text-2xl font-semibold text-slate-950">{t("fromDirection")}</h2><p className="mt-1 max-w-2xl text-sm text-slate-600">{t("oneViewPlan")}</p></div><button aria-label={t("refreshPlan")} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm underline" type="button" onClick={() => void load()}>{t("refreshPlan")}</button></div>{role === "student" && !profile && <div id="student-direction"><ProfileSetup familyId={familyId} userId={userId} onSaved={() => void load()} /></div>}{message && <p className="mt-4 rounded-md bg-rose-50 p-3 text-sm text-rose-800" role="alert">{message}</p>}<div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Summary label={t("budget")} value={!budget ? t("notAvailable") : affordability?.fundingGapPaise === 0n ? "Within current plan" : affordability ? `${formatPaise(affordability.fundingGapPaise)} gap` : "Needs review"} /><Summary label={t("collegeComparisons")} value={comparisonCount ? `${comparisonCount} saved` : t("notAvailable")} /><Summary label={t("opportunities")} value={opportunityCount ? `${opportunityCount} tracked` : t("notAvailable")} /><Summary label={t("roadmap")} value={roadmapCount ? `${roadmapCount} plan${roadmapCount === 1 ? "" : "s"}` : t("notAvailable")} /></div>{actionPlan.length > 0 && <UnifiedActionPlan items={actionPlan} role={role} />}{affordability && <p className="mt-4 text-sm text-slate-700">Confirmed funds: <strong>{formatPaise(affordability.confirmedFundsPaise)}</strong> · Confirmed scholarship aid: <strong>{formatPaise(affordability.confirmedScholarshipFundsPaise)}</strong> · Future contributions: <strong>{formatPaise(affordability.projectedContributionsPaise)}</strong>. These are calculated by the existing exact-money engine.</p>}<section className="mt-5 rounded-lg border border-violet-200 bg-violet-50/70 p-4" aria-labelledby="plan-guidance-title"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-medium text-violet-800">AI guidance</p><h3 id="plan-guidance-title" className="mt-1 text-lg font-semibold text-slate-950">Understand this plan</h3><p className="mt-1 text-sm text-slate-700">Explanations use the summary currently visible here. They cannot change calculations, eligibility or verified records.</p></div><label className="text-sm text-slate-700">Language<select className="mt-1 block rounded border bg-white p-2" value={guidanceLanguage} onChange={(event) => setGuidanceLanguage(event.target.value as "en" | "te")}><option value="en">English</option><option value="te">తెలుగు</option></select></label></div><button className="mt-3 rounded-md border border-violet-300 bg-white px-3 py-2 text-sm font-medium underline" type="button" disabled={guidanceBusy} onClick={() => void explainPlan()}>{guidanceBusy ? "Preparing…" : "Explain this plan"}</button>{guidance && <div className="mt-3 rounded border border-violet-200 bg-white p-3 text-sm leading-6 text-slate-800" role="status"><p>{guidance}</p><p className="mt-2 text-xs text-slate-500">{guidanceSource === "groq" ? "AI explanation based on the visible plan summary." : "Rule-based explanation; AI service was unavailable or not configured."}</p></div>}</section>{pathway && <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4"><h3 className="font-medium text-emerald-950">{t("pathwaySignals")}</h3><p className="mt-1 text-xs text-emerald-900">These are rank-and-preference matches from recorded data, not admission predictions or guarantees. Affordability remains a separate constraint.</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><div className="rounded bg-white p-3"><p className="text-xs text-slate-600">{t("primaryCandidate")}</p><p className="font-medium text-slate-900">{pathway.primary.collegeName} · {pathway.primary.branchName}</p></div>{pathway.alternative ? <div className="rounded bg-white p-3"><p className="text-xs text-slate-600">{t("alternativeCandidate")}</p><p className="font-medium text-slate-900">{pathway.alternative.collegeName} · {pathway.alternative.branchName}</p></div> : <div className="rounded bg-white p-3 text-sm text-slate-600">{t("noSecondCandidate")}</div>}</div></div>}{<div className="mt-5"><h3 className="font-medium text-slate-900">{t("nextActions")}</h3><ul className="mt-2 grid gap-2 sm:grid-cols-2">{actions.map((action) => <li key={action.label} className={`rounded-lg border p-3 ${action.tone === "urgent" ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-white"}`}><p className="text-sm font-medium text-slate-900">{action.label}</p><p className="mt-1 text-xs text-slate-600">{action.detail}</p></li>)}</ul></div>}</section>;
}

function UnifiedActionPlan({ items, role }: { items: ActionPlanItem[]; role: "parent" | "student" }) {
  const openCount = items.filter((item) => item.status === "open").length;
  const blockedCount = items.filter((item) => item.status === "blocked").length;
  return <div className="mt-5 rounded-lg border border-slate-200 bg-white p-4" aria-label="Student action plan"><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-medium text-slate-950">{role === "student" ? "Your action plan" : "Shared student action plan"}</h3><p className="mt-1 text-xs text-slate-600">{openCount} open action{openCount === 1 ? "" : "s"}{blockedCount ? ` · ${blockedCount} blocked` : ""}. Progress is read from the records visible to this account.</p></div><span className="text-xs text-slate-500">No guarantees; verify every source</span></div><ol className="mt-3 space-y-2">{items.slice(0, 8).map((item) => <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 rounded border border-slate-200 p-3"><div><p className="text-sm font-medium text-slate-900">{item.title}</p><p className="mt-1 text-xs text-slate-600">{item.detail}</p>{item.dueDate && <p className="mt-1 text-xs text-slate-500">Due: {item.dueDate}</p>}</div><div className="flex items-center gap-2"><span className={`rounded-full px-2 py-1 text-xs ${item.status === "blocked" ? "bg-rose-50 text-rose-800" : item.status === "unknown" ? "bg-amber-50 text-amber-900" : "bg-slate-100 text-slate-700"}`}>{item.status.replace("_", " ")}</span>{item.anchor !== "decision-plan" && <a className="text-xs font-medium underline" href={`#${item.anchor}`}>Open</a>}</div></li>)}</ol>{items.length > 8 && <p className="mt-2 text-xs text-slate-500">Showing the first 8 actions. Open the relevant module for the full list.</p>}</div>;
}

function Summary({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border border-slate-200 bg-white p-3"><p className="text-xs text-slate-600">{label}</p><p className="mt-1 font-semibold text-slate-950">{value}</p></div>; }
