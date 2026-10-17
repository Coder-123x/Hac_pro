import { describe, expect, it } from "vitest";
import { canParentSee, defaultSharingPreferences } from "../lib/sharing";

describe("family sharing preferences", () => {
  it("defaults every category to private", () => {
    expect(defaultSharingPreferences).toEqual({ budgetSummaryShared: false, collegeComparisonsShared: false, scholarshipProgressShared: false, professionalDevelopmentShared: false });
  });
  it("only exposes an explicitly enabled category", () => {
    expect(canParentSee({ ...defaultSharingPreferences, collegeComparisonsShared: true }, "collegeComparisonsShared")).toBe(true);
    expect(canParentSee({ ...defaultSharingPreferences, collegeComparisonsShared: true }, "scholarshipProgressShared")).toBe(false);
  });
});
