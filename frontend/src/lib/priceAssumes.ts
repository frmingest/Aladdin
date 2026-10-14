/** Plain-language reading of "what the price assumes" for a company the DCF cannot value
 * (loss-making). Pure: it only formats numbers the backend already computed
 * (backend/app/services/valuation/price_assumes.py), and every sentence says it is not a valuation. */
import { formatMoney, formatPercent, formatPrice } from "./format";
import type { PriceAssumes } from "./types";

export interface PriceAssumesText {
  /** What the market already counts on, one sentence. */
  headline: string;
  /** The company's own latest owner earnings next to it, or null when not known. */
  comparison: string | null;
  /** Always shown: it is information, not a value or a rank. */
  caveat: string;
}

export function describePriceAssumes(read: PriceAssumes, currency: string | null): PriceAssumesText {
  const price = formatPrice(read.price_per_share, currency);
  const needed = formatMoney(read.required_owner_earnings, currency);
  const headline =
    `At ${price} a share the market already counts on about ${needed} of owner earnings a year, ` +
    `growing ${formatPercent(read.terminal_growth_rate)} a year, to earn a ${formatPercent(read.discount_rate)} return.`;
  let comparison: string | null = null;
  if (read.latest_owner_earnings != null && read.latest_owner_earnings !== "") {
    const latest = formatMoney(read.latest_owner_earnings, currency);
    const period = read.latest_period ? ` (${read.latest_period})` : "";
    comparison = `Latest reported owner earnings${period}: ${latest}.`;
  }
  return {
    headline,
    comparison,
    caveat: "What the price assumes, not a valuation: it is not ranked and gives no margin of safety.",
  };
}
