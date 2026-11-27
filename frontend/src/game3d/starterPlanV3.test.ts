import { describe, expect, it } from "vitest";
import { landFor, practiceTiers } from "./practiceCompanyV1";
import {
  CHECKS,
  CHECK_ORDER,
  PRICE_CHOICES,
  STARTER_KEY,
  STORM_CHOICES,
  answerCheck,
  arrived,
  checkWaiting,
  choicesLeft,
  emptyStarter,
  factPointedAt,
  gaugeOf,
  goalOf,
  lastMiss,
  loadStarter,
  moatOf,
  parseStarter,
  pickCompany,
  plainSeen,
  priceOf,
  saveStarter,
  scaleOf,
  stormCame,
  stormChange,
  stormOverhead,
  wallsOf,
} from "./starterPlanV3";
import type { CheckBeat, StarterSaved } from "./starterPlanV3";
import { CHECKS as CHECKS_V2, parseStarter as parseStarterV2 } from "./starterPlanV2";

const picked = (): StarterSaved => pickCompany(arrived(emptyStarter()));
const pick = (s: StarterSaved, beat: CheckBeat, choice: string) => answerCheck(s, beat, choice).saved;
/** Walls and moat answered right: the price card waits. */
const atPrice = (): StarterSaved => pick(pick(picked(), "walls", "granite"), "moat", "recipe");
const atStorm = (): StarterSaved => pick(atPrice(), "price", "lots");

describe("starter plan v3 (#495): the right answers come from the real rules", () => {
  it("walls and moat are V2's checks, unchanged", () => {
    expect(CHECKS.walls).toBe(CHECKS_V2.walls);
    expect(CHECKS.moat).toBe(CHECKS_V2.moat);
  });

  it("price: Pip's price 7 is under the low guess 8, a bargain by the real zones, so 'Lots of room'", () => {
    expect(practiceTiers().land).toBe("bargain");
    expect(CHECKS.price.right).toBe("lots");
    // The other two are the real gauge's words for the zones Pip's price is not in.
    expect(landFor(9, { low: 8, middle: 10, high: 12 })).toBe("discount");
    expect(landFor(11, { low: 8, middle: 10, high: 12 })).toBe("full_price");
  });

  it("storm: worked out by comparing Pip's business before and after, so 'Only the price'", () => {
    expect(CHECKS.storm.right).toBe("price");
    expect(stormChange(practiceTiers("calm"), practiceTiers("storm"))).toBe("price");
    // The second storm (build step 4) changes what it owes: the same rule then says "It owes more now".
    expect(stormChange(practiceTiers("calm"), practiceTiers("secondStorm"))).toBe("owes");
  });

  it("each check has three choices, the right one among them, and its own page", () => {
    expect(CHECK_ORDER).toEqual(["walls", "moat", "price", "storm"]);
    expect(CHECKS.price.choices).toEqual(PRICE_CHOICES);
    expect(CHECKS.storm.choices).toEqual(STORM_CHOICES);
    expect(CHECKS.price.page).toBe("room");
    expect(CHECKS.storm.page).toBe("storms");
    for (const b of CHECK_ORDER) {
      expect(CHECKS[b].choices).toHaveLength(3);
      expect(CHECKS[b].choices).toContain(CHECKS[b].right);
    }
  });

  it("no fixed key pattern wins: every slot is right somewhere, and no card repeats the slot before it", () => {
    const slot = (b: CheckBeat) => (CHECKS[b].choices as readonly string[]).indexOf(CHECKS[b].right);
    // "Press 2, then 3" on every card used to earn every page (#495 review): now some card's answer is in each slot.
    expect(new Set(CHECK_ORDER.map(slot))).toEqual(new Set([0, 1, 2]));
    for (let i = 1; i < CHECK_ORDER.length; i++) expect(slot(CHECK_ORDER[i]), CHECK_ORDER[i]).not.toBe(slot(CHECK_ORDER[i - 1]));
    // Any two fixed slots tried in the same order on every card lose at least one page.
    for (const a of [0, 1, 2]) for (const b of [0, 1, 2]) if (a !== b) expect(CHECK_ORDER.every((c) => [a, b].includes(slot(c))), `${a},${b}`).toBe(false);
    // In the second storm (build step 4) "owes" is right: slot 2, not the first storm's slot 3.
    expect(STORM_CHOICES.indexOf("owes")).not.toBe(STORM_CHOICES.indexOf("price"));
  });
});

describe("beat 5: weigh the price", () => {
  it("after the moat the price card waits; the gauge and the scale are in mist and the price is 7", () => {
    const s = atPrice();
    expect(checkWaiting(s.run)).toBe("price");
    expect(goalOf(s.run)).toBe("price");
    expect(gaugeOf(s.run)).toBe("fog");
    expect(scaleOf(s.run)).toBe("fog");
    expect(priceOf(s.run)).toBe(7);
    expect(stormCame(s.run)).toBe(false);
    // The worth and the price are on show; the room is the answer, so its row waits.
    expect(plainSeen(s.run)).toMatchObject({ worth: true, price: true, room: false, storm: false });
  });

  it("right: the gauge reads a bargain, the scale tips, the Room page unlocks, the storm is next", () => {
    const { saved, outcome } = answerCheck(atPrice(), "price", "lots");
    expect(outcome).toEqual({ kind: "done", right: true, page: "new" });
    expect(saved.pages).toEqual(["walls", "moat", "room"]);
    expect(saved.run.beat).toBe("storm");
    expect(gaugeOf(saved.run)).toBe("bargain");
    expect(scaleOf(saved.run)).toBe("tipped");
    expect(plainSeen(saved.run).room).toBe(true);
    expect(checkWaiting(saved.run)).toBe("storm");
  });

  it("a miss keeps the mist and takes that choice off the card; two misses weigh it anyway and keep the page locked", () => {
    const one = answerCheck(atPrice(), "price", "some");
    expect(one.outcome).toEqual({ kind: "miss" });
    expect(gaugeOf(one.saved.run)).toBe("fog");
    expect(lastMiss(one.saved.run, "price")).toBe("some");
    expect(choicesLeft(one.saved.run, "price")).toEqual(["lots", "none"]);
    const two = answerCheck(one.saved, "price", "none");
    expect(two.outcome).toEqual({ kind: "done", right: false, page: "locked" });
    expect(two.saved.pages).not.toContain("room");
    expect(gaugeOf(two.saved.run)).toBe("bargain");
    expect(two.saved.run.beat).toBe("storm");
  });
});

describe("beat 6: the storm", () => {
  it("once the price is weighed the storm has come: 4.9 coins, clouds overhead, walls and moat unchanged, still a bargain", () => {
    const s = atStorm();
    expect(stormCame(s.run)).toBe(true);
    expect(stormOverhead(s.run)).toBe(true);
    expect(priceOf(s.run)).toBe(4.9);
    expect(wallsOf(s.run)).toBe("granite");
    expect(moatOf(s.run)).toBe("narrow");
    expect(gaugeOf(s.run)).toBe("bargain");
    expect(goalOf(s.run)).toBe("storm");
  });

  it("a wrong pick points at the fact card it got wrong about: year 3 for 'worse', what it owes for 'owes'", () => {
    expect(factPointedAt(atStorm().run)).toBeNull();
    expect(factPointedAt(pick(atStorm(), "storm", "worse").run)).toBe(2);
    expect(factPointedAt(pick(atStorm(), "storm", "owes").run)).toBe(3);
  });

  it("right: the Storms page unlocks, the clouds clear, the price stays 4.9 and the goal is 'Pin your why'", () => {
    const { saved, outcome } = answerCheck(atStorm(), "storm", "price");
    expect(outcome).toEqual({ kind: "done", right: true, page: "new" });
    expect(saved.pages).toEqual(["walls", "moat", "room", "storms"]);
    expect(saved.run.beat).toBe("why");
    expect(stormOverhead(saved.run)).toBe(false);
    expect(priceOf(saved.run)).toBe(4.9);
    expect(factPointedAt(saved.run)).toBeNull();
    expect(goalOf(saved.run)).toBe("why");
    expect(checkWaiting(saved.run)).toBeNull();
    expect(plainSeen(saved.run).storm).toBe(true);
  });

  it("a page already held gives no new page and is never lost", () => {
    const held = { ...atStorm(), pages: ["storms" as const] };
    const { saved, outcome } = answerCheck(held, "storm", "price");
    expect(outcome).toEqual({ kind: "done", right: true, page: "held" });
    expect(saved.pages).toEqual(["storms"]);
  });

  it("another beat's card, a repeat, or a choice not on the card does nothing", () => {
    expect(answerCheck(atPrice(), "storm", "price").outcome).toEqual({ kind: "ignored" });
    expect(answerCheck(atStorm(), "storm", "nope").outcome).toEqual({ kind: "ignored" });
    const missed = pick(atStorm(), "storm", "owes");
    expect(answerCheck(missed, "storm", "owes").outcome).toEqual({ kind: "ignored" });
  });
});

describe("saving and loading (same key, same shape)", () => {
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

  it("round-trips a run through the one key", () => {
    const st = memory();
    const s = pick(pick(atStorm(), "storm", "worse"), "storm", "price");
    expect(saveStarter(st, s)).toBe(true);
    expect(st.key(0)).toBe(STARTER_KEY);
    expect(loadStarter(st)).toEqual(s);
  });

  it("reads a build-2 save waiting at the price as it was", () => {
    const v2 = JSON.stringify({ pages: ["walls", "moat"], finished: false, skipped: false, run: { beat: "price", picks: { company: "pip", walls: ["granite"], moat: ["recipe"] } } });
    const s = parseStarter(v2);
    expect(s.run.beat).toBe("price");
    expect(checkWaiting(s.run)).toBe("price");
  });

  it("a v2 reader still reads a v3 save up to the price (nothing it knew is renamed)", () => {
    const back = parseStarterV2(JSON.stringify(atStorm()));
    expect(back.run.beat).toBe("price");
    expect(back.pages).toEqual(["walls", "moat", "room"]);
  });

  it("never runs ahead of an open check, and drops tries at a later check", () => {
    const back = parseStarter(JSON.stringify({ run: { beat: "why", picks: { company: "pip", walls: ["granite"], moat: ["recipe"], storm: ["price"] } } }));
    expect(back.run).toEqual({ beat: "price", picks: { company: "pip", walls: ["granite"], moat: ["recipe"] } });
    const on = parseStarter(JSON.stringify({ run: { beat: "price", picks: { company: "pip", walls: ["granite"], moat: ["recipe"], price: ["lots"] } } }));
    expect(on.run.beat).toBe("storm");
  });

  it("a beat this build does not play yet reads as 'Pin your why' once every check is done", () => {
    const end = parseStarter(JSON.stringify({ run: { beat: "end", picks: { company: "pip", walls: ["granite"], moat: ["recipe"], price: ["lots"], storm: ["price"] } } }));
    expect(end.run.beat).toBe("why");
  });

  it("drops tries that are not choices, repeats, and anything after the right answer", () => {
    const s = parseStarter(JSON.stringify({ run: { beat: "storm", picks: { company: "pip", walls: ["granite"], moat: ["recipe"], price: ["lots", "some"], storm: ["owes", "owes", 7] } } }));
    expect(s.run.picks.price).toEqual(["lots"]);
    expect(s.run.picks.storm).toEqual(["owes"]);
  });

  it("a damaged value is a fresh start, never an error", () => {
    for (const raw of [null, "", "{", "[]", "42", "null"]) expect(parseStarter(raw)).toEqual(emptyStarter());
  });
});
