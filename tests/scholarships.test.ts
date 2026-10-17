import { describe, expect, it } from "vitest";
import { confirmedScholarshipFunding, deadlineState, filterScholarships, canTransitionScholarshipStatus } from "../lib/scholarships";

const records = [
  { id: "official", name: "Official", provider: "Provider", stateCode: "AP", category: "BC", incomeLimitPaise: 25000000n, course: "engineering", institutionType: "private", deadline: "2026-11-30", verificationStatus: "official_verified" as const },
  { id: "missing", name: "Missing", provider: "Unknown", stateCode: "AP", category: null, incomeLimitPaise: null, course: null, institutionType: null, deadline: null, verificationStatus: "missing" as const },
];

describe("scholarship navigator rules", () => {
  it("filters by state, category, income and status", () => {
    expect(filterScholarships(records, [{ id: "a", scholarshipId: "official", status: "saved", awardedAmountPaise: null, receivedAmountPaise: null, confirmedFunding: false }], { stateCode: "AP", category: "BC", incomePaise: 20000000n, status: "saved" })).toHaveLength(1);
    expect(filterScholarships(records, [], { incomePaise: 30000000n })).toHaveLength(1);
  });
  it("classifies deadlines and missing dates", () => {
    expect(deadlineState("2026-12-31", "2026-10-17")).toBe("open");
    expect(deadlineState("2026-11-01", "2026-10-17")).toBe("closing_soon");
    expect(deadlineState(null, "2026-10-17")).toBe("unknown");
  });
  it("counts only explicitly confirmed approved or received aid once", () => {
    expect(confirmedScholarshipFunding([
      { id: "a", scholarshipId: "a", status: "approved", awardedAmountPaise: 100000n, receivedAmountPaise: 40000n, confirmedFunding: true },
      { id: "a", scholarshipId: "a", status: "approved", awardedAmountPaise: 100000n, receivedAmountPaise: 40000n, confirmedFunding: true },
      { id: "b", scholarshipId: "b", status: "applied", awardedAmountPaise: 900000n, receivedAmountPaise: null, confirmedFunding: false },
    ])).toBe(40000n);
  });
  it("uses received amount instead of awarded amount and excludes pending, rejected and unverified aid", () => {
    expect(confirmedScholarshipFunding([
      { id: "received", scholarshipId: "r", status: "received", awardedAmountPaise: 100n, receivedAmountPaise: 40n, confirmedFunding: true, verificationStatus: "official_verified" },
      { id: "approved", scholarshipId: "a", status: "approved", awardedAmountPaise: 60n, receivedAmountPaise: null, confirmedFunding: true, verificationStatus: "secondary_verified" },
      { id: "pending", scholarshipId: "p", status: "applied", awardedAmountPaise: 1000n, receivedAmountPaise: null, confirmedFunding: false, verificationStatus: "official_verified" },
      { id: "rejected", scholarshipId: "x", status: "rejected", awardedAmountPaise: 1000n, receivedAmountPaise: null, confirmedFunding: true, verificationStatus: "official_verified" },
      { id: "unverified", scholarshipId: "u", status: "approved", awardedAmountPaise: 1000n, receivedAmountPaise: null, confirmedFunding: true, verificationStatus: "unverified" },
    ])).toBe(100n);
  });
  it("restricts status transitions", () => {
    expect(canTransitionScholarshipStatus("saved", "planning")).toBe(true);
    expect(canTransitionScholarshipStatus("saved", "received")).toBe(false);
    expect(canTransitionScholarshipStatus("received", "applied")).toBe(false);
  });
});
