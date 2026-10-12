import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ART_MANIFEST } from "../../../lib/artManifest";
import { CIRCLE_R } from "../../../lib/circleMap";
import { circleBrazier, circleStones, fogStakeId } from "../../../lib/roomArt";
import type { Competence } from "../../../lib/types";
import CircleMap from "./CircleMap";
import CircleRingArt, { FogStake } from "./CircleRingArt";

describe("Circle art (Design Master Sprint 11)", () => {
  it("stands seven stones on the circle line, every picture packed, the bottom spoke left for the zone names", () => {
    const stones = circleStones();
    expect(stones).toHaveLength(7);
    for (const s of stones) {
      expect(Object.keys(ART_MANIFEST)).toContain(s.id);
      const d = Math.hypot(s.left - 50, s.top - 50);
      expect(Math.abs(d - CIRCLE_R * 50)).toBeLessThan(0.2);
      // nothing on the bottom spoke (left 50, below the centre)
      expect(s.left === 50 && s.top > 50).toBe(false);
    }
    expect(stones.filter((s) => s.id === "circle-stone")).toHaveLength(3);
    expect(stones.filter((s) => s.id === "circle-stone-low")).toHaveLength(4);
  });

  it("is constant: the stones and the brazier take no data, so no mark can move or add one", () => {
    expect(circleStones.length).toBe(0);
    expect(circleBrazier.length).toBe(0);
    expect(circleStones()).toEqual(circleStones());
    expect(circleBrazier()).toEqual({ id: "circle-brazier", left: 50, top: 50, width: 9 });
  });

  it("has the brazier and the fog stake packed", () => {
    expect(Object.keys(ART_MANIFEST)).toEqual(expect.arrayContaining(["circle-brazier", "circle-stake"]));
    expect(fogStakeId()).toBe("circle-stake");
  });

  it("draws nothing with Object art off (the default), including on a map that has holdings with no sector", () => {
    expect(renderToStaticMarkup(<CircleRingArt />)).toBe("");
    expect(renderToStaticMarkup(<FogStake />)).toBe("");
    const data: Competence = {
      rules_version: "competence-v1",
      demo: false,
      levels: ["know", "partly", "outside"],
      sectors: [{ sector: "Energy", level: "know", note: null, marked_at: "2026-10-01T10:00:00Z", weight_pct: "20", holdings: [{ holding_id: "e", name: "Energy co", weight_pct: "20" }] }],
      towers: [{ holding_id: "u", name: "Loose Co", sector: null, weight_pct: "4.0", status: "unclassified" }],
      inside_weight_pct: "20.0",
      edge_weight_pct: "0.0",
      outside_weight_pct: "0.0",
      unmarked_weight_pct: "0.0",
      unclassified_weight_pct: "4.0",
      summary: "s",
      note_max_chars: 280,
    };
    const html = renderToStaticMarkup(<CircleMap data={data} onPress={() => {}} />);
    expect(html).not.toContain("<img");
    expect(html).not.toContain("circle-ring-art");
    expect(html).toContain("No sector set");
  });
});
