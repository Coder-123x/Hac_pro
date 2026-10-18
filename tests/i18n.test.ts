import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { translations } from "../lib/i18n";

describe("language support", () => {
  it("provides Telugu labels for the major workspace areas", () => {
    expect(translations.te.familyWorkspace).toContain("కుటుంబ");
    expect(translations.te.budget).toContain("బడ్జెట్");
    expect(translations.te.roadmap).toContain("రోడ్‌మ్యాప్");
    expect(translations.te.startDirection).toContain("దిశ");
    expect(translations.te.sharingBudget).toContain("బడ్జెట్");
    expect(translations.te.sharingProfessionalDescription).toContain("మాడ్యూల్");
  });

  it("keeps provenance and uncertainty language explicit in Telugu", () => {
    expect(translations.te.reviewSources).toContain("మూలాన్ని");
    expect(translations.te.unknown).toBe("తెలియదు");
    expect(translations.te.notAvailable).toContain("అందుబాటులో");
  });

  it("uses Telugu-specific heading metrics instead of tight Latin tracking", () => {
    const styles = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");
    expect(styles).toContain('html[lang="te"] h1');
    expect(styles).toContain("letter-spacing: normal;");
    expect(styles).toContain("line-height: 1.28;");
  });
});
