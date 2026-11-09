import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import TemperamentCard from "../components/fortress/TemperamentCard";
import type { GameTemperament } from "../lib/types";

const temper = {
  level: "steady", needle_pct: 55, low_confidence: false, restores: 1, drains: 1,
  summary: "1 of 2 judged event(s) restored the meter, based on 3 logged decision(s) and 1 snapshot comparison(s) in the last 90 days.",
  events: [
    { rule: "churn", on: "2026-10-01", holding_name: "Acme", kind: "drain", source: "journal",
      explanation: "3 trades on this holding within 60 days (2026-08-01 to 2026-09-12)." },
    { rule: "held_through_drop", on: "2026-09-01", holding_name: "Vend", kind: "restore", source: "snapshots",
      explanation: "Kept the position while the price fell 12.5% between snapshots (2026-07-01 to 2026-08-01), with no tripwire fired." },
  ],
  turnover: [],
} as unknown as GameTemperament;

const text = (voice?: "game" | "flat") =>
  renderToStaticMarkup(<MemoryRouter><TemperamentCard temperament={temper} voice={voice} /></MemoryRouter>).replace(/<[^>]*>/g, " ");

describe("temperament card sentences by voice", () => {
  it("3D reads in game voice and keeps every number", () => {
    const t = text("game");
    expect(t).toContain("Too much shuffling");
    expect(t).toContain("3 trades on this holding in 60 days (2026-08-01 to 2026-09-12).");
    expect(t).toContain("Held on while the price fell 12.5% between two saved looks");
    expect(t).toContain("1 of 2 moments calmed the needle, from 3 decisions and 1 look compared in the last 90 days.");
    expect(t).not.toMatch(/\(s\)|judged|snapshot comparison/);
  });

  it("the flat Fortress keeps the backend's own sentences", () => {
    const t = text("flat");
    expect(t).toContain("Churn");
    expect(t).toContain("judged event(s) restored the meter");
    expect(t).toContain("3 trades on this holding within 60 days");
  });
});
