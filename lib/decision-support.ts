import { calculateAffordability, type AffordabilityInput, type AffordabilityResult, type ExpenseEstimate, type Paise } from "./affordability";
import { compareRankToCutoff } from "./college-simulator";

export type DecisionSummaryInput = {
  hasProfile: boolean;
  hasBudget: boolean;
  hasComparison: boolean;
  hasOpportunity: boolean;
  hasRoadmap: boolean;
  affordability: AffordabilityResult | null;
  blockedMilestones: number;
};

export type DecisionAction = { label: string; detail: string; tone: "urgent" | "next" | "info" };

export function buildDecisionActions(input: DecisionSummaryInput): DecisionAction[] {
  const actions: DecisionAction[] = [];
  if (!input.hasProfile) actions.push({ label: "Set your journey and goal", detail: "Choose aspirant or current B.Tech student and record only the essentials.", tone: "next" });
  if (!input.hasBudget) actions.push({ label: "Set up the family budget", detail: "Record confirmed funds separately from future contributions.", tone: "next" });
  if (input.affordability?.fundingGapPaise && input.affordability.fundingGapPaise > 0n) actions.push({ label: "Work through the funding gap", detail: "Compare verified costs, funding opportunities and feasible alternatives.", tone: "urgent" });
  if (!input.hasComparison) actions.push({ label: "Add a college comparison", detail: "Use source-backed options; missing cutoffs and fees remain unknown.", tone: "next" });
  if (!input.hasOpportunity) actions.push({ label: "Review funding opportunities", detail: "Track eligibility evidence and preparation actions without assuming approval.", tone: "next" });
  if (!input.hasRoadmap) actions.push({ label: "Create a career roadmap", detail: "Turn the selected direction into manageable education and preparation milestones.", tone: "next" });
  if (input.blockedMilestones > 0) actions.push({ label: "Resolve blocked milestones", detail: `${input.blockedMilestones} roadmap milestone${input.blockedMilestones === 1 ? "" : "s"} need attention.`, tone: "urgent" });
  if (!actions.length) actions.push({ label: "Review the plan", detail: "Update assumptions when budget, admission or funding evidence changes.", tone: "info" });
  return actions;
}

export function calculateDecisionAffordability(input: {
  budget: { durationYears: number; monthly: Paise; annual: Paise; confirmed: Paise };
  expenses: ExpenseEstimate[];
  confirmedScholarshipFundsPaise: Paise;
}): AffordabilityResult {
  const affordabilityInput: AffordabilityInput = {
    durationYears: input.budget.durationYears,
    expenses: input.expenses,
    monthlyContributionPaise: input.budget.monthly,
    annualContributionPaise: input.budget.annual,
    confirmedFundsPaise: input.budget.confirmed,
    confirmedScholarshipFundsPaise: input.confirmedScholarshipFundsPaise,
  };
  return calculateAffordability(affordabilityInput);
}

export type PathwayOption = {
  id: string;
  collegeName: string;
  branchName: string;
  cutoffRank: number | null;
  annualTuitionPaise: Paise | null;
  annualHostelLivingPaise: Paise | null;
  dataStatus: "official_verified" | "historical" | "estimate" | "unverified" | "missing";
};

export function recommendCollegePathways(options: PathwayOption[], preferredBranches: string[], rank: number): { primary: PathwayOption; alternative: PathwayOption | null } | null {
  if (!Number.isInteger(rank) || rank < 1) return null;
  const preferred = preferredBranches.map((branch) => branch.toLowerCase().trim()).filter(Boolean);
  const candidates = options.filter((option) => option.cutoffRank !== null && option.annualTuitionPaise !== null && option.annualHostelLivingPaise !== null && option.dataStatus !== "missing" && compareRankToCutoff(rank, option.cutoffRank) === "rank_meets_cutoff");
  if (!candidates.length) return null;
  const score = (option: PathwayOption) => preferred.some((branch) => option.branchName.toLowerCase().includes(branch)) ? 0 : 1;
  const ranked = [...candidates].sort((a, b) => score(a) - score(b) || a.branchName.localeCompare(b.branchName) || a.collegeName.localeCompare(b.collegeName));
  return { primary: ranked[0], alternative: ranked.find((option) => option.id !== ranked[0].id) ?? null };
}
