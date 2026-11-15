import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PrinterResult } from "../lib/types";
import { AREAS, pathToCourtyard } from "./areas";
import { areaLine, areaName } from "./areaWordsV1";
import { cameraRoomOf } from "./cameraRoom";
import MintPlainPanel from "./MintPlainPanel";
import { LEVER_Z, MINT, MINT_DOOR, MINT_SPAWN, PRESS_SPOT, SPAN_SPOT, BOOK_SPOT, leverLayout } from "./mintRoom";
import { MINT_WORDS } from "./mintWordsV1";
import { NO_NEARS, NO_SPOT_WORLD, standingAt, watchSpots } from "./near";
import type { SpotWorld } from "./near";
import { parsePlace, placeToken } from "./placeLink";

const levers = ["toll_gate", "great_press"].map((key) => ({
  key,
  name: key,
  real_tool: "",
  tide: "up",
  unit_label: "",
  size_min: "0",
  size_max: "10",
  size_default: "0",
  variants: ["default"],
}));
const world: SpotWorld = { ...NO_SPOT_WORLD, mintLevers: leverLayout(levers).plans };

describe("the Royal Mint as a place", () => {
  it("is a room off the courtyard that walks back out, with its own words and camera walls", () => {
    expect(AREAS.mint.parent).toBe("courtyard");
    expect(AREAS.mint.kind).toBe("indoor");
    expect(pathToCourtyard("mint")).toEqual(["mint", "courtyard"]);
    expect(areaLine({ id: "mint" })).toBe(MINT_WORDS.plate);
    expect(areaName({ id: "mint" })).toBe(MINT_WORDS.pageTitle);
    expect(cameraRoomOf("mint")).toEqual(MINT);
    expect(parsePlace(placeToken({ id: "mint" }))).toEqual({ id: "mint" });
  });

  it("has its door in the courtyard's list, so E at the Town building can take you in", () => {
    expect(AREAS.courtyard.doors.map((d) => d.id)).toContain("mint");
    expect(AREAS.courtyard.doors.find((d) => d.id === "mint")?.to).toBe("mint");
  });

  it("arrives out of every spot's reach (E would otherwise act on arrival)", () => {
    const got = watchSpots("mint", MINT_SPAWN, NO_NEARS, world);
    expect(got).toBeNull();
  });
});

describe("what E does in the Royal Mint", () => {
  it("works the lever you stand at", () => {
    const p = world.mintLevers[1];
    const got = watchSpots("mint", { x: p.spotX, z: LEVER_Z }, NO_NEARS, world);
    expect(got).toMatchObject({ mintLever: "great_press" });
    expect(standingAt({ id: "mint" }, { ...NO_NEARS, ...got })).toEqual({ kind: "mintLever", id: "great_press" });
  });

  it("stamps at the press, flips the span at its post, opens the plain list at the lectern, and leaves at the door", () => {
    const at = (pos: { x: number; z: number }) => standingAt({ id: "mint" }, { ...NO_NEARS, ...watchSpots("mint", pos, NO_NEARS, world) });
    expect(at(PRESS_SPOT)).toEqual({ kind: "mintPress" });
    expect(at(SPAN_SPOT)).toEqual({ kind: "mintSpan" });
    expect(at(BOOK_SPOT)).toEqual({ kind: "mintBook" });
    expect(at(MINT_DOOR)).toEqual({ kind: "leave" });
  });

  it("does nothing at a lever the ledger did not list", () => {
    expect(watchSpots("mint", { x: 0, z: LEVER_Z }, NO_NEARS, NO_SPOT_WORLD)).toBeNull();
  });
});

const answer: PrinterResult = {
  version: "v1",
  banner: "A game of consequences, not a trading signal. Scenario, not forecast.",
  demo: false,
  horizon: 1,
  pulls: [],
  holdings: [
    {
      holding_id: "a",
      ticker: "AAA",
      name: "Alpha",
      sector: null,
      value_nok: "100000",
      status: "modelled",
      reason: null,
      confidence: "medium",
      pct: { low: "-4", base: "-2", high: "0" },
      real_pct: null,
      show_amount: true,
      nok: { low: "-4000", base: "-2000", high: "0" },
      real_nok: { low: "-5000", base: "-3000", high: "-1000" },
      direction: "leans_down",
      real_direction: "down",
      why: "Mostly the stock market.",
      terms: [],
    },
    {
      holding_id: "b",
      ticker: "BBB",
      name: "Beta",
      sector: null,
      value_nok: null,
      status: "not_modelled",
      reason: "no value stored for this holding",
      confidence: null,
      pct: null,
      real_pct: null,
      show_amount: false,
      nok: null,
      real_nok: null,
      direction: "unclear",
      real_direction: "unclear",
      why: "",
      terms: [],
    },
  ],
  portfolio_confidence: "low",
  portfolio_pct: null,
  portfolio_real_pct: null,
  show_portfolio_amount: false,
  portfolio_nok: null,
  portfolio_real_nok: null,
  portfolio_direction: "unclear",
  covered_value_nok: "100000",
  total_value_nok: "100000",
  coverage: "1",
  wild: false,
  warnings: ["Scenario, not forecast."],
  notes: [],
};

describe("the Plain view of the Mint", () => {
  it("says the wall is empty before the first stamp", () => {
    const html = renderToStaticMarkup(<MintPlainPanel result={null} stale={false} onClose={() => {}} />);
    expect(html).toContain(MINT_WORDS.plainTitle);
    expect(html).toContain(MINT_WORDS.wallEmpty);
  });

  it("lists each holding with the same words as the plates, and a NOK range only where the backend allowed one", () => {
    const html = renderToStaticMarkup(<MintPlainPanel result={answer} stale={false} onClose={() => {}} />);
    expect(html).toContain("Alpha");
    expect(html).toContain("Leans down");
    expect(html).toContain("Plain:");
    expect(html).toContain("After inflation:");
    expect(html).toContain("Beta");
    expect(html).toContain("no value stored for this holding");
    // The whole book was not allowed an amount: direction only.
    expect(html).toContain(MINT_WORDS.directionOnly);
  });

  it("says when the answer no longer matches the levers", () => {
    expect(renderToStaticMarkup(<MintPlainPanel result={answer} stale onClose={() => {}} />)).toContain(MINT_WORDS.wallStale);
  });
});
