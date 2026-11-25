import { describe, expect, it } from "vitest";
import { practiceTiers } from "./practiceCompanyV1";
import {
  CHECKS,
  STARTER_KEY,
  answerCheck,
  arrived,
  bookOffered,
  checkDone,
  checkWaiting,
  choicesLeft,
  emptyStarter,
  factCardsShown,
  goalOf,
  lastMiss,
  loadStarter,
  moatOf,
  parseStarter,
  pickCompany,
  plainSeen,
  saveStarter,
  wallsOf,
} from "./starterPlanV2";
import type { CheckBeat, StarterSaved } from "./starterPlanV2";
import { parseStarter as parseStarterV1, pickCompany as pickCompanyV1, emptyStarter as emptyV1 } from "./starterPlanV1";

const picked = (): StarterSaved => pickCompany(arrived(emptyStarter()));
const pick = (s: StarterSaved, beat: CheckBeat, choice: string) => answerCheck(s, beat, choice);

describe("starter plan v2 (#494): the right answers come from the real rules", () => {
  it("walls: the right answer is the wall the real v1 rule gives Pip's numbers (granite)", () => {
    expect(CHECKS.walls.right).toBe(practiceTiers().wall);
    expect(CHECKS.walls.right).toBe("granite");
  });

  it("moat: the right answer is the secret recipe (Pip's narrow moat); the other two anyone can copy", () => {
    expect(CHECKS.moat.right).toBe("recipe");
    expect(practiceTiers().moat).toBe("narrow");
  });

  it("each check has three choices, the right one among them, and unlocks its own page", () => {
    for (const b of ["walls", "moat"] as const) {
      expect(CHECKS[b].choices).toHaveLength(3);
      expect(CHECKS[b].choices).toContain(CHECKS[b].right);
      expect(CHECKS[b].page).toBe(b);
    }
  });
});

describe("beat 3: knock on the walls", () => {
  it("after the pick the walls card waits, the tower is in fog and the fact cards stand", () => {
    const s = picked();
    expect(checkWaiting(s.run)).toBe("walls");
    expect(goalOf(s.run)).toBe("walls");
    expect(wallsOf(s.run)).toBe("unsurveyed");
    expect(moatOf(s.run)).toBe("unsurveyed");
    expect(factCardsShown(s.run)).toBe(true);
    expect(plainSeen(s.run)).toEqual({ company: true, pieces: true, leftOver: true, owes: true, walls: false, moat: false });
  });

  it("right first time: granite walls, the Walls page unlocks, the moat card is next", () => {
    const { saved, outcome } = pick(picked(), "walls", "granite");
    expect(outcome).toEqual({ kind: "done", right: true, page: "new" });
    expect(saved.pages).toEqual(["walls"]);
    expect(wallsOf(saved.run)).toBe("granite");
    expect(saved.run.beat).toBe("moat");
    expect(checkWaiting(saved.run)).toBe("moat");
    expect(goalOf(saved.run)).toBe("moat");
    expect(plainSeen(saved.run).walls).toBe(true);
  });

  it("one miss: the hint shows, the walls stay in fog, the tried choice leaves the card", () => {
    const { saved, outcome } = pick(picked(), "walls", "timber");
    expect(outcome).toEqual({ kind: "miss" });
    expect(wallsOf(saved.run)).toBe("unsurveyed");
    expect(lastMiss(saved.run, "walls")).toBe("timber");
    expect(choicesLeft(saved.run, "walls")).toEqual(["granite", "rotted"]);
    expect(checkWaiting(saved.run)).toBe("walls");
  });

  it("right on the second try still earns the page", () => {
    const one = pick(picked(), "walls", "rotted").saved;
    const { saved, outcome } = pick(one, "walls", "granite");
    expect(outcome).toEqual({ kind: "done", right: true, page: "new" });
    expect(saved.pages).toEqual(["walls"]);
  });

  it("two misses: the answer is shown, the walls turn granite anyway, the page stays locked", () => {
    const one = pick(picked(), "walls", "timber").saved;
    const { saved, outcome } = pick(one, "walls", "rotted");
    expect(outcome).toEqual({ kind: "done", right: false, page: "locked" });
    expect(saved.pages).toEqual([]);
    expect(wallsOf(saved.run)).toBe("granite");
    expect(saved.run.beat).toBe("moat");
  });

  it("the same wrong choice twice, a choice that is not on the card, or another beat's card does nothing", () => {
    const one = pick(picked(), "walls", "timber").saved;
    expect(pick(one, "walls", "timber")).toEqual({ saved: one, outcome: { kind: "ignored" } });
    expect(pick(one, "walls", "basalt").outcome).toEqual({ kind: "ignored" });
    expect(pick(one, "moat", "recipe").outcome).toEqual({ kind: "ignored" });
    expect(pick(emptyStarter(), "walls", "granite").outcome).toEqual({ kind: "ignored" });
  });

  it("a page already in the book gives no new page and is never lost", () => {
    const s = { ...picked(), pages: ["walls" as const] };
    const { saved, outcome } = pick(s, "walls", "granite");
    expect(outcome).toEqual({ kind: "done", right: true, page: "held" });
    expect(saved.pages).toEqual(["walls"]);
    const missed = pick(pick(s, "walls", "timber").saved, "walls", "rotted");
    expect(missed.outcome).toEqual({ kind: "done", right: false, page: "held" });
    expect(missed.saved.pages).toEqual(["walls"]);
  });
});

describe("beat 4: fill the moat", () => {
  const atMoat = () => pick(picked(), "walls", "granite").saved;

  it("right: a narrow moat, the Moat page, and the goal points to the price", () => {
    const { saved, outcome } = pick(atMoat(), "moat", "recipe");
    expect(outcome).toEqual({ kind: "done", right: true, page: "new" });
    expect(saved.pages).toEqual(["walls", "moat"]);
    expect(moatOf(saved.run)).toBe("narrow");
    expect(saved.run.beat).toBe("price");
    expect(goalOf(saved.run)).toBe("price");
    expect(checkWaiting(saved.run)).toBeNull();
    expect(plainSeen(saved.run)).toEqual({ company: true, pieces: true, leftOver: true, owes: true, walls: true, moat: true });
  });

  it("a miss keeps the moat as mist; two misses fill it anyway and keep the page locked", () => {
    const one = pick(atMoat(), "moat", "sign");
    expect(one.outcome).toEqual({ kind: "miss" });
    expect(moatOf(one.saved.run)).toBe("unsurveyed");
    const two = pick(one.saved, "moat", "cheap");
    expect(two.outcome).toEqual({ kind: "done", right: false, page: "locked" });
    expect(moatOf(two.saved.run)).toBe("narrow");
    expect(two.saved.pages).toEqual(["walls"]);
  });
});

describe("saving and loading (same key, same shape as v1)", () => {
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

  it("round-trips a run with tries through the one key", () => {
    const st = memory();
    const s = pick(pick(picked(), "walls", "timber").saved, "walls", "granite").saved;
    expect(saveStarter(st, s)).toBe(true);
    expect(st.length).toBe(1);
    expect(st.key(0)).toBe(STARTER_KEY);
    expect(loadStarter(st)).toEqual(s);
  });

  it("reads a build-1 save (tower standing, walls waiting) as it was", () => {
    const v1 = JSON.stringify(pickCompanyV1(emptyV1()));
    const s = parseStarter(v1);
    expect(s.run).toEqual({ beat: "walls", picks: { company: "pip" } });
    expect(checkWaiting(s.run)).toBe("walls");
  });

  it("a v1 reader still reads a v2 save's beat, company and pages (nothing it knew is renamed)", () => {
    const s = pick(picked(), "walls", "granite").saved;
    const back = parseStarterV1(JSON.stringify(s));
    expect(back.pages).toEqual(["walls"]);
    expect(back.run.picks.company).toBe("pip");
  });

  it("a damaged value is a fresh start, never an error", () => {
    for (const raw of [null, "", "{", "[]", "42", "null", '{"run":{"beat":"dance"}}']) expect(parseStarter(raw)).toEqual(emptyStarter());
  });

  it("drops tries that are not choices, repeats, and anything after the right answer", () => {
    const s = parseStarter(JSON.stringify({ run: { beat: "walls", picks: { company: "pip", walls: ["timber", "timber", "nope", 3] } } }));
    expect(s.run.picks.walls).toEqual(["timber"]);
    expect(checkWaiting(s.run)).toBe("walls");
    const t = parseStarter(JSON.stringify({ run: { beat: "moat", picks: { company: "pip", walls: ["granite", "timber"] } } }));
    expect(t.run.picks.walls).toEqual(["granite"]);
  });

  it("never runs ahead of an open check, and moves past a check that is done", () => {
    // Saved at the price with the walls never answered: back to the walls, and the moat's tries go.
    const back = parseStarter(JSON.stringify({ run: { beat: "price", picks: { company: "pip", moat: ["recipe"] } } }));
    expect(back.run).toEqual({ beat: "walls", picks: { company: "pip" } });
    // Saved at the walls with the walls already answered: on to the moat.
    const on = parseStarter(JSON.stringify({ run: { beat: "walls", picks: { company: "pip", walls: ["granite"] } } }));
    expect(on.run.beat).toBe("moat");
    // A beat this build does not play yet reads as the price, if both checks are done.
    const later = parseStarter(JSON.stringify({ run: { beat: "storm", picks: { company: "pip", walls: ["granite"], moat: ["recipe"] } } }));
    expect(later.run.beat).toBe("price");
    // Past the pick with no company: start again.
    expect(parseStarter(JSON.stringify({ run: { beat: "moat", picks: { walls: ["granite"] } } })).run).toEqual({ beat: "arrive", picks: {} });
  });

  it("keeps the pages and flags as saved, with no unknown page and no repeat", () => {
    const s = parseStarter(JSON.stringify({ pages: ["moat", "walls", "moat", "nope"], finished: true, skipped: false, status: "new" }));
    expect(s.pages).toEqual(["moat", "walls"]);
    expect(s.finished).toBe(true);
    expect(s.status).toBe("new");
  });
});

describe("the Book is offered outside the yard only after the yard has been played", () => {
  it("not before the pick; yes once the tower stands or a page is held", () => {
    expect(bookOffered(emptyStarter())).toBe(false);
    expect(bookOffered(picked())).toBe(true);
    expect(bookOffered({ ...emptyStarter(), pages: ["walls"] })).toBe(true);
  });

  it("checkDone reads only the tries", () => {
    expect(checkDone(picked().run, "walls")).toBe(false);
  });
});
