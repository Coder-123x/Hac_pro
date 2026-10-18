import { describe, expect, it } from "vitest";
import { validateEmail, validateInvitationToken, validatePassword, validateWorkspaceName } from "../lib/validation";
import { friendlyError } from "../lib/supabase/messages";

describe("Phase 3 input validation", () => {
  it("accepts valid email and password values", () => {
    expect(validateEmail("parent@example.com").ok).toBe(true);
    expect(validatePassword("correct horse battery").ok).toBe(true);
  });

  it("rejects malformed credentials", () => {
    expect(validateEmail("not-an-email").ok).toBe(false);
    expect(validatePassword("short").ok).toBe(false);
  });

  it("rejects empty or oversized workspace names", () => {
    expect(validateWorkspaceName(" ").ok).toBe(false);
    expect(validateWorkspaceName("a".repeat(121)).ok).toBe(false);
  });

  it("requires a bounded invitation token", () => {
    expect(validateInvitationToken("").ok).toBe(false);
    expect(validateInvitationToken("one-time-token").ok).toBe(true);
    expect(validateInvitationToken("x".repeat(513)).ok).toBe(false);
  });

  it("turns authentication transport failures into actionable messages", () => {
    expect(friendlyError({ message: "Load failed" })).toContain("authentication service");
    expect(friendlyError({ message: "Failed to fetch" })).toContain("Supabase configuration");
  });

  it("explains a missing migration without blaming the user's roadmap data", () => {
    expect(friendlyError({ message: "relation roadmap_plans does not exist" })).toContain("database migration");
  });
});
