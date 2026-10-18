import { describe, expect, it } from "vitest";
import { opportunityReadiness } from "../lib/opportunities";

describe("opportunity action-plan rules", () => {
  it("keeps unknown criteria unknown until evidence and tasks are complete", () => {
    expect(opportunityReadiness([{ status: "unknown" }], [{ status: "completed" }])).toBe("unknown");
    expect(opportunityReadiness([{ status: "eligible" }], [{ status: "todo" }])).toBe("unknown");
    expect(opportunityReadiness([{ status: "eligible" }], [{ status: "completed" }])).toBe("ready");
  });

  it("treats fixed disqualification and blocked work as blocked", () => {
    expect(opportunityReadiness([{ status: "not_eligible" }], [])).toBe("blocked");
    expect(opportunityReadiness([{ status: "eligible" }], [{ status: "blocked" }])).toBe("blocked");
  });
});
