import { describe, expect, it } from "vitest";
import {
  STARTER_KEY,
  arrived,
  counterWaiting,
  emptyStarter,
  goalOf,
  loadStarter,
  parseStarter,
  pickCompany,
  plainSeen,
  saveStarter,
  towerStands,
} from "./starterPlanV1";

function memory(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
    key: (i) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  };
}

describe("starter plan v1 (#493): beats 1 and 2", () => {
  it("starts at the arrival, with the counter waiting and no tower", () => {
    const s = emptyStarter();
    expect(s.run.beat).toBe("arrive");
    expect(counterWaiting(s.run)).toBe(true);
    expect(towerStands(s.run)).toBe(false);
    expect(goalOf(s.run)).toBe("build");
    expect(plainSeen(s.run)).toEqual({ company: false, pieces: false });
  });

  it("arriving opens the pick; arriving again changes nothing", () => {
    const a = arrived(emptyStarter());
    expect(a.run.beat).toBe("pick");
    expect(arrived(a)).toBe(a);
  });

  it("picking raises the tower and points to the walls; a second pick does nothing", () => {
    const p = pickCompany(arrived(emptyStarter()));
    expect(p.run).toEqual({ beat: "walls", picks: { company: "pip" } });
    expect(towerStands(p.run)).toBe(true);
    expect(counterWaiting(p.run)).toBe(false);
    expect(goalOf(p.run)).toBe("walls");
    expect(plainSeen(p.run)).toEqual({ company: true, pieces: true });
    expect(pickCompany(p)).toBe(p);
    expect(arrived(p)).toBe(p);
  });

  it("picking straight from the arrival (E at the counter early) also works", () => {
    expect(pickCompany(emptyStarter()).run.beat).toBe("walls");
  });

  it("unlocks no Book page and sets no flag in beats 1 and 2", () => {
    const p = pickCompany(emptyStarter());
    expect(p.pages).toEqual([]);
    expect(p.finished).toBe(false);
    expect(p.skipped).toBe(false);
    expect(p.status).toBeUndefined();
  });
});

describe("saving: one key, this browser only", () => {
  it("round-trips through its own key and nothing else", () => {
    const st = memory();
    const s = pickCompany(emptyStarter());
    expect(saveStarter(st, s)).toBe(true);
    expect(st.length).toBe(1);
    expect(st.key(0)).toBe(STARTER_KEY);
    expect(loadStarter(st)).toEqual(s);
  });

  it("reads a damaged or missing value as a fresh start, never an error", () => {
    for (const raw of [null, "", "{", "[]", "42", '{"run":{"beat":"dance"}}', '{"pages":["walls","nope","walls"]}']) {
      const s = parseStarter(raw);
      expect(s.run.beat).toBe("arrive");
      expect(s.pages.every((p) => p === "walls")).toBe(true);
      expect(new Set(s.pages).size).toBe(s.pages.length);
    }
  });

  it("a run past the pick with nothing picked starts again rather than draw a tower nobody chose", () => {
    expect(parseStarter('{"run":{"beat":"walls","picks":{}}}').run.beat).toBe("arrive");
  });

  it("blocked storage: loads empty and saving says no, without throwing", () => {
    const blocked = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(loadStarter(blocked).run.beat).toBe("arrive");
    expect(saveStarter(blocked, emptyStarter())).toBe(false);
    expect(saveStarter(null, emptyStarter())).toBe(false);
  });
});
