import { describe, expect, it } from "vitest";
import { practiceTiers } from "./practiceCompanyV1";
import {
  CHECKS,
  CHECK_ORDER,
  PAGES,
  STORM_CHOICES,
  STORM_RIGHT,
  WHY_CHIPS,
  WRONG_CHIPS,
  answerCheck,
  arrived,
  atEnd,
  bannerUp,
  bookFull,
  checkDone,
  checkWaiting,
  emptyStarter,
  factPointedAt,
  flagOf,
  gaugeOf,
  goalOf,
  owesShown,
  parseStarter,
  pickCompany,
  pickWhy,
  plainSeen,
  playAgain,
  priceOf,
  rightOf,
  sheetPinned,
  stormChange,
  stormCame,
  wallsOf,
  whyRow,
  whyWaiting,
} from "./starterPlanV4";
import type { CheckBeat, StarterSaved } from "./starterPlanV4";

/** Plays the four checks with the right answer each time (the storm's right answer for this run). */
function playChecks(s: StarterSaved): StarterSaved {
  let out = s;
  for (const c of CHECK_ORDER) out = answerCheck(out, c, rightOf(out.run, c)).saved;
  return out;
}
const atWhy = (): StarterSaved => playChecks(pickCompany(arrived(emptyStarter())));
const pin = (s: StarterSaved, a: string = WHY_CHIPS[0], b: string = WRONG_CHIPS[0]) => pickWhy(pickWhy(s, a).saved, b).saved;
const finished = (): StarterSaved => pin(atWhy());
/** A second run, played up to the second storm's card. */
function atSecondStorm(): StarterSaved {
  let s = pickCompany(playAgain(finished()));
  for (const c of ["walls", "moat", "price"] as const) s = answerCheck(s, c, rightOf(s.run, c)).saved;
  return s;
}

describe("the storm's right answer depends on the run (#496)", () => {
  it("is worked out from Pip's numbers: only the price in the first storm, owes more in the second", () => {
    expect(STORM_RIGHT).toEqual({ first: "price", second: "owes" });
    expect(rightOf(atWhy().run, "storm")).toBe("price");
    expect(rightOf(atSecondStorm().run, "storm")).toBe("owes");
  });

  it("judges 'worse' by what Pip's makes in a year, not by its worth", () => {
    const calm = { owes: 5, wall: "granite" as const, earnings: 10 };
    expect(stormChange(calm, { ...calm, earnings: 7 })).toBe("worse");
    expect(stormChange(calm, calm)).toBe("price");
    // The second storm lowers the worth of a piece (the new loan) but it is the debt that changed.
    expect(practiceTiers("secondStorm").worth.middle).toBeLessThan(practiceTiers("calm").worth.middle);
    expect(stormChange(calm, { owes: 15, wall: "brick", earnings: 10 })).toBe("owes");
  });

  it("no fixed key pattern wins the second run either", () => {
    const slots = CHECK_ORDER.map((c: CheckBeat) => (CHECKS[c].choices as readonly string[]).indexOf(c === "storm" ? STORM_RIGHT.second : CHECKS[c].right));
    for (let i = 1; i < slots.length; i++) expect(slots[i], CHECK_ORDER[i]).not.toBe(slots[i - 1]);
    for (const a of [0, 1, 2]) for (const b of [0, 1, 2]) if (a !== b) expect(slots.every((x) => [a, b].includes(x)), `${a},${b}`).toBe(false);
    expect(STORM_CHOICES.indexOf(STORM_RIGHT.second)).not.toBe(STORM_CHOICES.indexOf(STORM_RIGHT.first));
  });
});

describe("beat 6b: the second storm", () => {
  it("only comes after Play again; the first run always gets the clean storm", () => {
    expect(atWhy().run.second).toBeUndefined();
    expect(playAgain(finished()).run.second).toBe(true);
  });

  it("when it hits: owes 15 on the card, brick walls, price 4.9, the gauge still a bargain", () => {
    const s = atSecondStorm();
    expect(checkWaiting(s.run)).toBe("storm");
    expect(stormCame(s.run)).toBe(true);
    expect(owesShown(s.run)).toBe(15);
    expect(wallsOf(s.run)).toBe("brick");
    expect(priceOf(s.run)).toBe(4.9);
    expect(gaugeOf(s.run)).toBe("bargain");
    // Before the storm, the second run looks like the first: granite, owes 5.
    let before = pickCompany(playAgain(finished()));
    for (const c of ["walls", "moat"] as const) before = answerCheck(before, c, rightOf(before.run, c)).saved;
    expect(wallsOf(before.run)).toBe("granite");
    expect(owesShown(before.run)).toBe(5);
  });

  it("'Only the price' is wrong now and points at the Owes card; 'worse' points at year 3", () => {
    const s = atSecondStorm();
    const miss = answerCheck(s, "storm", "price");
    expect(miss.outcome).toEqual({ kind: "miss" });
    expect(factPointedAt(miss.saved.run)).toBe(3);
    expect(factPointedAt(answerCheck(s, "storm", "worse").saved.run)).toBe(2);
    const right = answerCheck(miss.saved, "storm", "owes");
    expect(right.outcome).toEqual({ kind: "done", right: true, page: "held" });
    expect(right.saved.run.beat).toBe("why");
  });

  it("a right answer earns the Storms page if the first storm missed it, so the Book can still be filled", () => {
    let s = pickCompany(arrived(emptyStarter()));
    for (const c of ["walls", "moat", "price"] as const) s = answerCheck(s, c, rightOf(s.run, c)).saved;
    s = answerCheck(answerCheck(s, "storm", "worse").saved, "storm", "owes").saved;
    expect(s.pages).not.toContain("storms");
    s = pin(s);
    expect(bookFull(s)).toBe(false);
    expect(s.banner).toBeUndefined();
    let again = pickCompany(playAgain(s));
    for (const c of ["walls", "moat", "price"] as const) again = answerCheck(again, c, rightOf(again.run, c)).saved;
    const out = answerCheck(again, "storm", "owes");
    expect(out.outcome).toEqual({ kind: "done", right: true, page: "new" });
    const end = pin(out.saved);
    expect(bookFull(end)).toBe(true);
    expect(end.banner).toBe("now");
    expect(bannerUp(end)).toBe(true);
  });
});

describe("beat 7: pin your why", () => {
  it("one row at a time; the first chip writes half the sheet and pins nothing", () => {
    const s = atWhy();
    expect(whyWaiting(s.run)).toBe(true);
    expect(whyRow(s.run)).toBe("why");
    expect(goalOf(s.run)).toBe("why");
    // A chip from the wrong row does nothing.
    expect(pickWhy(s, WRONG_CHIPS[1]).outcome).toEqual({ kind: "ignored" });
    const half = pickWhy(s, "recipe");
    expect(half.outcome).toEqual({ kind: "half" });
    expect(whyRow(half.saved.run)).toBe("wrong");
    expect(sheetPinned(half.saved.run)).toBe(false);
    expect(flagOf(half.saved.run)).toBe("none");
    expect(half.saved.finished).toBe(false);
  });

  it("any chip in each row is fine: the second pins the sheet, raises the flag and earns the page", () => {
    for (const a of WHY_CHIPS) for (const b of WRONG_CHIPS) {
      const out = pickWhy(pickWhy(atWhy(), a).saved, b);
      expect(out.outcome).toEqual({ kind: "pinned", page: "new", banner: true });
      expect(out.saved.run.picks.why).toEqual([a, b]);
      expect(flagOf(out.saved.run)).toBe("intact");
      expect(out.saved.pages).toContain("why");
    }
  });
});

describe("beat 8 and Play again", () => {
  it("reaching the end sets finished, whatever the pages; all five give the banner once", () => {
    const s = finished();
    expect(atEnd(s.run)).toBe(true);
    expect(goalOf(s.run)).toBe("end");
    expect(s.finished).toBe(true);
    expect([...s.pages].sort()).toEqual([...PAGES].sort());
    expect(bannerUp(s)).toBe(true);
    expect(plainSeen(s.run).why).toBe(true);
  });

  it("Play again keeps the pages, starts at Sal's counter, and never gives the banner or cheer again", () => {
    const s = playAgain(finished());
    expect(s.run).toEqual({ beat: "pick", picks: {}, second: true });
    expect([...s.pages].sort()).toEqual([...PAGES].sort());
    expect(s.finished).toBe(true);
    expect(s.banner).toBe("done");
    const end = pin(playChecks(pickCompany(s)));
    expect(atEnd(end.run)).toBe(true);
    expect(bannerUp(end)).toBe(false);
    expect(end.banner).toBe("done");
    // A page already held gives "Already in your book.", never a new plate.
    expect(pickWhy(pickWhy(playChecks(pickCompany(s)), "money").saved, "owing").outcome).toEqual({ kind: "pinned", page: "held", banner: false });
  });

  it("Play again only acts at the end", () => {
    const s = atWhy();
    expect(playAgain(s)).toBe(s);
  });
});

describe("saving and loading", () => {
  it("a finished second run reloads as it was", () => {
    const s = atSecondStorm();
    const back = parseStarter(JSON.stringify(s));
    expect(back.run).toEqual(s.run);
    expect(back.banner).toBe("done");
    expect(checkDone(back.run, "storm")).toBe(false);
  });

  it("drops a second-run flag nobody earned, and an end with no pinned why goes back to the why", () => {
    const fake = { pages: [], finished: false, run: { beat: "walls", picks: { company: "pip" }, second: true } };
    expect(parseStarter(JSON.stringify(fake)).run.second).toBeUndefined();
    const s = atWhy();
    const early = parseStarter(JSON.stringify({ ...s, run: { ...s.run, beat: "end", picks: { ...s.run.picks, why: ["money"] } } }));
    expect(early.run.beat).toBe("why");
    expect(early.run.picks.why).toEqual(["money"]);
    expect(parseStarter(JSON.stringify({ ...s, run: { ...s.run, picks: { ...s.run.picks, why: ["nope", "owing"] } } })).run.picks.why).toBeUndefined();
  });

  it("a V3 save (no V4 fields) still loads, and a saved banner word other than now or done is dropped", () => {
    const v3 = { pages: ["walls"], finished: false, skipped: false, run: { beat: "moat", picks: { company: "pip", walls: ["granite"] } } };
    const back = parseStarter(JSON.stringify(v3));
    expect(back.run.beat).toBe("moat");
    expect(parseStarter(JSON.stringify({ ...v3, banner: "yes" })).banner).toBeUndefined();
  });
});
