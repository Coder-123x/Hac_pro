import { calculateAffordability, type AffordabilityResult, type ExpenseEstimate, type Paise } from "./affordability";

export type CutoffStatus = "rank_meets_cutoff" | "rank_above_cutoff" | "missing_cutoff";

export function compareRankToCutoff(rank: number, cutoffRank: number | null): CutoffStatus {
  if (!Number.isInteger(rank) || rank < 1) throw new Error("EAPCET rank must be a positive integer.");
  if (cutoffRank === null) return "missing_cutoff";
  if (!Number.isInteger(cutoffRank) || cutoffRank < 1) throw new Error("Cutoff rank must be a positive integer.");
  return rank <= cutoffRank ? "rank_meets_cutoff" : "rank_above_cutoff";
}

export type CollegeOptionCosts = {
  annualTuitionPaise: Paise | null;
  annualHostelLivingPaise: Paise | null;
};

export function calculateCollegeAffordability(
  costs: CollegeOptionCosts,
  funding: Pick<Parameters<typeof calculateAffordability>[0], "monthlyContributionPaise" | "annualContributionPaise" | "confirmedFundsPaise">,
  durationYears = 4,
): AffordabilityResult | null {
  if (costs.annualTuitionPaise === null || costs.annualHostelLivingPaise === null) return null;
  const expenses: ExpenseEstimate[] = [
    { category: "Tuition", annualPaise: costs.annualTuitionPaise, planYear: 1, annualIncreaseBps: 0 },
    { category: "Hostel and living", annualPaise: costs.annualHostelLivingPaise, planYear: 1, annualIncreaseBps: 0 },
  ];
  return calculateAffordability({ durationYears, expenses, ...funding });
}

