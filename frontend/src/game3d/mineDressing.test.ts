import { describe, expect, it } from "vitest";
import { glbJson, glbTopNodes, glbBytes } from "./glbJson";
import { HOLDING_URL } from "./holdingPieces";
import { DRESSING_RADIUS, FIXED_PIECES, dressingPartCount, mineDressing } from "./mineDressing";
import type { MineTheme, Piece } from "./mineDressing";
import { GHOST, NEUTRAL, RUNGS, landCondition } from "./landCondition";
import { TOWN_FILES } from "./townPieces";
import { DRESSING_BUILT } from "./landCentre";

const THEMES: MineTheme[] = ["mine", "quarry"];
const count = (theme: MineTheme, i: number, nodePrefix?: (p: Piece) => boolean) => mineDressing(theme, RUNGS[i]!).pieces.filter(nodePrefix ?? (() => true)).length;
const fixedKey = (p: Piece) => `${p.file}:${p.node}:${p.x}:${p.z}`;

describe("mine and quarry dressings (S26 PR 5)", () => {
  it("are switched on for the mine and quarry themes only (by this PR)", () => {
    expect(DRESSING_BUILT.mine).toBe(true);
    expect(DRESSING_BUILT.quarry).toBe(true);
  });

  for (const theme of THEMES) {
    describe(theme, () => {
      it("draws only from the wall tier: the plan is a function of the condition alone", () => {
        expect(mineDressing(theme, landCondition("brick"))).toEqual(mineDressing(theme, RUNGS[2]!));
        expect(mineDressing(theme, landCondition("basalt"))).not.toEqual(mineDressing(theme, landCondition("rotted")));
      });

      it("keeps the fixed set (gold, stone piles, tools) the same at every rung, so no value can grow it", () => {
        const base = FIXED_PIECES[theme].map(fixedKey);
        for (const c of RUNGS) {
          const keys = mineDressing(theme, c).pieces.map(fixedKey);
          for (const k of base) expect(keys, k).toContain(k);
        }
      });

      it("a worse wall never has less damage: loose boards, rubble, props, broken props, patches and the crack never fall", () => {
        let prev = mineDressing(theme, RUNGS[0]!);
        for (let i = 1; i < RUNGS.length; i++) {
          const cur = mineDressing(theme, RUNGS[i]!);
          expect(cur.props.length).toBeGreaterThanOrEqual(prev.props.length);
          expect(cur.props.filter((p) => p.broken).length).toBeGreaterThanOrEqual(prev.props.filter((p) => p.broken).length);
          expect(cur.patches).toBeGreaterThanOrEqual(prev.patches);
          expect(Number(cur.crack)).toBeGreaterThanOrEqual(Number(prev.crack));
          expect(cur.trim).toBeLessThanOrEqual(prev.trim);
          expect(cur.pieces.length).toBeGreaterThanOrEqual(prev.pieces.length);
          prev = cur;
        }
      });

      it("Sound is tight and proud; Failing has a crack, props and rubble", () => {
        const sound = mineDressing(theme, RUNGS[0]!);
        const failing = mineDressing(theme, RUNGS[4]!);
        expect(sound.props).toHaveLength(0);
        expect(sound.crack).toBe(false);
        expect(sound.trim).toBe(1);
        expect(sound.pieces.every((p) => !p.lean)).toBe(true);
        expect(failing.crack).toBe(true);
        expect(failing.props.length).toBeGreaterThan(0);
        expect(count(theme, 4)).toBeGreaterThan(count(theme, 0));
        expect(failing.pieces.some((p) => p.lean)).toBe(true);
      });

      it("Ghost and Neutral are not rungs: they draw undamaged, with no footing (they are drawn by the slot, not here)", () => {
        for (const c of [GHOST, NEUTRAL]) {
          const p = mineDressing(theme, c);
          expect(p.props).toHaveLength(0);
          expect(p.crack).toBe(false);
          expect(p.trim).toBe(0);
        }
      });

      it("every placed node exists in its file, and stays inside the stream's inner edge", () => {
        const own = glbTopNodes(glbJson(HOLDING_URL(theme)));
        const builder = glbTopNodes(glbJson(TOWN_FILES.buildings));
        for (const c of RUNGS) {
          for (const p of mineDressing(theme, c).pieces) {
            expect(p.file === "own" ? own : builder, p.node).toContain(p.node);
            expect(Math.hypot(p.x, p.z), `${p.node} at ${p.x},${p.z}`).toBeLessThanOrEqual(DRESSING_RADIUS);
          }
        }
      });

      it("stays within the draw-call budget (a land is limited to 120; the dressing takes at most 45 parts)", () => {
        for (const c of RUNGS) expect(dressingPartCount(mineDressing(theme, c))).toBeLessThanOrEqual(45);
      });

      it("the pack file is within the 600 KB model budget", () => {
        expect(glbBytes(HOLDING_URL(theme))).toBeLessThanOrEqual(600 * 1024);
      });
    });
  }

  it("no node placed is called red or green", () => {
    for (const t of THEMES) for (const c of RUNGS) for (const p of mineDressing(t, c).pieces) expect(p.node).not.toMatch(/red|green/i);
  });
});
