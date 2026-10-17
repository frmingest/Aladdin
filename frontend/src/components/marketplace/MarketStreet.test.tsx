import { renderToStaticMarkup } from "react-dom/server";
import { createRef } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import MarketStreet from "./MarketStreet";
import type { WatchlistRow } from "../../lib/types";

function row(id: string, over: Partial<WatchlistRow> = {}): WatchlistRow {
  return {
    id,
    holding_id: `h-${id}`,
    name: `Name ${id}`,
    ticker: `T${id}`,
    status: "buy_zone",
    distance_to_buy_pct: "-4",
    price: "100",
    price_currency: "USD",
    buy_below_price: "110",
    buy_below_currency: "USD",
    owned: true,
    verdict_rating: null,
    moat_rating: null,
    analyzed_at: null,
    ...over,
  } as unknown as WatchlistRow;
}

function render(open: string | null, rows: WatchlistRow[] = [row("a"), row("b", { status: "above", distance_to_buy_pct: "9", owned: false })]) {
  return renderToStaticMarkup(
    <MemoryRouter>
      <MarketStreet
        rows={rows}
        loaded
        onTalk={() => {}}
        onHype={() => {}}
        salRef={createRef<HTMLButtonElement>()}
        hypeRef={createRef<HTMLButtonElement>()}
        initialOpenId={open}
      />
    </MemoryRouter>,
  );
}

describe("MarketStreet stalls are buttons that open a card", () => {
  it("renders every stall as a button with aria-expanded=false and aria-controls, and cards hidden", () => {
    const html = render(null);
    expect(html.match(/<button[^>]*class="ms-stall[^"]*"[^>]*aria-expanded="false"[^>]*aria-controls="ms-card-/g)).toHaveLength(2);
    expect(html.match(/class="ms-card" hidden/g)).toHaveLength(2);
    expect(html).toContain("Step inside"); // in the DOM but hidden: the link is inside the card, never inside the button
    expect(html).not.toMatch(/<button[^>]*class="ms-stall[^>]*>(?:(?!<\/button>).)*<a /);
  });

  it("shows only the name on the signboard and keeps the full sentence as the button's label", () => {
    const html = render(null);
    expect(html).toMatch(/<button[^>]*aria-label="Name a, Ta\./);
    expect(html).toMatch(/<span class="ms-plate"[^>]*><span class="ms-name">Name a<\/span><\/span>/);
  });

  it("opens exactly one card: aria-expanded=true on that stall only, and its card is shown", () => {
    const html = render("a");
    expect(html.match(/aria-expanded="true"/g)).toHaveLength(1);
    expect(html.match(/aria-expanded="false"/g)).toHaveLength(1);
    expect(html.match(/class="ms-card" hidden/g)).toHaveLength(1);
    expect(html).toContain('href="/fortress/marketplace/h-a"');
  });

  it("keeps the flag on the stall and the tone on the card", () => {
    const html = render("a");
    expect(html).toContain("ms-flag");
    expect(html).toContain("In range · -4%");
    expect(html).toContain("In your fortress");
  });
});

describe("the analyst's top mark on a stall", () => {
  const recent = new Date(Date.now() - 20 * 86_400_000).toISOString();
  const old = new Date(Date.now() - 400 * 86_400_000).toISOString();
  it("prints Top mark with a seal, never the verdict word, and tells the screen reader the age", () => {
    const html = render(null, [row("a", { verdict_rating: "Strong Buy", analyzed_at: recent })]);
    expect(html).toContain("Top mark");
    expect(html).toContain("ms-seal");
    expect(html).toContain('data-mark-kind="fresh"');
    expect(html).toContain("Analyst&#x27;s top mark, 20 days old.");
    expect(html).not.toMatch(/Strong Buy|>Buy</);
  });
  it("shows an old read as a dashed Old mark and a plain Buy as nothing", () => {
    const html = render(null, [row("a", { verdict_rating: "Strong Buy", analyzed_at: old }), row("b", { verdict_rating: "Buy", analyzed_at: recent })]);
    expect(html).toContain("Old mark");
    expect(html).toContain("is-old");
    expect(html.match(/class="ms-ribbon"/g)).toHaveLength(1);
  });
});
