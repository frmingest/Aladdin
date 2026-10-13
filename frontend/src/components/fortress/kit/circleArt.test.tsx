import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ART_MANIFEST } from "../../../lib/artManifest";
import * as roomArt from "../../../lib/roomArt";
import { circleBrazier, fogStakeId } from "../../../lib/roomArt";
import type { Competence } from "../../../lib/types";
import CircleMap from "./CircleMap";
import CircleRingArt, { FogStake } from "./CircleRingArt";

describe("Circle art (Design Master Sprint 11)", () => {
  it("draws no standing stones: they distracted from the markers and were removed", () => {
    expect(roomArt).not.toHaveProperty("circleStones");
    const html = renderToStaticMarkup(<CircleRingArt />);
    expect(html).not.toContain("circle-stone");
  });

  it("is constant: the brazier takes no data, so no mark can move or add one", () => {
    expect(circleBrazier.length).toBe(0);
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
