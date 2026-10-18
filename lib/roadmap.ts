export type RoadmapJourney = "aspirant" | "current_student";
export type RoadmapSkillLevel = "beginner" | "developing" | "intermediate" | "advanced";
export type RoadmapMilestoneStatus = "not_started" | "in_progress" | "completed" | "blocked";

export type RoadmapPlanInput = {
  journey: RoadmapJourney;
  careerGoal: string;
  currentBranch?: string;
  currentYear?: number;
  skillLevel?: RoadmapSkillLevel;
  weeklyStudyHours?: number;
  budgetConstraintPaise?: bigint;
  targetDate?: string;
};

export type RoadmapMilestoneTemplate = {
  phase: "foundation" | "selection" | "admission" | "first_year" | "semester" | "skills" | "portfolio" | "experience" | "higher_education";
  title: string;
  description: string;
  sortOrder: number;
};

export function buildRoadmapMilestones(plan: RoadmapPlanInput): RoadmapMilestoneTemplate[] {
  const goal = plan.careerGoal.trim() || "your target career";
  if (plan.journey === "aspirant") {
    return [
      { phase: "foundation", title: "Clarify the target and constraints", description: `Record why ${goal} matters, available study time and budget assumptions.`, sortOrder: 1 },
      { phase: "selection", title: "Compare realistic college and branch options", description: "Review only source-backed options and record unknown admission or cost information separately.", sortOrder: 2 },
      { phase: "admission", title: "Prepare entrance and application milestones", description: "Track preparation, documents, deadlines and funding actions without treating completion as an admission guarantee.", sortOrder: 3 },
      { phase: "first_year", title: "Prepare for the first academic year", description: "Plan orientation, foundational study habits and a manageable first-year learning routine.", sortOrder: 4 },
    ];
  }
  return [
    { phase: "foundation", title: "Define the next career milestone", description: `Translate ${goal} into a measurable semester-aware outcome.`, sortOrder: 1 },
    { phase: "semester", title: "Plan the current semester", description: "Choose a small set of study and assessment milestones that fit the available weekly time.", sortOrder: 2 },
    { phase: "skills", title: "Build evidence of relevant skills", description: "Practice deliberately and record evidence; consuming a resource alone is not proof of mastery.", sortOrder: 3 },
    { phase: "portfolio", title: "Create a reviewable project portfolio", description: "Publish project links or evidence only when the student has actually completed and reviewed the work.", sortOrder: 4 },
    { phase: "experience", title: "Prepare for internships and interviews", description: "Track resume, applications and interview preparation without inventing opportunities or outcomes.", sortOrder: 5 },
    ...(goal.toLowerCase().includes("gate") || goal.toLowerCase().includes("higher") ? [{ phase: "higher_education" as const, title: "Plan higher-education preparation", description: "Record the chosen exam or program, prerequisites and a sustainable preparation schedule.", sortOrder: 6 }] : []),
  ];
}

export function roadmapProgress(statuses: RoadmapMilestoneStatus[]): number {
  if (!statuses.length) return 0;
  return Math.round((statuses.filter((status) => status === "completed").length / statuses.length) * 100);
}
