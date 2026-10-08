import { describe, expect, it } from "vitest";
import { capsuleLabel, capsuleState } from "./capsules";

describe("time capsules", () => {
  it("maps the backend review state to a seal", () => {
    expect(capsuleState("not_due")).toBe("sealed");
    expect(capsuleState("due")).toBe("unsealed");
    expect(capsuleState("written")).toBe("opened");
  });
  it("labels say what is owed and never grade the decision", () => {
    const all = (["not_due", "due", "written"] as const).flatMap((s) => [capsuleLabel(6, s), capsuleLabel(12, s)]).join(" ");
    expect(all).toContain("Month 12: unsealed, review owed");
    expect(all).not.toMatch(/\b(good|bad|right|wrong|won|lost|score|points?|streak|reward|buy|sell)\b/i);
  });
});
