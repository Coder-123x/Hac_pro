import { describe, expect, it } from "vitest";
import { buildDecisionActions, recommendCollegePathways } from "../lib/decision-support";

describe("unified decision support", () => {
  it("prioritizes missing setup without inventing a recommendation", () => {
    const actions = buildDecisionActions({ hasProfile: false, hasBudget: false, hasComparison: false, hasOpportunity: false, hasRoadmap: false, affordability: null, blockedMilestones: 0 });
    expect(actions[0].label).toBe("Set your journey and goal");
    expect(actions.some((action) => action.label.toLowerCase().includes("college"))).toBe(true);
  });

  it("surfaces a funding gap and blocked milestones as urgent next actions", () => {
    const actions = buildDecisionActions({ hasProfile: true, hasBudget: true, hasComparison: true, hasOpportunity: true, hasRoadmap: true, affordability: { fundingGapPaise: 1n } as never, blockedMilestones: 2 });
    expect(actions.filter((action) => action.tone === "urgent").map((action) => action.label)).toEqual(["Work through the funding gap", "Resolve blocked milestones"]);
  });

  it("only offers primary and alternative signals when rank, preference and costs are recorded", () => {
    const result = recommendCollegePathways([
      { id: "1", collegeName: "A", branchName: "CSE", cutoffRank: 10000, annualTuitionPaise: 100n, annualHostelLivingPaise: 100n, dataStatus: "official_verified" },
      { id: "2", collegeName: "B", branchName: "ECE", cutoffRank: 12000, annualTuitionPaise: 100n, annualHostelLivingPaise: 100n, dataStatus: "historical" },
      { id: "3", collegeName: "C", branchName: "CSE", cutoffRank: null, annualTuitionPaise: 100n, annualHostelLivingPaise: 100n, dataStatus: "official_verified" },
    ], ["CSE"], 9000);
    expect(result?.primary.id).toBe("1");
    expect(result?.alternative?.id).toBe("2");
    expect(recommendCollegePathways([{ id: "3", collegeName: "C", branchName: "CSE", cutoffRank: null, annualTuitionPaise: 100n, annualHostelLivingPaise: 100n, dataStatus: "missing" }], ["CSE"], 9000)).toBeNull();
  });
});
