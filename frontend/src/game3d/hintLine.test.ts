import { describe, expect, it } from "vitest";
import { HINT_TEXT, HINT_VISITS, countVisit, hintWanted } from "./hintLine";

function memory(initial?: string) {
  let value = initial ?? null;
  return {
    getItem: () => value,
    setItem: (_k: string, v: string) => {
      value = v;
    },
  };
}

describe("hint line visits", () => {
  it("shows on the first visits and is clear after", () => {
    expect(hintWanted(1)).toBe(true);
    expect(hintWanted(HINT_VISITS)).toBe(true);
    expect(hintWanted(HINT_VISITS + 1)).toBe(false);
  });

  it("counts each visit and remembers the count", () => {
    const store = memory();
    expect([countVisit(store), countVisit(store), countVisit(store), countVisit(store)]).toEqual([1, 2, 3, 4]);
  });

  it("treats junk in storage as no visits yet", () => {
    expect(countVisit(memory("banana"))).toBe(1);
    expect(countVisit(memory("-4"))).toBe(1);
  });

  it("shows the hint when storage is missing or throws", () => {
    expect(countVisit(null)).toBe(1);
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(countVisit(broken)).toBe(1);
  });

  it("does not repeat the toolbar keys", () => {
    expect(HINT_TEXT).not.toMatch(/\bQ quests|\bT towers|\bG where/);
  });
});
