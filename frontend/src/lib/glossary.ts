/** Plain-language explanations for the metrics/charts sprinkled across
 * the app, shown via <InfoTooltip> next to the value or heading they
 * explain. Kept in one place so the wording stays consistent wherever a
 * term shows up more than once (e.g. "margin of safety" appears on both
 * the board and a single holding's page). Every entry should read like
 * something you'd say out loud to a non-finance friend — no jargon
 * defining jargon. */
export const GLOSSARY = {
  marginOfSafety:
    "How much cheaper the stock is today than what it's actually estimated to be worth (the \"base case\" value below). A positive number means it's trading below that estimate — the bigger the number, the more room for error if the estimate turns out to be optimistic.",
  bearBaseBull:
    "Three estimates of what the company is really worth per share, from a pessimistic case (bear) through the most likely case (base) to an optimistic case (bull) — all computed from the company's own cash flows, not a guess. Where today's price falls in that range is the whole point of this chart: below bear is cheap, above bull is expensive.",
  dcf:
    "Short for \"discounted cash flow.\" It adds up the cash the business is expected to generate in the future and converts that into what it's worth today — the same idea as knowing $100 next year is worth a bit less than $100 in your pocket now. This is the method behind the bear/base/bull value estimates.",
  discountRate:
    "The \"today discount\" applied to future cash — a higher rate means future money is worth less right now, which lowers the estimated value. It's built from the risk-free rate (what you'd earn doing nothing risky) plus extra return for how risky this particular stock is.",
  beta:
    "How much this stock tends to swing compared to the overall market. 1.0 means it moves roughly in step with the market; above 1.0 means bigger swings (more risk, used in the discount rate above), below 1.0 means calmer moves.",
  reverseDcf:
    "Instead of estimating what the company is worth, this works backwards from today's price and asks: how fast would the company need to grow, forever, to justify paying this much? A very high required growth rate is a warning sign the stock is priced for perfection.",
  roic:
    "Return on invested capital — for every krone tied up in the business (both debt and equity), how many øre of profit it generates each year. A business that consistently earns more on its capital than that capital costs is creating real value, not just growing for growth's sake.",
  roe:
    "Return on equity — profit as a share of what shareholders (not lenders) have invested in the company. Useful alongside ROIC because a company can flatter its ROE just by borrowing more, which ROIC isn't fooled by.",
  ownerEarnings:
    "Warren Buffett's version of \"real\" cash profit: reported net income, plus non-cash charges like depreciation added back, minus the money that actually has to be reinvested to keep the business running (capital expenditure). It's the number the DCF is built on, not the headline net-income figure.",
  peRatio:
    "Price-to-earnings ratio — the share price divided by profit per share. A rough shorthand for \"how many years of today's profit am I paying for,\" useful for comparing similarly-sized companies in the same industry, but it says nothing about growth or debt on its own.",
  evEbitda:
    "Enterprise value ÷ EBITDA — similar idea to the P/E ratio, but it also counts the company's debt (not just its share price) and looks at profit before interest, tax, depreciation and amortization. Better than P/E for comparing companies with very different debt levels.",
  correlation:
    "How closely two holdings' prices move together, from -1 (perfectly opposite — one up while the other's down) to +1 (perfectly together). A portfolio full of holdings near +1 with each other isn't as diversified as it looks, even if the tickers are different.",
  concentrationCluster:
    "A group of holdings that all tend to rise and fall together, even if they're in different sectors on paper — often because they share the same underlying driver (e.g. the oil price, or interest rates). A large cluster means a single event can move more of your portfolio at once than the sector labels suggest.",
  macroRegime:
    "A rough label for the current economic backdrop — growth speeding up or slowing down, inflation rising or falling — built from real indicators (rates, inflation, growth data), not a guess. Some strategies do better in some regimes than others, which is why it's shown alongside the numbers it affects.",
  regimeDcfAddon:
    "An extra margin added to the discount rate when the macro regime isn't the calm baseline case — the idea being that future cash flows are worth demanding a bigger cushion for when the backdrop is stressed or overheating.",
  stressScenario:
    "An estimate of how much your portfolio's value could fall under a specific historical-style shock (e.g. a sharp rate rise, a growth scare), based on how your actual holdings have moved together in the past — not a prediction, a \"what if\" gut-check.",
  realReturn:
    "Your return after subtracting inflation (measured by Norway's CPI) — what your money actually grew by in terms of what it can buy, not just in kroner. A portfolio can be up in kroner and still down in real terms if inflation ran hotter.",
  benchmarkComparison:
    "How your portfolio's value has moved compared to a reference index (e.g. the Oslo Børs main index) over the same period, both reindexed to start at the same point — so you can see whether you're beating, matching, or lagging \"the market.\"",
  thesisTripwire:
    "A specific, checkable condition you set yourself (e.g. \"revenue growth falls below 5%\") that would mean your original reason for owning this stock no longer holds. The app checks these automatically against real numbers as they come in, rather than relying on you remembering to re-check.",
  verdict:
    "The latest Buffett/Munger-style analysis's bottom-line call (Strong Buy through Avoid) — built by the LLM reasoning over the deterministic numbers and evidence gathered for that run, always with citations back to real sources.",
  cycleFit:
    "In Ray Dalio's framework: how well this holding's role (e.g. inflation hedge, growth exposure) fits where the economy currently sits in the long-term debt and business cycle — a different question from \"is it cheap,\" more \"does it belong here right now.\"",
  sovereignRisk:
    "A country-level score built from real fiscal, political-stability and external-position indicators (World Bank, WGI, FRED) — how exposed a holding is to trouble in the country whose economy or currency it's most tied to, not the company's own financial health.",
  fxExposure:
    "How much of your holding's value depends on a currency other than NOK moving in your favour — separate from the business actually doing well, since a strong NOK can erase gains made in another currency and vice versa.",
} as const;

export type GlossaryKey = keyof typeof GLOSSARY;

/** Plain-language one-liners for the deterministic ratio metrics
 * (backend/app/services/calculations.py), keyed exactly like
 * lib/types.ts's METRIC_LABELS so a metrics table can look one up
 * directly. Deliberately short — the metric name plus what it's for,
 * not a finance-class explanation. */
export const METRIC_INFO: Record<string, string> = {
  gross_margin: "Of every krone of sales, how much is left after the direct cost of making/delivering the product — before overhead, R&D, marketing, etc.",
  operating_margin: "Profit left from each krone of sales after running the core business (including overhead), but before interest and tax — how efficient the business itself is, separate from how it's financed.",
  net_margin: "The share of sales that ends up as bottom-line profit, after everything — interest, tax, one-off items included.",
  free_cash_flow: "Cash the business actually generated after paying for the equipment/investment needed to keep running — the cash that's genuinely free to pay dividends, buy back shares, or pay down debt.",
  owner_earnings: GLOSSARY.ownerEarnings,
  net_debt: "Total debt minus cash on hand — what the company would still owe if it used all its cash to pay debt down today.",
  net_debt_to_ebitda: "How many years of pre-interest, pre-tax profit it would take to pay off net debt — a common shorthand for how leveraged a company is. Higher means more financial risk.",
  net_debt_to_fcf: "Same idea as net debt / EBITDA, but against actual free cash generated rather than an accounting profit figure — closer to \"how long to pay this off with real cash.\"",
  interest_coverage: "How many times over the company's operating profit could cover its interest payments. A number close to 1 means almost all profit is going to lenders before shareholders see anything.",
  debt_to_equity: "How much the company is funded by debt versus by shareholders' own money. Higher means more reliance on borrowing, which amplifies both gains and losses.",
  materials_margin: "Profit left after the cost of raw materials/inputs alone — a narrower cut than gross margin, useful for materials-heavy businesses.",
  roic: GLOSSARY.roic,
  roce: "Return on capital employed — similar to ROIC but measured before tax, so it's less affected by a company's particular tax situation when comparing across companies.",
  roe: GLOSSARY.roe,
  market_cap: "What the whole company is worth on the stock market right now — share price × total shares outstanding.",
  enterprise_value: "What it would cost to buy the entire company outright: market cap, plus its debt, minus its cash (since you'd effectively get that cash back).",
  price_to_earnings: GLOSSARY.peRatio,
  price_to_book: "Share price compared to the company's accounting net worth (assets minus liabilities) per share. Below 1 can mean the market thinks the business is worth less than its books say — or that the books overstate real value.",
  price_to_sales: "Share price compared to revenue per share — used when a company isn't yet profitable, since P/E doesn't work without earnings.",
  ev_to_ebitda: GLOSSARY.evEbitda,
  fcf_yield: "Free cash flow as a percentage of what you'd pay for the company (market cap or enterprise value) — the cash equivalent of P/E, and higher generally means cheaper.",
};
