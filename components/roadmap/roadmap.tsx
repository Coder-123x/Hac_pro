"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/supabase/messages";
import { Button } from "@/components/ui/button";
import { buildRoadmapMilestones, roadmapProgress, type RoadmapJourney, type RoadmapMilestoneStatus, type RoadmapSkillLevel } from "@/lib/roadmap";
import { useLanguage } from "@/components/i18n/language-provider";

type Props = { familyId: string; userId: string; role: "parent" | "student" };
type Plan = { id: string; student_id: string; journey: RoadmapJourney; career_goal: string; current_branch: string | null; current_year: number | null; skill_level: RoadmapSkillLevel | null; weekly_study_hours: number | null; target_date: string | null };
type Milestone = { id: string; plan_id: string; phase: string; title: string; description: string; status: RoadmapMilestoneStatus; due_date: string | null; evidence_url: string | null; sort_order: number };
type RoadmapTask = { id: string; milestone_id: string; plan_id: string; title: string; status: RoadmapMilestoneStatus; due_date: string | null; blocker: string; next_step: string; evidence_url: string | null };

export function CareerRoadmap({ familyId, userId, role }: Props) {
  const { t } = useLanguage();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [tasks, setTasks] = useState<RoadmapTask[]>([]);
  const [journey, setJourney] = useState<RoadmapJourney>("aspirant");
  const [goal, setGoal] = useState("");
  const [branch, setBranch] = useState("");
  const [year, setYear] = useState("");
  const [skill, setSkill] = useState<RoadmapSkillLevel>("beginner");
  const [hours, setHours] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const supabase = createClient();
    const { data, error } = await supabase.from("roadmap_plans").select("id, student_id, journey, career_goal, current_branch, current_year, skill_level, weekly_study_hours, target_date").eq("family_id", familyId).order("updated_at", { ascending: false });
    if (error) { setMessage(friendlyError(error)); return; }
    const nextPlans = (data ?? []) as Plan[];
    setPlans(nextPlans);
    if (nextPlans.length) {
      const [{ data: rows, error: milestoneError }, { data: taskRows, error: taskError }] = await Promise.all([
        supabase.from("roadmap_milestones").select("id, plan_id, phase, title, description, status, due_date, evidence_url, sort_order").eq("family_id", familyId).order("sort_order"),
        supabase.from("roadmap_tasks").select("id, milestone_id, plan_id, title, status, due_date, blocker, next_step, evidence_url").eq("family_id", familyId).order("due_date", { ascending: true, nullsFirst: false }),
      ]);
      if (milestoneError) setMessage(friendlyError(milestoneError));
      if (taskError) setMessage(friendlyError(taskError));
      setMilestones((rows ?? []) as Milestone[]);
      setTasks((taskRows ?? []) as RoadmapTask[]);
    } else { setMilestones([]); setTasks([]); }
  }
  useEffect(() => { void load(); }, [familyId]);

  async function createPlan() {
    if (role !== "student") return;
    if (!goal.trim()) return setMessage("Enter a career goal before creating a roadmap.");
    setBusy(true); setMessage(null);
    const supabase = createClient();
    const { data, error } = await supabase.from("roadmap_plans").insert({ family_id: familyId, student_id: userId, created_by: userId, journey, career_goal: goal.trim(), current_branch: branch.trim() || null, current_year: year ? Number(year) : null, skill_level: skill, weekly_study_hours: hours ? Number(hours) : null }).select("id").single();
    if (error || !data) { setMessage(error ? friendlyError(error) : "The roadmap could not be created."); setBusy(false); return; }
    const templates = buildRoadmapMilestones({ journey, careerGoal: goal, currentBranch: branch, currentYear: year ? Number(year) : undefined, skillLevel: skill, weeklyStudyHours: hours ? Number(hours) : undefined });
    const { data: createdMilestones, error: milestoneError } = await supabase.from("roadmap_milestones").insert(templates.map((item) => ({ phase: item.phase, title: item.title, description: item.description, sort_order: item.sortOrder, plan_id: data.id, family_id: familyId, student_id: userId, created_by: userId }))).select("id, title");
    if (milestoneError || !createdMilestones) setMessage(milestoneError ? friendlyError(milestoneError) : "The roadmap milestones could not be created.");
    else {
      const { error: taskError } = await supabase.from("roadmap_tasks").insert(createdMilestones.map((item) => ({ milestone_id: item.id, plan_id: data.id, family_id: familyId, student_id: userId, created_by: userId, title: `Work on: ${item.title}`, next_step: "Choose the next small action" })));
      if (taskError) setMessage(friendlyError(taskError)); else { setGoal(""); setBranch(""); setYear(""); setHours(""); await load(); }
    }
    setBusy(false);
  }

  async function updateMilestone(id: string, status: RoadmapMilestoneStatus) {
    const { error } = await createClient().from("roadmap_milestones").update({ status }).eq("id", id).eq("family_id", familyId);
    if (error) setMessage(friendlyError(error)); else await load();
  }

  async function updateTask(id: string, status: RoadmapMilestoneStatus) {
    const { error } = await createClient().from("roadmap_tasks").update({ status, blocker: status === "blocked" ? "Add a blocker" : "" }).eq("id", id).eq("family_id", familyId);
    if (error) setMessage(friendlyError(error)); else await load();
  }

  return <section id="roadmap" className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm text-slate-600">{t("roadmapTitle")}</p><h2 className="text-xl font-semibold text-slate-950">{t("roadmapTitle")}</h2><p className="mt-1 text-sm text-slate-600">{t("roadmapPrivate")}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">{role === "student" ? "Student controls" : "Shared only with consent"}</span></div>
    {plans.length === 0 && role !== "student" && <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">No roadmap has been shared with this family yet.</p>}
    {plans.map((plan) => { const items = milestones.filter((item) => item.plan_id === plan.id); const planTasks = tasks.filter((item) => item.plan_id === plan.id); return <div key={plan.id} className="mt-5 rounded-lg border border-slate-200 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-medium text-slate-900">{plan.career_goal}</h3><p className="text-xs text-slate-600">{plan.journey === "aspirant" ? "B.Tech aspirant journey" : "Current B.Tech student journey"}{plan.current_branch ? ` · ${plan.current_branch}` : ""}{plan.current_year ? ` · year ${plan.current_year}` : ""}</p></div><span className="text-sm font-medium text-slate-700">{roadmapProgress(items.map((item) => item.status))}% complete</span></div><ol className="mt-4 space-y-2">{items.map((item) => <li key={item.id} className="rounded border border-slate-200 bg-slate-50 p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm font-medium text-slate-900">{item.sort_order}. {item.title}</p><p className="mt-1 text-xs text-slate-600">{item.description}</p>{item.evidence_url && <a className="mt-1 block text-xs underline" href={item.evidence_url} target="_blank" rel="noreferrer">View recorded evidence</a>}</div>{role === "student" ? <select aria-label={`Status for ${item.title}`} className="rounded border p-1 text-xs" value={item.status} onChange={(event) => void updateMilestone(item.id, event.target.value as RoadmapMilestoneStatus)}><option value="not_started">Not started</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="blocked">Blocked</option></select> : <span className="text-xs capitalize text-slate-600">{item.status.replace("_", " ")}</span>}</div></li>)}</ol>{planTasks.length > 0 && <div className="mt-4"><h4 className="text-sm font-medium text-slate-800">Next actions</h4><ul className="mt-2 space-y-2">{planTasks.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 p-2 text-sm"><span>{item.title}{item.next_step ? <span className="ml-2 text-xs text-slate-500">{item.next_step}</span> : null}</span>{role === "student" ? <select aria-label={`Status for ${item.title}`} className="rounded border p-1 text-xs" value={item.status} onChange={(event) => void updateTask(item.id, event.target.value as RoadmapMilestoneStatus)}><option value="not_started">Not started</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="blocked">Blocked</option></select> : <span className="text-xs capitalize text-slate-600">{item.status.replace("_", " ")}</span>}</li>)}</ul></div>}</div>; })}
    {role === "student" && <div className="mt-5 border-t border-slate-200 pt-5"><h3 className="font-medium text-slate-900">Start a roadmap</h3><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-sm">Journey<select className="mt-1 w-full rounded border p-2" value={journey} onChange={(event) => setJourney(event.target.value as RoadmapJourney)}><option value="aspirant">B.Tech aspirant</option><option value="current_student">Current B.Tech student</option></select></label><label className="text-sm">Career goal<input className="mt-1 w-full rounded border p-2" placeholder="e.g. embedded systems engineer" value={goal} onChange={(event) => setGoal(event.target.value)} /></label><label className="text-sm">Current branch (optional)<input className="mt-1 w-full rounded border p-2" value={branch} onChange={(event) => setBranch(event.target.value)} /></label><label className="text-sm">Current year (optional)<input className="mt-1 w-full rounded border p-2" type="number" min="1" max="4" value={year} onChange={(event) => setYear(event.target.value)} /></label><label className="text-sm">Skill level<select className="mt-1 w-full rounded border p-2" value={skill} onChange={(event) => setSkill(event.target.value as RoadmapSkillLevel)}><option value="beginner">Beginner</option><option value="developing">Developing</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label><label className="text-sm">Weekly study hours (optional)<input className="mt-1 w-full rounded border p-2" type="number" min="0" max="168" step="0.5" value={hours} onChange={(event) => setHours(event.target.value)} /></label></div><Button className="mt-3" type="button" disabled={busy} onClick={() => void createPlan()}>{busy ? "Creating…" : "Create roadmap"}</Button></div>}
    {message && <p className="mt-3 text-sm text-rose-700" role="alert">{message}</p>}
  </section>;
}
