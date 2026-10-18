"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/supabase/messages";
import { Button } from "@/components/ui/button";
import { opportunityCriterionLabels, opportunityLifecycleLabels, opportunityReadiness, type OpportunityCriterion, type OpportunityCriterionStatus, type OpportunityCriterionType, type OpportunityLifecycle, type OpportunityTask, type OpportunityTaskPriority, type OpportunityTaskStatus } from "@/lib/opportunities";

type Props = { familyId: string; scholarshipId: string; studentId: string; role: "parent" | "student"; opportunityState: OpportunityLifecycle; onOpportunityStateChange: (state: OpportunityLifecycle) => void };
type CriterionRow = { id: string; scholarship_id: string; criterion_type: OpportunityCriterionType; label: string; status: OpportunityCriterionStatus; evidence_reason: string; source_url: string | null };
type TaskRow = { id: string; scholarship_id: string; title: string; description: string; due_date: string | null; priority: OpportunityTaskPriority; status: OpportunityTaskStatus; blocker: string; next_step: string };
const blankCriterion = { type: "actionable" as OpportunityCriterionType, label: "", status: "unknown" as OpportunityCriterionStatus, evidence: "", source: "" };
const blankTask = { title: "", description: "", dueDate: "", priority: "normal" as OpportunityTaskPriority, nextStep: "" };

export function OpportunityPlan({ familyId, scholarshipId, studentId, role, opportunityState, onOpportunityStateChange }: Props) {
  const [criteria, setCriteria] = useState<OpportunityCriterion[]>([]);
  const [tasks, setTasks] = useState<OpportunityTask[]>([]);
  const [loading, setLoading] = useState(true); const [message, setMessage] = useState<string | null>(null);
  const [criterion, setCriterion] = useState(blankCriterion); const [task, setTask] = useState(blankTask);

  async function load() {
    setLoading(true); setMessage(null); const supabase = createClient();
    const [{ data: criteriaData, error: criteriaError }, { data: tasksData, error: tasksError }] = await Promise.all([
      supabase.from("opportunity_criteria").select("id, scholarship_id, criterion_type, label, status, evidence_reason, source_url").eq("family_id", familyId).eq("scholarship_id", scholarshipId).order("created_at"),
      supabase.from("opportunity_tasks").select("id, scholarship_id, title, description, due_date, priority, status, blocker, next_step").eq("family_id", familyId).eq("scholarship_id", scholarshipId).order("due_date", { ascending: true, nullsFirst: false }),
    ]);
    if (criteriaError || tasksError) setMessage("The opportunity plan is unavailable until the action-plan migration is applied.");
    setCriteria((criteriaData ?? []).map((row: CriterionRow) => ({ id: row.id, scholarshipId: row.scholarship_id, criterionType: row.criterion_type, label: row.label, status: row.status, evidenceReason: row.evidence_reason, sourceUrl: row.source_url })));
    setTasks((tasksData ?? []).map((row: TaskRow) => ({ id: row.id, scholarshipId: row.scholarship_id, title: row.title, description: row.description, dueDate: row.due_date, priority: row.priority, status: row.status, blocker: row.blocker, nextStep: row.next_step })));
    setLoading(false);
  }
  useEffect(() => { void load(); }, [familyId, scholarshipId]);

  async function addCriterion() {
    if (role !== "student") return;
    if (!criterion.label.trim()) return setMessage("Enter a criterion.");
    const { error } = await createClient().from("opportunity_criteria").insert({ scholarship_id: scholarshipId, family_id: familyId, student_id: studentId, created_by: studentId, criterion_type: criterion.type, label: criterion.label.trim(), status: criterion.status, evidence_reason: criterion.evidence.trim(), source_url: criterion.source.trim() || null });
    if (error) setMessage(friendlyError(error)); else { setCriterion(blankCriterion); await load(); }
  }

  async function addTask() {
    if (role !== "student") return;
    if (!task.title.trim()) return setMessage("Enter a task title.");
    const { error } = await createClient().from("opportunity_tasks").insert({ scholarship_id: scholarshipId, family_id: familyId, student_id: studentId, created_by: studentId, title: task.title.trim(), description: task.description.trim(), due_date: task.dueDate || null, priority: task.priority, next_step: task.nextStep.trim() });
    if (error) setMessage(friendlyError(error)); else { setTask(blankTask); await load(); }
  }

  async function updateTask(id: string, status: OpportunityTaskStatus) {
    const { error } = await createClient().from("opportunity_tasks").update({ status, blocker: status === "blocked" ? "Blocked — add a reason" : "" }).eq("id", id).eq("family_id", familyId);
    if (error) setMessage(friendlyError(error)); else await load();
  }

  const readiness = opportunityReadiness(criteria, tasks);
  if (loading) return <p className="mt-4 text-sm text-slate-500" aria-busy="true">Loading opportunity plan…</p>;
  return <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h5 className="font-medium text-slate-900">Opportunity action plan</h5><p className="mt-1 text-xs text-slate-600">Readiness is guidance from recorded evidence; it never proves eligibility, submission or approval.</p></div>{role === "student" ? <label className="text-xs font-medium">Lifecycle<select className="mt-1 rounded border p-2 font-normal" value={opportunityState} onChange={(event) => { const next = event.target.value as OpportunityLifecycle; onOpportunityStateChange(next); }}>{Object.entries(opportunityLifecycleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label> : <span className="rounded-full bg-white px-3 py-1 text-xs">{opportunityLifecycleLabels[opportunityState]}</span>}</div>
    <p className={`mt-3 text-sm ${readiness === "ready" ? "text-emerald-800" : readiness === "blocked" ? "text-rose-800" : "text-amber-800"}`}>Plan status: {readiness === "ready" ? "Ready based on recorded evidence" : readiness === "blocked" ? "Blocked or not eligible" : "More evidence or preparation needed"}</p>
    {criteria.length > 0 && <div className="mt-3"><h6 className="text-sm font-medium text-slate-800">Eligibility checklist</h6><ul className="mt-2 space-y-2">{criteria.map((item) => <li key={item.id} className="rounded border border-slate-200 bg-white p-2 text-sm"><span className="font-medium">{item.criterionType === "fixed" ? "Fixed" : "Actionable"}: {item.label}</span><span className="ml-2 text-xs text-slate-600">{opportunityCriterionLabels[item.status]}</span>{item.evidenceReason && <p className="mt-1 text-xs text-slate-600">Evidence/reason: {item.evidenceReason}</p>}</li>)}</ul></div>}
    {tasks.length > 0 && <div className="mt-3"><h6 className="text-sm font-medium text-slate-800">Preparation and follow-up</h6><ul className="mt-2 space-y-2">{tasks.map((item) => <li key={item.id} className="rounded border border-slate-200 bg-white p-2"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-medium">{item.title}</span>{role === "student" ? <select className="rounded border p-1 text-xs" value={item.status} onChange={(event) => void updateTask(item.id, event.target.value as OpportunityTaskStatus)}><option value="todo">To do</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="blocked">Blocked</option></select> : <span className="text-xs text-slate-600">{item.status}</span>}</div><p className="mt-1 text-xs text-slate-600">{item.priority} priority{item.dueDate ? ` · due ${item.dueDate}` : " · no due date recorded"}{item.nextStep ? ` · next: ${item.nextStep}` : ""}</p></li>)}</ul></div>}
    {role === "student" && <div className="mt-4 grid gap-3 border-t border-slate-200 pt-3 sm:grid-cols-2"><div><h6 className="text-sm font-medium text-slate-800">Add eligibility criterion</h6><input aria-label="Criterion label" className="mt-2 w-full rounded border p-2 text-sm" placeholder="e.g. AP domicile requirement" value={criterion.label} onChange={(event) => setCriterion({ ...criterion, label: event.target.value })} /><div className="mt-2 flex gap-2"><select aria-label="Criterion type" className="rounded border p-2 text-xs" value={criterion.type} onChange={(event) => setCriterion({ ...criterion, type: event.target.value as OpportunityCriterionType })}><option value="fixed">Fixed criterion</option><option value="actionable">Actionable criterion</option></select><select aria-label="Criterion status" className="rounded border p-2 text-xs" value={criterion.status} onChange={(event) => setCriterion({ ...criterion, status: event.target.value as OpportunityCriterionStatus })}><option value="unknown">Unknown</option><option value="eligible">Eligible</option><option value="not_eligible">Not eligible</option></select></div><input aria-label="Evidence or reason" className="mt-2 w-full rounded border p-2 text-sm" placeholder="Evidence or reason" value={criterion.evidence} onChange={(event) => setCriterion({ ...criterion, evidence: event.target.value })} /><Button className="mt-2" type="button" onClick={() => void addCriterion()}>Add criterion</Button></div><div><h6 className="text-sm font-medium text-slate-800">Add preparation task</h6><input aria-label="Task title" className="mt-2 w-full rounded border p-2 text-sm" placeholder="e.g. gather income certificate" value={task.title} onChange={(event) => setTask({ ...task, title: event.target.value })} /><textarea aria-label="Task description" className="mt-2 w-full rounded border p-2 text-sm" rows={2} placeholder="What needs to be done?" value={task.description} onChange={(event) => setTask({ ...task, description: event.target.value })} /><div className="mt-2 flex gap-2"><input aria-label="Task due date" className="w-full rounded border p-2 text-sm" type="date" value={task.dueDate} onChange={(event) => setTask({ ...task, dueDate: event.target.value })} /><select aria-label="Task priority" className="rounded border p-2 text-xs" value={task.priority} onChange={(event) => setTask({ ...task, priority: event.target.value as OpportunityTaskPriority })}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></div><input aria-label="Next step" className="mt-2 w-full rounded border p-2 text-sm" placeholder="Next step (optional)" value={task.nextStep} onChange={(event) => setTask({ ...task, nextStep: event.target.value })} /><Button className="mt-2" type="button" onClick={() => void addTask()}>Add task</Button></div></div>}
    {message && <p className="mt-3 text-sm text-rose-700" role="alert">{message}</p>}
  </div>;
}
