import { describe, expect, it } from "vitest";
import { buildRoadmapMilestones, roadmapProgress } from "../lib/roadmap";

describe("education-to-career roadmap", () => {
  it("creates distinct aspirant phases without claiming outcomes", () => {
    const phases = buildRoadmapMilestones({ journey: "aspirant", careerGoal: "software engineer" }).map((item) => item.phase);
    expect(phases).toEqual(["foundation", "selection", "admission", "first_year"]);
  });

  it("creates current-student skill and portfolio phases", () => {
    const titles = buildRoadmapMilestones({ journey: "current_student", careerGoal: "GATE preparation" }).map((item) => item.title);
    expect(titles).toContain("Build evidence of relevant skills");
    expect(titles).toContain("Plan higher-education preparation");
  });

  it("calculates progress only from explicit milestone status", () => {
    expect(roadmapProgress(["completed", "in_progress", "not_started", "blocked"])).toBe(25);
    expect(roadmapProgress([])).toBe(0);
  });
});
