import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import GameFooter from "../components/fortress/GameFooter";
import { TabBar } from "../components/ui";
import { isFundCode, notesWithoutRepeats, shortLabel } from "./fortress";
import { STORE_TABS, storeTab } from "./marketStoreTabs";
import { countWords, WORD_BUDGET } from "./wordBudget";

const render = (node: React.ReactElement) =>
  renderToStaticMarkup(<MemoryRouter initialEntries={["/"]}>{node}</MemoryRouter>);

describe("game-mode word budgets (UX noise audit, game mode)", () => {
  it("every game page ends in one short footer with the rule versions behind a click", () => {
    const html = render(<GameFooter rules="Rules version v1. A long list of codes that must stay closed by default." />);
    expect(countWords(html)).toBeLessThanOrEqual(WORD_BUDGET.gameFooter);
    expect(html).not.toContain("long list of codes");
    expect(html).toContain("Read-only");
  });

  it("the store's tab strip is five short labels", () => {
    const html = render(<TabBar items={[...STORE_TABS]} active="decision" onChange={() => {}} label="Store sections" />);
    expect(STORE_TABS).toHaveLength(5);
    expect(countWords(html)).toBeLessThanOrEqual(WORD_BUDGET.storeTabs);
  });
});

describe("store tabs", () => {
  it("reads the tab from the URL and falls back to the decision", () => {
    expect(storeTab("gates")).toBe("gates");
    expect(storeTab("numbers")).toBe("numbers");
    expect(storeTab("nonsense")).toBe("decision");
    expect(storeTab(null)).toBe("decision");
  });
});

describe("notes that repeat the Vault card", () => {
  const notes = [
    "2 holding(s) have no analysis yet; their moat is unsurveyed.",
    "No cash entered on any account; the vault is unsurveyed.",
    "Physical coins are shown in ounces; they are not valued in this view.",
  ];
  it("drops the cash and coin notes the card already says, and keeps the rest", () => {
    const kept = notesWithoutRepeats(notes, { cash_nok: null, gold_oz: "2", silver_oz: "25" });
    expect(kept).toEqual([notes[0]]);
  });
  it("keeps the cash note when cash is entered but stale elsewhere, and the coin note without coins", () => {
    expect(notesWithoutRepeats(notes, { cash_nok: "1000", gold_oz: "0", silver_oz: "0" })).toEqual(notes);
  });
});

describe("names, not codes", () => {
  it("recognises a fund vendor code, not a stock ticker", () => {
    expect(isFundCode("0P0001RFXW.IR")).toBe(true);
    expect(isFundCode("0P0001VJ4B")).toBe(true);
    expect(isFundCode("VAR.OL")).toBe(false);
    expect(isFundCode("4GLD.DE")).toBe(false);
  });
  it("labels a fund by the first word of its name and a stock by its ticker", () => {
    expect(shortLabel("Heimdal Utbytte N", "0P0001RFXW.IR")).toBe("Heimdal");
    expect(shortLabel("Alfred Berg Nordic High Yield II R (NOK)", "0P0001VJ4B.IR", 7)).toBe("Alfred");
    expect(shortLabel("Vår Energi", "VAR.OL")).toBe("VAR");
  });
});
