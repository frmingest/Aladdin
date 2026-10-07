import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import FortressTabs from "../components/fortress/FortressTabs";
import { KeyNumbersRow } from "../components/KeyNumbers";
import { WarningStack } from "../components/WarningStack";
import { glossaryEntries } from "./glossary";
import { buildKeyNumbers } from "./keyNumbers";
import { primaryNavFor } from "./nav";
import { METRIC_LABELS } from "./types";
import type { HoldingValuation } from "./types";
import type { WarningItem } from "./warnings";
import { countWords, visibleText, WORD_BUDGET } from "./wordBudget";

const render = (node: React.ReactElement) =>
  renderToStaticMarkup(<MemoryRouter initialEntries={["/"]}>{node}</MemoryRouter>);

describe("word counting", () => {
  it("counts visible words only", () => {
    expect(countWords("<p class='a b c'>One <b>two</b>  three</p><script>var x = 1 2 3</script>")).toBe(3);
    expect(visibleText("<p>It&#x27;s &amp; so</p>")).toBe("It's & so");
    expect(countWords("")).toBe(0);
  });
});

describe("word budgets for default views", () => {
  it("the sidebar lists four primary links and one More button, nothing else", () => {
    const words = primaryNavFor(false).map((i) => i.label).join(" ") + " More";
    expect(countWords(words)).toBeLessThanOrEqual(WORD_BUDGET.sidebarDefault);
  });

  it("the Fortress tab strip is seven short labels", () => {
    expect(countWords(render(<FortressTabs />))).toBeLessThanOrEqual(WORD_BUDGET.fortressTabs);
  });

  it("the key numbers row stays a glance", () => {
    const v = {
      valuation_currency: "NOK",
      current_price_per_share: "100",
      valuation_status: "ok",
      unavailable_reasons: [],
      dcf: {
        discount_rate: "0.09",
        terminal_growth_rate: "0.02",
        scenarios: [{ label: "base", growth_rate: "0.03", intrinsic_value_per_share: "150", margin_of_safety: "0.33" }],
      },
    } as unknown as HoldingValuation;
    expect(buildKeyNumbers(v).tiles).toHaveLength(3);
    expect(countWords(render(<KeyNumbersRow valuation={v} />))).toBeLessThanOrEqual(WORD_BUDGET.keyNumbers);
  });

  it("twelve warnings still show only three, a count and one system line", () => {
    const items: WarningItem[] = Array.from({ length: 12 }, (_, i) => ({
      id: `w${i}`,
      title: `Check number ${i}`,
      severity: "medium",
      kind: i === 11 ? "infrastructure" : "investment",
    }));
    const html = render(<WarningStack items={items} />);
    expect((html.match(/<li/g) ?? []).length).toBe(3);
    expect(html).toContain("+8 more");
    expect(countWords(html)).toBeLessThanOrEqual(WORD_BUDGET.warningStack);
  });
});

describe("glossary", () => {
  it("lists each explanation once, A to Z, with a readable title", () => {
    const entries = glossaryEntries(METRIC_LABELS);
    const titles = entries.map((e) => e.title);
    expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b)));
    expect(new Set(entries.map((e) => e.text)).size).toBe(entries.length);
    for (const e of entries) expect(e.title).not.toMatch(/[a-z][A-Z]|_/);
  });
});
