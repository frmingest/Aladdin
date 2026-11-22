import { describe, expect, it } from "vitest";
import { BOOTHS } from "./boothPlan";
import { DESK } from "./deskLogic";
import { NPCS } from "./npcs";
import { REALM_POST } from "./realmPlan";
import {
  EMPTY_GUIDE,
  GUIDE_STEPS,
  GUIDE_STORAGE_KEY,
  giverOf,
  guideMarks,
  guideStatus,
  loadGuide,
  markSalVisited,
  guideLeft,
  guideTicked,
  markSkyRead,
  markWeatherVisited,
  onGuideTalk,
  replayGuide,
  saveGuide,
} from "./guideQuests";
import type { GuideFacts, GuideSaved } from "./guideQuests";

const NONE: GuideFacts = { stalls: 0, whys: 0 };
const UNKNOWN: GuideFacts = { stalls: null, whys: null };

function memory() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
}

describe("guide levels", () => {
  it("starts at level 0 with the first step open", () => {
    const s = guideStatus(EMPTY_GUIDE, NONE);
    expect(s.level).toBe(0);
    expect(s.current).toBe("meet");
  });

  it("needs both advisors for step 1", () => {
    const one = onGuideTalk(EMPTY_GUIDE, NONE, "oracle");
    expect(guideStatus(one, NONE).level).toBe(0);
    const both = onGuideTalk(one, NONE, "partner");
    expect(guideStatus(both, NONE).level).toBe(1);
    expect(guideStatus(both, NONE).current).toBe("sal");
  });

  it("counts steps in a row, so a later step done early does not lift the level", () => {
    const s: GuideSaved = { ...EMPTY_GUIDE, weatherVisited: true };
    const st = guideStatus(s, NONE);
    expect(st.level).toBe(0);
    expect(st.done.weather).toBe(true);
  });

  it("walks 1 to 5 with real facts for the stall and the why", () => {
    let s = onGuideTalk(onGuideTalk(EMPTY_GUIDE, NONE, "oracle"), NONE, "partner");
    s = markSalVisited(s);
    expect(guideStatus(s, NONE).current).toBe("stall");
    expect(guideStatus(s, { stalls: 1, whys: 0 }).current).toBe("weather");
    s = markWeatherVisited(s);
    expect(guideStatus(s, { stalls: 1, whys: 0 }).current).toBe("why");
    const done = guideStatus(s, { stalls: 1, whys: 1 });
    expect(done.level).toBe(5);
    expect(done.current).toBeNull();
  });

  it("keeps a step open while its fact is unknown (loading, unreadable, sample fortress)", () => {
    let s = onGuideTalk(onGuideTalk(EMPTY_GUIDE, UNKNOWN, "oracle"), UNKNOWN, "partner");
    s = markSalVisited(s);
    expect(guideStatus(s, UNKNOWN).current).toBe("stall");
  });
});

describe("handing steps over", () => {
  it("the second advisor you meet may complete step 1 and be the giver of step 2", () => {
    const first = onGuideTalk(EMPTY_GUIDE, NONE, "partner");
    expect(first.taken).toEqual([]);
    const second = onGuideTalk(first, NONE, "oracle");
    expect(second.taken).toEqual(["sal"]);
  });

  it("the other advisor does not take a step they do not give", () => {
    const met = onGuideTalk(onGuideTalk(EMPTY_GUIDE, NONE, "partner"), NONE, "oracle");
    const again = onGuideTalk(met, NONE, "partner");
    expect(again.taken).toEqual(["sal"]);
  });

  it("Marlie hands over the weather step, Barren the why step", () => {
    expect(giverOf("weather")).toBe("partner");
    expect(giverOf("why")).toBe("oracle");
    expect(giverOf("stall")).toBe("sal");
    expect(giverOf("meet")).toBeNull();
  });

  it("never adds the same thing twice", () => {
    const a = onGuideTalk(onGuideTalk(EMPTY_GUIDE, NONE, "oracle"), NONE, "oracle");
    expect(a.met).toEqual(["oracle"]);
    expect(markSalVisited(markSalVisited(EMPTY_GUIDE))).toEqual({ ...EMPTY_GUIDE, salVisited: true });
  });
});

describe("replay", () => {
  it("asks for one more stall and one more why than there are now", () => {
    const r = replayGuide({ stalls: 3, whys: 8 });
    expect(guideStatus(r, { stalls: 3, whys: 8 }).level).toBe(0);
    let s = onGuideTalk(onGuideTalk(r, NONE, "oracle"), NONE, "partner");
    s = markSalVisited(s);
    expect(guideStatus(s, { stalls: 3, whys: 8 }).current).toBe("stall");
    expect(guideStatus(s, { stalls: 4, whys: 8 }).current).toBe("weather");
  });
});

describe("saving", () => {
  it("round-trips", () => {
    const m = memory();
    const s = onGuideTalk(EMPTY_GUIDE, NONE, "oracle");
    saveGuide(m, s);
    expect(loadGuide(m)).toEqual(s);
  });

  it("ignores junk and never throws", () => {
    const m = memory();
    m.setItem(GUIDE_STORAGE_KEY, "{not json");
    expect(loadGuide(m)).toEqual(EMPTY_GUIDE);
    m.setItem(GUIDE_STORAGE_KEY, JSON.stringify({ met: ["oracle", "ghost", 3], taken: ["why", "nope"], salVisited: "yes", baseline: { stalls: "x" } }));
    expect(loadGuide(m)).toEqual({ ...EMPTY_GUIDE, met: ["oracle"], taken: ["why"] });
    expect(loadGuide(null)).toEqual(EMPTY_GUIDE);
    expect(() => saveGuide({ getItem: () => null, setItem: () => { throw new Error("full"); } }, EMPTY_GUIDE)).not.toThrow();
  });
});

describe("marks", () => {
  const talk = (s: GuideSaved, f: GuideFacts, id: "oracle" | "partner") => onGuideTalk(s, f, id);

  it("marks both advisors until each has been met", () => {
    expect(guideMarks(guideStatus(EMPTY_GUIDE, NONE), EMPTY_GUIDE).map((m) => m.key).sort()).toEqual(["head-oracle", "head-partner"]);
    const s = talk(EMPTY_GUIDE, NONE, "oracle");
    expect(guideMarks(guideStatus(s, NONE), s).map((m) => m.key)).toEqual(["head-partner"]);
  });

  it("puts the mark over Barren after step 1, then over Sal's counter once he has handed it over", () => {
    const met = talk(talk(EMPTY_GUIDE, NONE, "partner"), NONE, "oracle");
    // Barren was the second advisor, so he has already handed step 2 over: the mark is on the counter.
    expect(guideMarks(guideStatus(met, NONE), met).map((m) => m.key)).toEqual(["sal"]);
    const metOther = talk(talk(EMPTY_GUIDE, NONE, "oracle"), NONE, "partner");
    // Marlie was second, so Barren has not handed it over yet: the mark is over his head.
    expect(guideMarks(guideStatus(metOther, NONE), metOther).map((m) => m.key)).toEqual(["head-oracle"]);
  });

  it("lights the pole by the keep and the desk only after the step is taken", () => {
    const base = markSalVisited(talk(talk(EMPTY_GUIDE, NONE, "oracle"), NONE, "partner"));
    const f = { stalls: 1, whys: 0 };
    expect(guideMarks(guideStatus(base, f), base).map((m) => m.key)).toEqual(["head-partner"]);
    const taken = talk(base, f, "partner");
    expect(guideMarks(guideStatus(taken, f), taken).map((m) => m.key)).toEqual(["sky"]);
    const sky = guideMarks(guideStatus(taken, f), taken)[0];
    expect([sky.x, sky.z]).toEqual([REALM_POST.x, REALM_POST.z]);
    const atWhy = talk(markSkyRead(taken), f, "partner");
    expect(guideMarks(guideStatus(atWhy, f), atWhy).map((m) => m.key)).toEqual(["head-oracle"]);
    const whyTaken = talk(atWhy, f, "oracle");
    expect(guideMarks(guideStatus(whyTaken, f), whyTaken).map((m) => m.key)).toEqual(["desk"]);
  });

  it("shows nothing when all five are done", () => {
    const all: GuideSaved = { ...EMPTY_GUIDE, met: ["oracle", "partner"], salVisited: true, weatherVisited: true };
    const f = { stalls: 2, whys: 2 };
    expect(guideMarks(guideStatus(all, f), all)).toEqual([]);
  });

  it("floats over the real things: the people, Sal's roof, the desk", () => {
    const heads = guideMarks(guideStatus(EMPTY_GUIDE, NONE), EMPTY_GUIDE);
    for (const m of heads) {
      const n = NPCS.find((p) => `head-${p.id}` === m.key);
      expect(n).toBeDefined();
      expect(m.x).toBe(n?.x);
      expect(m.z).toBe(n?.z);
      expect(m.y).toBeGreaterThan((n?.height ?? 0) + 0.5);
    }
    const sal = BOOTHS.find((b) => b.id === "sal");
    const stall = guideMarks({ level: 2, done: { meet: true, sal: true, stall: false, weather: false, why: false }, current: "stall" }, EMPTY_GUIDE);
    expect(stall).toHaveLength(1);
    expect([stall[0].x, stall[0].z]).toEqual([sal?.x, sal?.z]);
    const why = guideMarks({ level: 4, done: { meet: true, sal: true, stall: true, weather: true, why: false }, current: "why" }, { ...EMPTY_GUIDE, taken: ["why"] });
    expect([why[0].x, why[0].z]).toEqual([DESK.x, DESK.z]);
  });

  it("has exactly five steps", () => {
    expect(GUIDE_STEPS).toHaveLength(5);
  });
});

describe("step 4 reads the sky (#478)", () => {
  const before4: GuideSaved = { ...EMPTY_GUIDE, met: ["oracle", "partner"], salVisited: true };
  const f = { stalls: 1, whys: 0 };

  it("is done by reading the pole by the keep, not by walking into the Weather Tower", () => {
    expect(guideStatus(before4, f).current).toBe("weather");
    expect(guideStatus(markSkyRead(before4), f).current).toBe("why");
  });

  it("an old save that already went into the Weather Tower keeps its tick", () => {
    expect(guideStatus(markWeatherVisited(before4), f).done.weather).toBe(true);
  });

  it("remembers the sky read in this browser, and an old save without it reads as not yet", () => {
    const store = new Map<string, string>();
    const m = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    saveGuide(m, markSkyRead(before4));
    expect(loadGuide(m).skyRead).toBe(true);
    store.set(GUIDE_STORAGE_KEY, JSON.stringify({ met: [], taken: [], salVisited: true, weatherVisited: false }));
    expect(loadGuide(m).skyRead).toBe(false);
  });
});

describe("counting what the panel shows (#478)", () => {
  it("counts every tick, not only a run from step 1", () => {
    // The live case: step 3 ticked (a stall exists) while steps 1 and 2 are open. v1 said "0 of 5".
    const st = guideStatus(EMPTY_GUIDE, { stalls: 2, whys: 0 });
    expect(st.level).toBe(0);
    expect(guideTicked(st)).toBe(1);
    expect(guideLeft(st)).toBe(4);
  });

  it("has nothing left once all five are done", () => {
    const all: GuideSaved = { ...EMPTY_GUIDE, met: ["oracle", "partner"], salVisited: true, skyRead: true };
    const st = guideStatus(all, { stalls: 1, whys: 1 });
    expect(st.current).toBeNull();
    expect(guideTicked(st)).toBe(5);
    expect(guideLeft(st)).toBe(0);
  });
});
