import { describe, expect, it } from "vitest";
import { budgetWarnings, type WarningItem } from "./warnings";

const w = (id: string, kind: WarningItem["kind"], severity: WarningItem["severity"]): WarningItem => ({
  id,
  kind,
  severity,
  title: id,
});

describe("budgetWarnings", () => {
  it("shows at most three and counts the rest", () => {
    const items = ["a", "b", "c", "d", "e"].map((id) => w(id, "investment", "medium"));
    const r = budgetWarnings(items);
    expect(r.visible.map((x) => x.id)).toEqual(["a", "b", "c"]);
    expect(r.hidden.map((x) => x.id)).toEqual(["d", "e"]);
  });

  it("ranks high before medium before low, and investment before data when equal", () => {
    const r = budgetWarnings([
      w("low-inv", "investment", "low"),
      w("med-data", "data", "medium"),
      w("med-inv", "investment", "medium"),
      w("high-data", "data", "high"),
    ]);
    expect(r.visible.map((x) => x.id)).toEqual(["high-data", "med-inv", "med-data"]);
    expect(r.hidden.map((x) => x.id)).toEqual(["low-inv"]);
  });

  it("keeps input order between equals", () => {
    const r = budgetWarnings([w("x", "data", "low"), w("y", "data", "low")]);
    expect(r.visible.map((i) => i.id)).toEqual(["x", "y"]);
  });

  it("never lets plumbing take a slot or outrank an investment warning", () => {
    const r = budgetWarnings([
      w("ollama", "infrastructure", "high"),
      w("worker", "infrastructure", "high"),
      w("concentration", "investment", "low"),
    ]);
    expect(r.visible.map((x) => x.id)).toEqual(["concentration"]);
    expect(r.infrastructure.map((x) => x.id)).toEqual(["ollama", "worker"]);
    expect(r.hidden).toEqual([]);
  });

  it("drops duplicate ids", () => {
    const r = budgetWarnings([w("a", "data", "low"), w("a", "data", "low")]);
    expect(r.visible).toHaveLength(1);
  });

  it("handles an empty list and a zero budget", () => {
    expect(budgetWarnings([])).toEqual({ visible: [], hidden: [], infrastructure: [] });
    const r = budgetWarnings([w("a", "data", "low")], 0);
    expect(r.visible).toEqual([]);
    expect(r.hidden).toHaveLength(1);
  });
});
