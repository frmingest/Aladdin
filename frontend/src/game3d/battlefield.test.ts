import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { SiegeBacktest, SiegeBacktestHolding, StormDrill } from "../lib/types";
import {
  BAR_MAX,
  BAR_MIN,
  BATTLE_BOARD,
  BATTLE_COLORS,
  BATTLE_MAX_ROWS,
  BATTLE_X0,
  NOTE_MAX_CHARS,
  WAR_TABLE,
  WAR_TABLE_MAX_NOTES,
  barLength,
  battleExtent,
  battlefieldFor,
  boardLines,
  notesFor,
  shortNote,
  tableLines,
} from "./battlefield";
import { BATTLE_WORDS, battleMore } from "./battlefieldWordsV1";
import {
  ATTACKERS,
  ENGINES,
  FIELD_BANNERS,
  FIELD_EXIT,
  FIELD_HALF,
  FIELD_ROCKS,
  FIELD_SPAWN,
  FIELD_TENT,
  FIELD_WALL_Z,
  ghostsFor,
} from "./siegeField";
import { SIEGE_STONE, STORM_STONE, WINCH } from "./siegeFieldTools";

const row = (over: Partial<SiegeBacktestHolding> = {}): SiegeBacktestHolding => ({
  holding_id: "h1", ticker: "AAA.OL", name: "Alpha", weight_pct: "40", tested: true, verdict: "fell_more", beta: "0.50",
  beta_basis: "without_episode", predicted: "-0.0915", actual: "-0.3350", error: "-0.2440", reason: null, caution: null, ...over,
});

const bt = (holdings: SiegeBacktestHolding[] = [row()], over: Partial<SiegeBacktest> = {}): SiegeBacktest => ({
  backtest_version: "v1", scenarios_version: "v3", demo: false, benchmark_ticker: "OSEBX.OL", status: "ok", status_reason: "",
  window_start: "2024-10-14", window_end: "2026-10-12",
  episode: { peak_date: "2026-03-12", trough_date: "2026-03-26", fall: "-0.1829", trading_days: 11, recovered: false, significant: true },
  holdings, tested_count: holdings.filter((h) => h.tested).length, total_count: holdings.length, tested_value_share: "0.6667",
  close_count: 0, fell_more_count: 1, fell_less_count: 0, mean_abs_error: "0.2440", close_points: "0.05", book: null,
  book_reason: null, notes: [], ...over,
});

const many = (n: number) => Array.from({ length: n }, (_, i) => row({ holding_id: `h${i}`, name: `H${i}`, actual: "-0.10", predicted: "-0.08" }));

const drill = (over: Partial<StormDrill> = {}): StormDrill => ({
  id: "d1", market_drop: "0.30", plan: "Hold, and read the reports first.", scenarios_version: "v3", created_at: "2026-11-01T10:00:00Z", ...over,
});

describe("bars", () => {
  it("draws the length from the stored number alone, on the shared scale", () => {
    const b = battlefieldFor(bt([row({ actual: "-0.3350", predicted: "-0.0915" })]));
    expect(b.rows).toHaveLength(1);
    expect(b.rows[0].scorch).toBe(BAR_MAX);
    expect(b.rows[0].chalk).toBeCloseTo((0.0915 / 0.335) * BAR_MAX, 1);
    expect(b.rows[0].chalk).toBeLessThan(b.rows[0].scorch);
  });
  it("shows a miss as plainly as a hit: both bars are drawn, and the verdict word is printed", () => {
    const b = battlefieldFor(bt([row({ verdict: "close", actual: "-0.10", predicted: "-0.10" }), row({ holding_id: "h2", name: "Beta", verdict: "fell_less", actual: "-0.02", predicted: "-0.10" })]));
    expect(b.rows[0].scorch).toBe(b.rows[0].chalk);
    expect(b.rows[1].scorch).toBeLessThan(b.rows[1].chalk);
    expect(b.rows[0].plate).toContain("Close");
    expect(b.rows[1].plate).toContain("Fell softer");
  });
  it("draws no bar for a gain, a null or junk, and never a bar thinner than the minimum", () => {
    expect(barLength("0.04", 0.3)).toBe(0);
    expect(barLength(null, 0.3)).toBe(0);
    expect(barLength("x", 0.3)).toBe(0);
    expect(barLength("-0.0001", 0.3)).toBe(BAR_MIN);
    expect(barLength("-9", 0.3)).toBe(BAR_MAX);
  });
  it("keeps a holding the method could not test in fog: no bar, no number, a question mark", () => {
    const b = battlefieldFor(bt([row({ tested: false, verdict: "not_tested", actual: "-0.4", predicted: "-0.2", reason: "no price history stored" })]));
    expect(b.rows[0].scorch).toBe(0);
    expect(b.rows[0].chalk).toBe(0);
    expect(b.rows[0].plate).toBe(`Alpha ${BATTLE_WORDS.fogMark}`);
    expect(b.rows[0].plate).not.toMatch(/\d/);
  });
  it("lists up to twelve rows and counts the rest", () => {
    const b = battlefieldFor(bt(many(15)));
    expect(b.rows).toHaveLength(BATTLE_MAX_ROWS);
    expect(b.more).toBe(3);
    expect(boardLines({ status: "ready", value: bt(many(15)) }, b.more).at(-1)).toBe(battleMore(3));
  });
  it("is empty with no back-test or no stored fall", () => {
    expect(battlefieldFor(null).rows).toEqual([]);
    expect(battlefieldFor(bt([row()], { episode: null, status: "no_episode" })).rows).toEqual([]);
  });
  it("is deterministic and keeps the flat page's order", () => {
    const input = bt(many(5));
    expect(battlefieldFor(input)).toEqual(battlefieldFor(input));
    expect(battlefieldFor(input).rows.map((r) => r.id)).toEqual(["h0", "h1", "h2", "h3", "h4"]);
  });
  it("is the same for two holdings that differ only in their name", () => {
    const a = battlefieldFor(bt([row({ name: "Alpha" })])).rows[0];
    const b = battlefieldFor(bt([row({ name: "Omega" })])).rows[0];
    expect([a.scorch, a.chalk, a.z]).toEqual([b.scorch, b.chalk, b.z]);
  });
});

describe("the board", () => {
  it("says what is happening in each state", () => {
    expect(boardLines({ status: "reading" }, 0)).toEqual([BATTLE_WORDS.reading]);
    expect(boardLines({ status: "failed" }, 0)).toEqual([BATTLE_WORDS.failed]);
    expect(boardLines({ status: "ready", value: bt([row()], { episode: null }) }, 0)).toEqual([BATTLE_WORDS.board, BATTLE_WORDS.quiet]);
  });
  it("uses the flat page's own sentence about the fall and says it is not a forecast", () => {
    const lines = boardLines({ status: "ready", value: bt() }, 0);
    expect(lines).toContain("OSEBX.OL fell 18.3% from its high on 12 Mar 2026 to its low on 26 Mar 2026 (11 trading days).");
    expect(lines).toContain(BATTLE_WORDS.notForecast);
    expect(lines).toContain("1 of 1 tested");
  });
});

describe("the war table", () => {
  it("pins the newest three drills, newest first, read-only", () => {
    const ds = [1, 2, 3, 4].map((n) => drill({ id: `d${n}`, created_at: `2026-10-0${n}T10:00:00Z`, plan: `plan ${n}` }));
    const notes = notesFor({ drills: ds, demo: false });
    expect(notes).toHaveLength(WAR_TABLE_MAX_NOTES);
    expect(notes.map((n) => n.id)).toEqual(["d4", "d3", "d2"]);
    expect(notes[0].head).toBe("30% fall, 4 Oct 2026");
  });
  it("pins nothing in the sample fortress, and says so with no drills", () => {
    expect(notesFor({ drills: [drill()], demo: true })).toEqual([]);
    expect(notesFor(null)).toEqual([]);
    expect(tableLines({ status: "ready", value: { drills: [], demo: false } })).toEqual([BATTLE_WORDS.table, BATTLE_WORDS.tableEmpty]);
    expect(tableLines({ status: "failed" })).toEqual([BATTLE_WORDS.table, BATTLE_WORDS.tableFailed]);
  });
  it("shortens a long note to one line at a word boundary", () => {
    const long = "word ".repeat(60);
    const s = shortNote(`  ${long}\n\n more `);
    expect(s.length).toBeLessThanOrEqual(NOTE_MAX_CHARS);
    expect(s.endsWith("…")).toBe(true);
    expect(s).not.toMatch(/\s{2}/);
    expect(shortNote("Hold.\nRead first.")).toBe("Hold. Read first.");
  });
});

describe("the ground", () => {
  it("imports only the flat back-test helpers, its words and types: no holding, theme, wall, moat or verdict colour", () => {
    const src = readFileSync(join(__dirname, "battlefield.ts"), "utf8");
    const imports = [...src.matchAll(/^import .* from "(.+)";$/gm)].map((m) => m[1]);
    expect(imports.sort()).toEqual(["../lib/siegeBacktest", "../lib/types", "./battlefieldWordsV1"].sort());
    expect(src).not.toMatch(/HoldingTheme|WallTier|MoatTier|\.level\b/);
  });
  it("uses earth, slate, chalk and parchment only: nothing red and nothing green", () => {
    for (const hex of Object.values(BATTLE_COLORS)) {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
      expect(r > g + 0.15 && r > b + 0.3, `${hex} reads red`).toBe(false);
      expect(g > r + 0.05 && g > b + 0.05, `${hex} reads green`).toBe(false);
    }
  });
  it("stays on the field, clear of the wall line, the ghosts, the camp and the road back", () => {
    const e = battleExtent();
    expect(e.minX).toBeGreaterThan(-FIELD_HALF);
    expect(e.minZ).toBeGreaterThan(-FIELD_HALF);
    // Every bar grows east from the left edge and stops inside the ground.
    expect(BATTLE_X0 + BAR_MAX).toBeLessThan(e.maxX);
    const clear = (id: string, x: number, z: number, r: number) => {
      const inX = x + r > e.minX - 1 && x - r < e.maxX + 1;
      const inZ = z + r > e.minZ - 1 && z - r < e.maxZ + 1;
      expect(inX && inZ, `${id} is on the battlefield`).toBe(false);
    };
    for (const g of ghostsFor(Array.from({ length: 6 }, (_, i) => ({ id: `f${i}`, name: `F${i}` })) as never)) clear(g.id, g.x, g.z, 2.6);
    for (const b of FIELD_BANNERS) clear(b.id, b.x, b.z, 1.5);
    for (const t of ENGINES) clear(t.id, t.x, t.z, t.solid);
    for (const a of ATTACKERS) clear(a.id, a.x, a.z, 0.6);
    for (const r of FIELD_ROCKS) clear(r.id, r.x, r.z, 1.4);
    clear("tent", FIELD_TENT.x, FIELD_TENT.z, FIELD_TENT.solid);
    clear("exit", FIELD_EXIT.x, FIELD_EXIT.z, 4.5);
    clear("spawn", FIELD_SPAWN.x, FIELD_SPAWN.z, 2);
    expect(FIELD_WALL_Z).toBeGreaterThan(e.minZ);
  });
  it("keeps the war table on the field and clear of the camp, the banners and the tools", () => {
    const { x, z, width, depth } = WAR_TABLE;
    const r = Math.hypot(width, depth) / 2 + 1.5;
    expect(Math.abs(x) + r).toBeLessThan(FIELD_HALF);
    expect(Math.abs(z) + r).toBeLessThan(FIELD_HALF);
    const others = [
      ...ENGINES.map((e) => ({ id: e.id, x: e.x, z: e.z, r: e.solid })),
      ...FIELD_BANNERS.map((b) => ({ id: b.id, x: b.x, z: b.z, r: 1.5 })),
      ...FIELD_ROCKS.map((k) => ({ id: k.id, x: k.x, z: k.z, r: 1.4 })),
      { id: "tent", x: FIELD_TENT.x, z: FIELD_TENT.z, r: FIELD_TENT.solid },
      { id: "winch", x: WINCH.x, z: WINCH.z, r: 2 },
      { id: "storm", x: STORM_STONE.x, z: STORM_STONE.z, r: 1.5 },
      { id: "siege", x: SIEGE_STONE.x, z: SIEGE_STONE.z, r: 1.5 },
    ];
    for (const o of others) expect(Math.hypot(o.x - x, o.z - z), o.id).toBeGreaterThan(r + o.r);
  });
  it("puts the board over the head of the strip", () => {
    expect(BATTLE_BOARD.z).toBeLessThan(battlefieldFor(bt()).rows[0].z);
  });
});

describe("words", () => {
  it("has no buy, sell or advice wording, and no red or green words", () => {
    const text = JSON.stringify(BATTLE_WORDS).toLowerCase();
    expect(text).not.toMatch(/\b(buy|sell|trim|add more|should|recommend)\b/);
    expect(text).not.toMatch(/\b(red|green)\b/);
  });
});
