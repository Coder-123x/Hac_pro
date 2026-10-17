export type SharingPreferences = {
  budgetSummaryShared: boolean;
  collegeComparisonsShared: boolean;
  scholarshipProgressShared: boolean;
  professionalDevelopmentShared: boolean;
};

export const defaultSharingPreferences: SharingPreferences = {
  budgetSummaryShared: false,
  collegeComparisonsShared: false,
  scholarshipProgressShared: false,
  professionalDevelopmentShared: false,
};

export const sharingLabels: Record<keyof SharingPreferences, string> = {
  budgetSummaryShared: "Education budget summary",
  collegeComparisonsShared: "College comparisons",
  scholarshipProgressShared: "Scholarship and application progress",
  professionalDevelopmentShared: "Professional-development progress",
};

export function canParentSee(preferences: SharingPreferences, area: keyof SharingPreferences): boolean {
  return preferences[area] === true;
}

