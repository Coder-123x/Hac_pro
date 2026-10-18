import type { Paise } from "./affordability";
import type { OpportunityLifecycle } from "./opportunities";

export type ScholarshipStatus = "saved" | "planning" | "applied" | "approved" | "rejected" | "received";
export type ScholarshipRecord = {
  id: string; name: string; provider: string; stateCode: string; category: string | null;
  incomeLimitPaise: Paise | null; course: string | null; institutionType: string | null;
  deadline: string | null; verificationStatus: "official_verified" | "secondary_verified" | "unverified" | "missing";
  applicableAcademicYear?: number | null; requiredDocuments?: string[]; applicationSteps?: string[];
};
export type ScholarshipApplication = { id: string; scholarshipId: string; status: ScholarshipStatus; opportunityState?: OpportunityLifecycle; awardedAmountPaise: Paise | null; receivedAmountPaise: Paise | null; confirmedFunding: boolean; verificationStatus?: ScholarshipRecord["verificationStatus"] };
export type ScholarshipFilters = { stateCode?: string; category?: string; incomePaise?: Paise; course?: string; institutionType?: string; deadlineBefore?: string; status?: ScholarshipStatus | "not_tracked" };

export function filterScholarships(records: ScholarshipRecord[], applications: ScholarshipApplication[], filters: ScholarshipFilters): ScholarshipRecord[] {
  const applicationByScholarship = new Map(applications.map((application) => [application.scholarshipId, application]));
  return records.filter((record) => {
    if (filters.stateCode && record.stateCode !== filters.stateCode) return false;
    if (filters.category && (record.category ?? "").toLowerCase() !== filters.category.toLowerCase()) return false;
    if (filters.incomePaise !== undefined && record.incomeLimitPaise !== null && filters.incomePaise > record.incomeLimitPaise) return false;
    if (filters.course && !(record.course ?? "").toLowerCase().includes(filters.course.toLowerCase())) return false;
    if (filters.institutionType && (record.institutionType ?? "").toLowerCase() !== filters.institutionType.toLowerCase()) return false;
    if (filters.deadlineBefore && record.deadline && record.deadline > filters.deadlineBefore) return false;
    if (filters.status) {
      const status = applicationByScholarship.get(record.id)?.status;
      if (filters.status === "not_tracked" ? status !== undefined : status !== filters.status) return false;
    }
    return true;
  });
}

export function deadlineState(deadline: string | null, today = new Date().toISOString().slice(0, 10)): "open" | "closing_soon" | "expired" | "unknown" {
  if (!deadline) return "unknown";
  if (deadline < today) return "expired";
  const days = Math.ceil((Date.parse(`${deadline}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  return days <= 30 ? "closing_soon" : "open";
}

export function confirmedScholarshipFunding(applications: ScholarshipApplication[]): Paise {
  const counted = new Set<string>();
  return applications.reduce((total, application) => {
    if (counted.has(application.id)) return total;
    if (!application.confirmedFunding || !["approved", "received"].includes(application.status)) return total;
    if (application.verificationStatus === "unverified" || application.verificationStatus === "missing") return total;
    counted.add(application.id);
    // A received amount supersedes the award; never add both for one application.
    const amount = application.receivedAmountPaise ?? application.awardedAmountPaise ?? 0n;
    return amount > 0n ? total + amount : total;
  }, 0n);
}

export function canTransitionScholarshipStatus(from: ScholarshipStatus, to: ScholarshipStatus): boolean {
  if (from === to) return true;
  const allowed: Record<ScholarshipStatus, ScholarshipStatus[]> = {
    saved: ["planning", "applied", "rejected"], planning: ["applied", "rejected"], applied: ["approved", "rejected"], approved: ["received", "rejected"], rejected: [], received: [],
  };
  return allowed[from].includes(to);
}
