import { describe, expect, it } from "vitest";
import { CODEX_KEY, codexPlates, loadSeen, saveSeen, seenAfter } from "./codex";
import type { GameState, GameTower } from "./types";

const t = (o: Partial<GameTower> = {}) =>
  ({ margin_of_safety_pct: null, verdict_rating: null, thesis: "not_analyzed", tripwires_fired: 0, shared_wall_with: [], ...o }) as GameTower;
const st = (towers: GameTower[], siege: GameState["siege"] = null) => ({ towers, siege }) as GameState;
const unlocked = (s: GameState | null, seen = new Set<string>()) => codexPlates(s, seen).filter((p) => p.unlocked).map((p) => p.id);

describe("codex-v1", () => {
  it("unlocks nothing on an empty realm, and every plate says when it will appear", () => {
    const plates = codexPlates(st([t()]), new Set());
    expect(plates.length).toBeGreaterThan(5);
    expect(plates.every((p) => !p.unlocked && p.hint.length > 0 && p.text.length > 0)).toBe(true);
  });

  it("unlocks terms that appear on the realm", () => {
    expect(unlocked(st([t({ margin_of_safety_pct: "12", verdict_rating: "hold", thesis: "intact" })]))).toEqual(
      expect.arrayContaining(["marginOfSafety", "dcf", "bearBaseBull", "verdict", "thesisTripwire"]),
    );
    expect(unlocked(st([t({ shared_wall_with: ["B"] })]))).toEqual(expect.arrayContaining(["correlation", "concentrationCluster"]));
    expect(unlocked(st([t()], { portfolio_shock_pct: "-0.2", regime: "late cycle" } as GameState["siege"]))).toEqual(
      expect.arrayContaining(["stressScenario", "macroRegime"]),
    );
  });

  it("a plate seen before stays unlocked even when the data goes away", () => {
    expect(unlocked(st([t()]), new Set(["dcf"]))).toEqual(["dcf"]);
    expect(unlocked(null, new Set(["dcf"]))).toEqual(["dcf"]);
  });

  it("seenAfter adds currently unlocked plates", () => {
    const plates = codexPlates(st([t({ verdict_rating: "hold" })]), new Set(["dcf"]));
    expect([...seenAfter(plates, new Set(["dcf"]))].sort()).toEqual(["dcf", "verdict"]);
  });

  it("storage is guarded: broken or missing storage gives an empty set and never throws", () => {
    expect(loadSeen(null).size).toBe(0);
    expect(loadSeen({ getItem: () => "{not json" }).size).toBe(0);
    expect(loadSeen({ getItem: () => JSON.stringify(["a", 3, "b"]) })).toEqual(new Set(["a", "b"]));
    expect(() => saveSeen(new Set(["a"]), { setItem: () => { throw new Error("full"); } })).not.toThrow();
    let saved = "";
    saveSeen(new Set(["a"]), { setItem: (k, v) => { expect(k).toBe(CODEX_KEY); saved = v; } });
    expect(saved).toBe('["a"]');
  });

  it("never uses reward wording", () => {
    const all = codexPlates(st([t()]), new Set()).map((p) => p.hint).join(" ");
    expect(all).not.toMatch(/\b(points?|streak|reward|achievement|earn)\b/i);
  });
});
