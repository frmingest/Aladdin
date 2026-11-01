import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { GameState, GameTower, Standing } from "../lib/types";
import DialoguePanel from "./DialoguePanel";
import { BARE_PADS_ORACLE, IMPORT_PATH, pointsToImport, talk } from "./dialogueV2";
import { talk as talkV1 } from "./dialogueV1";
import QuestLog from "./QuestLog";
import { COBBLE_RADIUS, KEEP, SPAWN, towerSpots } from "./layout";
import { NPCS } from "./npcs";
import { PROPS } from "./props";
import { sixMonthReckoning, unwrittenThesis } from "./quest";
import { SCENERY, SCENERY_CLEARANCE } from "./sceneryPieces";
import { withGaps } from "./standingGaps";
import { STANDING_TORCHES, STANDING_TORCH_SOLID, litTorches } from "./standingTorches";
import { standingWords } from "./standingWordsV1";
import { standingWordsV2, wordsFor } from "./standingWordsV2";
import { stateToWorld } from "./stateToWorld";
import { TOWNSFOLK } from "./townsfolk";

const standing = (over: Partial<Standing> = {}): Standing => ({
  version: "v1", demo: false, level: 2, max_level: 3, title: "The Survey",
  next_step: "Write why you own each one, and what would prove you wrong. Arm a wire.",
  gates: [], gaps: [], ...over,
});

describe("standing words v1", () => {
  it("names the level and the next step, in game voice", () => {
    const w = standingWords(standing(), false);
    expect(w.headline).toBe("Level 2 of 3: The Survey");
    expect(w.next).toContain("Arm a wire");
    expect(w.lit).toBe(2);
  });

  it("says more is to come at the top built level, and keeps it short", () => {
    const w = standingWords(standing({ level: 3, title: "Reasons", next_step: null }), false);
    expect(w.next).toMatch(/More to build/);
    for (const s of [w.headline, w.next ?? ""]) expect(s.split(/\s+/).length).toBeLessThanOrEqual(12);
  });

  it("burns no torch when the Standing is loading, unreadable, the sample or level 0", () => {
    expect(standingWords(null, false).lit).toBe(0);
    expect(standingWords(null, true)).toMatchObject({ lit: 0, headline: "Can't read your Standing right now." });
    expect(standingWords(standing({ demo: true, level: 0, title: null }), false)).toMatchObject({ lit: 0, headline: "Sample fortress: no Standing yet." });
    expect(standingWords(standing({ level: 0, title: null, next_step: "Bring in your holdings." }), false)).toMatchObject({ lit: 0, next: "Bring in your holdings." });
  });

  it("never uses buy/sell wording, cheering or a score", () => {
    const all = [standing(), standing({ level: 3, next_step: null }), standing({ level: 0, title: null }), standing({ demo: true })];
    for (const s of all) {
      const w = standingWords(s, false);
      expect(`${w.headline} ${w.next ?? ""}`).not.toMatch(/\b(buy|sell|trim|great job|well done|congrat|xp|points|streak)/i);
    }
  });
});

describe("standing torches", () => {
  it("one burns per level, never more than there are, and unknown burns none", () => {
    expect([0, 1, 2, 3, 4, 5].map(litTorches)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(litTorches(7)).toBe(5);
    expect(litTorches(-1)).toBe(0);
    expect(litTorches(null)).toBe(0);
    expect(litTorches(undefined)).toBe(0);
    expect(litTorches(Number.NaN)).toBe(0);
    expect(litTorches(2.9)).toBe(2);
  });

  it("stand on the cobbles, clear of the pads, the keep, the people, the spawn and the gate road, and are in view ahead of the spawn", () => {
    const spots = towerSpots();
    expect(STANDING_TORCHES).toHaveLength(5);
    for (const p of STANDING_TORCHES) {
      expect(Math.hypot(p.x, p.z), p.id).toBeLessThan(COBBLE_RADIUS - 0.2);
      expect(Math.abs(p.x) < 3 + STANDING_TORCH_SOLID && p.z > 26, p.id).toBe(false);
      expect(Math.hypot(p.x - KEEP.x, p.z - KEEP.z), p.id).toBeGreaterThan(SCENERY_CLEARANCE);
      for (const s of spots) expect(Math.hypot(p.x - s.x, p.z - s.z), p.id).toBeGreaterThan(1.7 + SCENERY_CLEARANCE);
      for (const n of [...NPCS, ...TOWNSFOLK]) expect(Math.hypot(p.x - n.x, p.z - n.z), p.id).toBeGreaterThan(SCENERY_CLEARANCE);
      expect(Math.hypot(p.x - SPAWN.x, p.z - SPAWN.z), p.id).toBeGreaterThan(SCENERY_CLEARANCE + 1);
      expect(p.z, p.id).toBeLessThan(SPAWN.z); // the hero spawns facing north: ahead, not behind the camera
    }
  });

  it("do not touch each other, the props or the standing scenery", () => {
    const others = [
      ...STANDING_TORCHES.map((p) => ({ id: p.id, x: p.x, z: p.z, r: STANDING_TORCH_SOLID })),
      ...PROPS.map((p) => ({ id: p.id, x: p.x, z: p.z, r: p.solid })),
      ...SCENERY.filter((p) => p.y === 0).map((p) => ({ id: p.id, x: p.x, z: p.z, r: p.solid })),
    ];
    for (let i = 0; i < others.length; i++)
      for (let j = i + 1; j < others.length; j++) {
        if (!others[i].id.startsWith("standing") && !others[j].id.startsWith("standing")) continue;
        const a = others[i];
        const b = others[j];
        expect(Math.hypot(a.x - b.x, a.z - b.z), `${a.id}/${b.id}`).toBeGreaterThan(a.r + b.r + 0.3);
      }
  });
});

const tower = (id: string, ticker: string) =>
  ({
    holding_id: id, ticker, name: ticker, instrument_type: "stock", sector: null, structure: "keep", value_nok: "1",
    weight_pct: "10", size_class: "unknown", moat: "unsurveyed", wall: "unsurveyed", wall_reason: "", wall_inputs: {},
    freshness: "unsurveyed", analysis_age_days: null, verdict_rating: null, land: "fog", land_reason: "",
    margin_of_safety_pct: null, thesis: "not_analyzed", tripwires_fired: 0, siege_exposure: "unsurveyed",
    siege_shock_pct: null, siege_method: null, shared_wall_with: [],
  }) as unknown as GameTower;
const world = stateToWorld({
  mapping_version: "v1", as_of: null, demo: false, total_value_nok: "0", notes: [], siege: null,
  towers: [tower("a", "JAREN.OL"), tower("b", "OTHER.OL")],
} as unknown as GameState);

describe("named gaps on towers", () => {
  it("label only the tower they belong to, in both lists, and leave the look alone", () => {
    const w = withGaps(world, [{ ticker: "JAREN.OL", label: "no tagged filing" }]);
    expect(w.plain.find((t) => t.ticker === "JAREN.OL")?.gap).toBe("no tagged filing");
    expect(w.plain.find((t) => t.ticker === "OTHER.OL")?.gap).toBeUndefined();
    expect(w.towers.find((t) => t.ticker === "JAREN.OL")?.gap).toBe("no tagged filing");
    const before = world.plain.find((t) => t.ticker === "JAREN.OL");
    const after = w.plain.find((t) => t.ticker === "JAREN.OL");
    expect({ ...after, gap: undefined }).toEqual({ ...before, gap: undefined });
    expect(after?.fog).toBe(true); // a gap is a label: the tower stays fog
  });

  it("returns the world untouched when there are no gaps", () => {
    expect(withGaps(world, [])).toBe(world);
  });

  it("a gap for a ticker you do not hold changes nothing", () => {
    const w = withGaps(world, [{ ticker: "ZZZ.OL", label: "x" }]);
    expect(w.plain.every((t) => t.gap === undefined)).toBe(true);
  });
});

const holdings = world.plain;
const noQuest = unwrittenThesis([], [], false);
const reviews = sixMonthReckoning([], false);

describe("courtyard dialogue v2", () => {
  it("the Oracle with bare pads says what to do first and where, in 40 words or fewer", () => {
    const text = talk("oracle", noQuest, reviews).join(" ");
    expect(text).toContain("Upload your broker export");
    expect(text.split(/\s+/).length).toBeLessThanOrEqual(40);
    expect(text).not.toMatch(/\b(buy|sell|great job|well done)/i);
    expect(pointsToImport("oracle", noQuest)).toBe(true);
    expect(BARE_PADS_ORACLE.length).toBe(2);
  });

  it("everything else is exactly as v1", () => {
    const open = unwrittenThesis(holdings, [], false);
    for (const q of [open, unwrittenThesis(holdings, null, true), unwrittenThesis(holdings, null, false)])
      for (const p of ["oracle", "partner"] as const) expect(talk(p, q, reviews)).toEqual(talkV1(p, q, reviews));
    expect(talk("partner", noQuest, reviews)).toEqual(talkV1("partner", noQuest, reviews));
    expect(pointsToImport("partner", noQuest)).toBe(false);
    expect(pointsToImport("oracle", open)).toBe(false);
  });

  it("the panel shows the import link only for the Oracle with bare pads", () => {
    const bare = renderToStaticMarkup(<DialoguePanel npc="oracle" quest={noQuest} reviews={reviews} onClose={() => {}} onRetry={() => {}} />);
    expect(bare).toContain(`href="${IMPORT_PATH}"`);
    expect(bare).toContain("Bring in my holdings");
    const partner = renderToStaticMarkup(<DialoguePanel npc="partner" quest={noQuest} reviews={reviews} onClose={() => {}} onRetry={() => {}} />);
    expect(partner).not.toContain(IMPORT_PATH);
  });
});

describe("Quest log Standing card", () => {
  const render = (s: ReturnType<typeof standingWords> | undefined) =>
    renderToStaticMarkup(
      <MemoryRouter>
        <QuestLog quest={noQuest} reviews={reviews} demo={false} standing={s} />
      </MemoryRouter>,
    );

  it("shows the level line and the next step", () => {
    const html = render(standingWords(standing(), false));
    expect(html).toContain("Standing");
    expect(html).toContain("Level 2 of 3: The Survey");
    expect(html).toContain("Arm a wire");
  });

  it("looks as it did before when no Standing is passed", () => {
    expect(render(undefined)).not.toContain('aria-label="Standing"');
  });

  it("says so when the Standing cannot be read instead of guessing a level", () => {
    const html = render(standingWords(null, true));
    expect(html).toContain("Can&#x27;t read your Standing right now.");
    expect(html).not.toContain("Level ");
  });
});

describe("standing words v2 (The Watch)", () => {
  const gate4 = (fact: string) => [{ level: 4, title: "The Watch", met: false, done: null, total: null, fact }];
  const v2 = (over: Partial<Standing> = {}): Standing =>
    standing({ version: "v2", max_level: 4, level: 3, title: "Reasons", next_step: "Keep the watch walking, and look at every wire that fires.", gates: gate4("The watch has not reported. Nothing is known."), ...over });

  it("names the level out of four and says what the watch reports once levels 1 to 3 hold", () => {
    const w = standingWordsV2(v2(), false);
    expect(w.headline).toBe("Level 3 of 4: Reasons");
    expect(w.lit).toBe(3);
    expect(w.watch).toBe("The watch has not reported. Nothing is known.");
  });

  it("lights the fourth torch only at level 4", () => {
    const w = standingWordsV2(v2({ level: 4, title: "The Watch", next_step: null, gates: gate4("The watch reports in. Every wire looked at") }), false);
    expect(w.lit).toBe(4);
    expect(w.watch).toBe("The watch reports in. Every wire looked at");
    expect(w.next).toMatch(/wire/);
    expect(litTorches(w.lit)).toBe(4);
  });

  it("says nothing about the watch below level 3, for the sample and when unreadable", () => {
    expect(standingWordsV2(v2({ level: 2, title: "The Survey" }), false).watch).toBeNull();
    expect(standingWordsV2(v2({ demo: true, level: 0, title: null }), false)).toMatchObject({ lit: 0, watch: null, headline: "Sample fortress: no Standing yet." });
    expect(standingWordsV2(null, true)).toMatchObject({ lit: 0, watch: null });
    expect(standingWordsV2(null, false)).toMatchObject({ lit: 0, watch: null });
  });

  it("stays short and never uses buy/sell wording, a score or a streak", () => {
    for (const s of [v2(), v2({ level: 4, next_step: null, gates: gate4("1 wire fired, not yet looked at") })]) {
      const w = standingWordsV2(s, false);
      for (const t of [w.headline, w.next ?? "", w.watch ?? ""]) {
        expect(t.split(/\s+/).length).toBeLessThanOrEqual(12);
        expect(t).not.toMatch(/\b(buy|sell|trim|great job|well done|congrat|xp|points|streak)/i);
      }
    }
  });

  it("wordsFor follows the version the backend served, so v1 keeps its own words", () => {
    expect(wordsFor(standing(), false)).toMatchObject({ headline: "Level 2 of 3: The Survey", watch: null });
    expect(wordsFor(v2(), false).headline).toBe("Level 3 of 4: Reasons");
    expect(wordsFor(null, true).lit).toBe(0);
  });

  it("the Quest log shows the watch line, and no line when there is none", () => {
    const render = (s: ReturnType<typeof wordsFor>) =>
      renderToStaticMarkup(<MemoryRouter><QuestLog quest={noQuest} reviews={reviews} demo={false} standing={s} /></MemoryRouter>);
    expect(render(wordsFor(v2(), false))).toContain("The watch has not reported. Nothing is known.");
    expect(render(wordsFor(standing(), false))).not.toContain("The watch");
  });
});
