import { describe, expect, it } from "vitest";
import { REMODEL_BANNED, gameRemodelCounts } from "./remodelWordsV1";

describe("remodelling counts in game voice", () => {
  it("keeps every count and the share, in tower words", () => {
    const out = gameRemodelCounts({ added: 2, removed: 1, resized: 3, turnover_pct: "12.4" });
    expect(out).toBe("2 towers added, 1 removed, 3 resized · about 12% of the fortress changed");
    for (const re of REMODEL_BANNED) expect(out).not.toMatch(re);
  });

  it("reads singular as singular and drops the share when the backend has none", () => {
    expect(gameRemodelCounts({ added: 1, removed: 0, resized: 0, turnover_pct: null })).toBe("1 tower added, 0 removed, 0 resized");
  });
});
