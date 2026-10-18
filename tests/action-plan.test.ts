import { describe, expect, it } from "vitest";
import { buildUnifiedActionPlan } from "../lib/action-plan";

const base = {
  hasProfile: true, preferredBranches: ["CSE"], hasBudget: true, affordability: { fundingGapPaise: 0n },
  hasCollegeComparison: true, hasTrackedOpportunity: true, opportunityTasks: [], scholarshipDeadlines: [],
  hasRoadmap: true, roadmapMilestones: [], roadmapTasks: [],
};

describe("unified student action plan", () => {
  it("connects missing setup to existing module anchors without inventing dates", () => {
    const items = buildUnifiedActionPlan({ ...base, hasProfile: false, hasBudget: false, hasCollegeComparison: false, hasTrackedOpportunity: false, hasRoadmap: false });
    expect(items.map((item) => item.id)).toEqual(["goal", "budget", "college", "opportunity", "roadmap"]);
    expect(items.every((item) => item.dueDate === null)).toBe(true);
    expect(items[0].anchor).toBe("student-direction");
  });

  it("preserves blocked and dated opportunity work", () => {
    const items = buildUnifiedActionPlan({ ...base, opportunityTasks: [{ id: "t1", title: "Gather income certificate", status: "blocked", dueDate: "2026-11-01", nextStep: "Check the issuing office" }], scholarshipDeadlines: [{ id: "s1", name: "Recorded opportunity", deadline: "2026-10-30", status: "applied" }] });
    expect(items.find((item) => item.id === "opportunity-task-t1")).toMatchObject({ status: "blocked", dueDate: "2026-11-01", anchor: "scholarships" });
    expect(items.find((item) => item.id === "deadline-s1")?.dueDate).toBe("2026-10-30");
  });

  it("does not show completed roadmap work as an open action", () => {
    const items = buildUnifiedActionPlan({ ...base, roadmapMilestones: [{ id: "m1", title: "Done", status: "completed", dueDate: null }], roadmapTasks: [{ id: "t1", title: "Also done", status: "completed", dueDate: null, nextStep: "" }] });
    expect(items.some((item) => item.title === "Done" || item.title === "Also done")).toBe(false);
    expect(items).toEqual([{ id: "review", title: "Review your plan", detail: "Update assumptions when budget, admission or funding evidence changes.", source: "review", status: "unknown", dueDate: null, anchor: "decision-plan" }]);
  });
});
