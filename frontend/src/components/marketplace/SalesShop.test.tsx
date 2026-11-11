import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import SalesShop from "./SalesShop";
import type { Catalogue, CatalogueItem, CatalogueSizeBand } from "../../lib/types";

function item(ticker: string, name: string, sector: string | null, band: CatalogueSizeBand, cap: string | null): CatalogueItem {
  return { ticker, name, currency: "NOK", sector, size_band: band, market_cap: cap };
}

const NOW = Date.parse("2026-11-11T12:00:00Z");

function catalogue(over: Partial<Catalogue> = {}): Catalogue {
  return {
    status: "ready",
    as_of: "2026-11-09T12:00:00Z",
    total: 4,
    rules_version: "catalogue-v1",
    items: [
      item("EQNR.OL", "Equinor ASA", "Energy", "giant", "700000000000"),
      item("DNB.OL", "DNB Bank ASA", "Financials", "giant", "330000000000"),
      item("NEL.OL", "Nel ASA", "Industrials", "small", "3000000000"),
      item("MYST.OL", "Mystery Holdings", null, "unknown", null),
    ],
    ...over,
  };
}

function render(over: { cat?: Catalogue; taken?: string[]; disabled?: boolean } = {}) {
  return renderToStaticMarkup(
    <SalesShop catalogue={over.cat ?? catalogue()} taken={new Set(over.taken ?? [])} disabled={over.disabled ?? false} onPick={() => {}} onTypeInstead={() => {}} now={NOW} />,
  );
}

describe("SalesShop", () => {
  it("shows a card per company with its ticker, size word and market value", () => {
    const html = render();
    expect(html).toContain("Equinor ASA");
    expect(html).toContain("EQNR.OL");
    expect(html).toContain("700 bn");
    expect(html).toContain("Giants");
    expect(html).toContain("Open the stall");
    expect(html).toContain("4 stalls");
  });

  it("lists the shelves that have companies, with the real sector beside the game name", () => {
    const html = render();
    expect(html).toContain("Everything");
    expect(html).toContain("Oil &amp; Power");
    expect(html).toContain("Banks &amp; Coin");
    expect(html).toContain("Odds &amp; Ends"); // the company with no sector
    expect(html).not.toContain("Healers"); // an empty shelf is not shown
    expect(html).toContain("Financials");
  });

  it("draws an unknown size as fog in words, never as a number", () => {
    const html = render();
    expect(html).toContain("Size in fog");
    expect(html).toContain("size in fog");
    expect(html).toContain('data-band="unknown"');
  });

  it("marks a company that already has a stall, and cannot be opened twice", () => {
    const html = render({ taken: ["EQNR.OL"] });
    expect(html).toContain("On your street");
    expect(html).toMatch(/data-taken="true"[^>]*disabled|disabled=""[^>]*data-taken="true"/);
  });

  it("disables every card in demo mode", () => {
    const html = render({ disabled: true });
    expect(html.match(/class="shop-card"[^>]*disabled/g)?.length).toBe(4);
  });

  it("offers the typed form for anything not on the shelves", () => {
    expect(render()).toContain("Not on the shelves? Type a ticker");
  });

  it("says when the shelves were stocked, and warns kindly when they are dusty", () => {
    expect(render()).toContain("Stocked 2 days ago");
    const old = render({ cat: catalogue({ as_of: "2026-09-01T00:00:00Z" }) });
    expect(old).toContain("A bit dusty");
  });

  it("gives every card an accessible name that carries the size in words", () => {
    expect(render()).toContain("Open the stall for Equinor ASA, EQNR.OL. Giants.");
  });

  it("never offers advice", () => {
    expect(render()).not.toMatch(/\b(buy|sell|invest|recommend|best|cheap|undervalued)\b/i);
  });
});
