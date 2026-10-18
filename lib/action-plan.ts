import type { AffordabilityResult } from "./affordability";

export type ActionPlanStatus = "open" | "completed" | "blocked" | "unknown";
export type ActionPlanSource = "goal" | "budget" | "college" | "opportunity" | "roadmap" | "review";

export type ActionPlanItem = {
  id: string;
  title: string;
  detail: string;
  source: ActionPlanSource;
  status: ActionPlanStatus;
  dueDate: string | null;
  anchor: string;
};

export type ActionPlanInput = {
  hasProfile: boolean;
  preferredBranches: string[];
  hasBudget: boolean;
  affordability: Pick<AffordabilityResult, "fundingGapPaise"> | null;
  hasCollegeComparison: boolean;
  hasTrackedOpportunity: boolean;
  opportunityTasks: Array<{ id: string; title: string; status: "todo" | "in_progress" | "completed" | "blocked"; dueDate: string | null; nextStep: string }>;
  scholarshipDeadlines: Array<{ id: string; name: string; deadline: string | null; status: "saved" | "planning" | "applied" | "approved" | "rejected" | "received" }>;
  hasRoadmap: boolean;
  roadmapMilestones: Array<{ id: string; title: string; status: "not_started" | "in_progress" | "completed" | "blocked"; dueDate: string | null }>;
  roadmapTasks: Array<{ id: string; title: string; status: "not_started" | "in_progress" | "completed" | "blocked"; dueDate: string | null; nextStep: string }>;
};

function statusOf(status: "todo" | "in_progress" | "not_started" | "completed" | "blocked"): ActionPlanStatus {
  if (status === "completed") return "completed";
  if (status === "blocked") return "blocked";
  return "open";
}
/**
 * Builds a read-only, deterministic action view from records already visible to the user.
 * It never invents dates or eligibility; missing data becomes an explicit setup action.
 */
export function buildUnifiedActionPlan(input: ActionPlanInput): ActionPlanItem[] {
  const items: ActionPlanItem[] = [];
  if (!input.hasProfile) {
    items.push({ id: "goal", title: "Define your education and career goal", detail: "Choose the aspirant or current B.Tech journey and record preferred branches if known.", source: "goal", status: "open", dueDate: null, anchor: "student-direction" });
  }
  if (!input.hasBudget) {
    items.push({ id: "budget", title: "Set up the family education budget", detail: "Separate funds available now from future contributions before comparing options.", source: "budget", status: "open", dueDate: null, anchor: "affordability" });
  } else if (input.affordability && input.affordability.fundingGapPaise > 0n) {
    items.push({ id: "funding-gap", title: "Work through the remaining funding gap", detail: "Review confirmed funds, future contributions and explicitly confirmed aid; potential awards are not counted.", source: "budget", status: "blocked", dueDate: null, anchor: "affordability" });
  }
  if (!input.hasCollegeComparison) {
    items.push({ id: "college", title: "Compare college and branch options", detail: input.preferredBranches.length ? `Start with recorded preferences: ${input.preferredBranches.join(", ")}. Missing cutoffs and costs remain unknown.` : "Add preferred branches and source-backed options; no admission outcome is guaranteed.", source: "college", status: "open", dueDate: null, anchor: "college-comparison" });
  }
  if (!input.hasTrackedOpportunity) {
    items.push({ id: "opportunity", title: "Review funding opportunities", detail: "Track eligibility evidence and preparation tasks without treating an application as approval.", source: "opportunity", status: "open", dueDate: null, anchor: "scholarships" });
  }
  for (const scholarship of input.scholarshipDeadlines) {
    if (scholarship.deadline && !["approved", "received", "rejected"].includes(scholarship.status)) {
      items.push({ id: `deadline-${scholarship.id}`, title: `Check the ${scholarship.name} deadline`, detail: "Confirm the official source and required documents before applying.", source: "opportunity", status: "open", dueDate: scholarship.deadline, anchor: "scholarships" });
    }
  }
  for (const task of input.opportunityTasks.filter((task) => task.status !== "completed")) {
    items.push({ id: `opportunity-task-${task.id}`, title: task.title, detail: task.nextStep || "Record the next evidence-backed step.", source: "opportunity", status: statusOf(task.status), dueDate: task.dueDate, anchor: "scholarships" });
  }
  if (!input.hasRoadmap) {
    items.push({ id: "roadmap", title: "Create a career roadmap", detail: "Turn the chosen direction into manageable milestones; completion is not proof of mastery or employment.", source: "roadmap", status: "open", dueDate: null, anchor: "roadmap" });
  }
  for (const milestone of input.roadmapMilestones.filter((milestone) => milestone.status !== "completed")) {
    items.push({ id: `milestone-${milestone.id}`, title: milestone.title, detail: milestone.status === "blocked" ? "Resolve the blocker before marking this milestone complete." : "Update progress when the work is actually done.", source: "roadmap", status: statusOf(milestone.status), dueDate: milestone.dueDate, anchor: "roadmap" });
  }
  for (const task of input.roadmapTasks.filter((task) => task.status !== "completed")) {
    items.push({ id: `roadmap-task-${task.id}`, title: task.title, detail: task.nextStep || "Choose the next small action.", source: "roadmap", status: statusOf(task.status), dueDate: task.dueDate, anchor: "roadmap" });
  }
  return items.length ? items : [{ id: "review", title: "Review your plan", detail: "Update assumptions when budget, admission or funding evidence changes.", source: "review", status: "unknown", dueDate: null, anchor: "decision-plan" }];
}
