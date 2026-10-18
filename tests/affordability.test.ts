import { describe, expect, it } from "vitest";
import { calculateAffordability, calculateWhatIf, formatPaise, hasCostEstimates, parseRupeesToPaise, projectAnnualCosts } from "../lib/affordability";

const base = {
  durationYears: 4,
  expenses: [{ category: "Tuition", annualPaise: 100_000n, planYear: 1, annualIncreaseBps: 500 }],
  monthlyContributionPaise: 10_000n,
  annualContributionPaise: 0n,
  confirmedFundsPaise: 100_000n,
};

describe("exact-money affordability calculations", () => {
  it("parses and formats paise without floating-point drift", () => {
    expect(parseRupeesToPaise("1,234.50")).toBe(123_450n);
    expect(formatPaise(123_450n)).toBe("₹1,234.50");
  });

  it("projects annual costs with rounded inflation", () => {
    expect(projectAnnualCosts(base.expenses, 4)).toEqual([100_000n, 105_000n, 110_250n, 115_763n]);
  });

  it("starts an estimate in its configured plan year", () => {
    expect(projectAnnualCosts([{ category: "Hostel", annualPaise: 50_000n, planYear: 3, annualIncreaseBps: 1_000 }], 4)).toEqual([0n, 0n, 50_000n, 55_000n]);
  });

  it("calculates a funding gap and annual gaps", () => {
    const result = calculateAffordability(base);
    expect(result.projectedContributionsPaise).toBe(480_000n);
    expect(result.totalCostPaise).toBe(431_013n);
    expect(result.fundingGapPaise).toBe(0n);
    expect(result.annualGapsPaise).toEqual([0n, 0n, 0n, 0n]);
  });

  it("handles zero and insufficient funds", () => {
    const result = calculateAffordability({ ...base, expenses: [], monthlyContributionPaise: 0n, annualContributionPaise: 0n, confirmedFundsPaise: 0n });
    expect(result.coverageBps).toBe(10_000n);
    expect(result.fundingGapPaise).toBe(0n);
    const insufficient = calculateAffordability({ ...base, monthlyContributionPaise: 0n, confirmedFundsPaise: 0n });
    expect(insufficient.fundingGapPaise).toBe(insufficient.totalCostPaise);
  });

  it("distinguishes an empty cost plan from an entered zero-cost estimate", () => {
    expect(hasCostEstimates([])).toBe(false);
    expect(hasCostEstimates([{ category: "Other", annualPaise: 0n, planYear: 1, annualIncreaseBps: 0 }])).toBe(true);
  });

  it("rejects contradictory contributions and keeps uncertain aid out", () => {
    expect(() => calculateAffordability({ ...base, monthlyContributionPaise: 10_000n, annualContributionPaise: 1n })).toThrow();
    const noAid = calculateAffordability({ ...base, confirmedFundsPaise: 0n, monthlyContributionPaise: 0n, annualContributionPaise: 0n });
    expect(noAid.totalFundingPaise).toBe(0n);
  });

  it("supports what-if cost and contribution scenarios", () => {
    const scenario = calculateWhatIf(base, { confirmedFundsPaise: 0n, annualContributionPaise: 500_000n, monthlyContributionPaise: 0n });
    expect(scenario.fundingGapPaise).toBe(0n);
  });

  it("keeps confirmed scholarship aid separate and counts it once", () => {
    const result = calculateAffordability({ ...base, confirmedFundsPaise: 0n, monthlyContributionPaise: 0n, annualContributionPaise: 0n, confirmedScholarshipFundsPaise: 200_000n });
    expect(result.confirmedFundsPaise).toBe(0n);
    expect(result.confirmedScholarshipFundsPaise).toBe(200_000n);
    expect(result.totalFundingPaise).toBe(200_000n);
  });
});
