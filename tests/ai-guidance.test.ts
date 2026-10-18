import { describe, expect, it } from "vitest";
import { fallbackGuidance, parseGroqText, validateGuidanceRequest } from "../lib/ai-guidance";

describe("Groq guidance safety boundary", () => {
  it("validates bounded requests and rejects unsupported values", () => {
    expect(validateGuidanceRequest({ kind: "affordability", language: "en", facts: ["gap is unknown"] }).ok).toBe(true);
    expect(validateGuidanceRequest({ kind: "unknown", language: "en", facts: [] }).ok).toBe(false);
    expect(validateGuidanceRequest({ kind: "roadmap", language: "te", facts: new Array(13).fill("x") }).ok).toBe(false);
  });

  it("rejects malformed model responses without throwing", () => {
    expect(parseGroqText(null)).toBeNull();
    expect(parseGroqText({ choices: [] })).toBeNull();
    expect(parseGroqText({ choices: [{ message: { content: "  Verified facts only. " } }] })).toBe("Verified facts only.");
  });

  it("provides a bilingual rule-based fallback", () => {
    expect(fallbackGuidance({ kind: "affordability", language: "en", facts: [] })).toContain("confirmed funds");
    expect(fallbackGuidance({ kind: "roadmap", language: "te", facts: [] })).toContain("ఆధారాన్ని");
  });
});
