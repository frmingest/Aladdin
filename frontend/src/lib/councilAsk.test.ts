import { describe, expect, it } from "vitest";
import { ASK_LABEL, COUNCIL_QUESTIONS, OTHER_ADVISOR, QUESTION_LABEL, answerNote, lecternTokens } from "./councilAsk";
import type { GameTower } from "./types";

const t = (id: string, name: string, weight: string | null) => ({ holding_id: id, name, weight_pct: weight }) as GameTower;

describe("council questions", () => {
  it("has four fixed questions and no advice wording", () => {
    expect(COUNCIL_QUESTIONS).toHaveLength(4);
    const words = [...Object.values(QUESTION_LABEL), ...Object.values(ASK_LABEL)].join(" ").toLowerCase();
    for (const w of ["buy", "sell", "trim", "add"]) expect(words).not.toMatch(new RegExp(`\\b${w}\\b`));
    expect(OTHER_ADVISOR.oracle).toBe("partner");
  });

  it("says plainly that silence and fog are not safety", () => {
    expect(answerNote({ read: "silent" })).toMatch(/not a clean bill/);
    expect(answerNote({ read: "none" })).toMatch(/Unknown is not safe/);
    expect(answerNote({ read: "read" })).toBeNull();
  });

  it("orders tokens: agenda-named first, then by weight, unknown weight last", () => {
    const towers = [t("a", "Alpha", "5"), t("b", "Beta", "20"), t("c", "Gamma", null), t("d", "Delta", "9")];
    const council = { items: [{ holdings: [{ holding_id: "a", name: "Alpha", weight_pct: "5" }] }] } as never;
    expect(lecternTokens(towers, council).map((x) => x.id)).toEqual(["a", "b", "d", "c"]);
  });
});
