export type OpportunityCriterionType = "fixed" | "actionable";
export type OpportunityCriterionStatus = "eligible" | "not_eligible" | "unknown";
export type OpportunityLifecycle = "researching" | "preparing" | "ready_to_apply" | "submitted" | "approved" | "rejected" | "expired";
export type OpportunityTaskPriority = "low" | "normal" | "high" | "urgent";
export type OpportunityTaskStatus = "todo" | "in_progress" | "completed" | "blocked";

export type OpportunityCriterion = {
  id: string;
  scholarshipId: string;
  criterionType: OpportunityCriterionType;
  label: string;
  status: OpportunityCriterionStatus;
  evidenceReason: string;
  sourceUrl: string | null;
};

export type OpportunityTask = {
  id: string;
  scholarshipId: string;
  title: string;
  description: string;
  dueDate: string | null;
  priority: OpportunityTaskPriority;
  status: OpportunityTaskStatus;
  blocker: string;
  nextStep: string;
};

export const opportunityLifecycleLabels: Record<OpportunityLifecycle, string> = {
  researching: "Researching",
  preparing: "Preparing",
  ready_to_apply: "Ready to apply",
  submitted: "Submitted (user recorded)",
  approved: "Approved (user recorded)",
  rejected: "Rejected (user recorded)",
  expired: "Expired",
};

export const opportunityCriterionLabels: Record<OpportunityCriterionStatus, string> = {
  eligible: "Eligible (based on evidence)",
  not_eligible: "Not eligible (based on evidence)",
  unknown: "Unknown — verify",
};

export function canMarkOpportunityCompleted(task: Pick<OpportunityTask, "status">): boolean {
  return task.status !== "completed";
}

export function opportunityReadiness(criteria: Array<Pick<OpportunityCriterion, "status">>, tasks: Array<Pick<OpportunityTask, "status">>): "ready" | "blocked" | "unknown" {
  if (criteria.some((criterion) => criterion.status === "not_eligible") || tasks.some((task) => task.status === "blocked")) return "blocked";
  if (criteria.length === 0 || criteria.some((criterion) => criterion.status === "unknown") || tasks.some((task) => task.status !== "completed")) return "unknown";
  return "ready";
}
