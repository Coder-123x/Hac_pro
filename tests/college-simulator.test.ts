import { describe, expect, it } from "vitest";
import { calculateCollegeAffordability, compareRankToCutoff } from "../lib/college-simulator";

describe("EAPCET college simulator", () => {
  it("compares ranks without treating a cutoff as a guarantee", () => {
    expect(compareRankToCutoff(12000, 15000)).toBe("rank_meets_cutoff");
    expect(compareRankToCutoff(18000, 15000)).toBe("rank_above_cutoff");
  });

  it("keeps missing historical cutoff data explicit", () => {
    expect(compareRankToCutoff(12000, null)).toBe("missing_cutoff");
  });

  it("reuses the four-year affordability engine for complete costs", () => {
    const result = calculateCollegeAffordability(
      { annualTuitionPaise: 200_000n, annualHostelLivingPaise: 100_000n },
      { monthlyContributionPaise: 10_000n, annualContributionPaise: 0n, confirmedFundsPaise: 100_000n },
    );
    expect(result?.totalCostPaise).toBe(1_200_000n);
    expect(result?.totalFundingPaise).toBe(580_000n);
    expect(result?.fundingGapPaise).toBe(620_000n);
  });

  it("does not calculate affordability when a cost is missing", () => {
    expect(calculateCollegeAffordability(
      { annualTuitionPaise: 200_000n, annualHostelLivingPaise: null },
      { monthlyContributionPaise: 0n, annualContributionPaise: 0n, confirmedFundsPaise: 0n },
    )).toBeNull();
  });
});
