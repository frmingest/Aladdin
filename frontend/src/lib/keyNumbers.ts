import { formatDecimal, formatPercent, formatPrice } from "./format";
import type { HoldingValuation } from "./types";

/** The "key numbers" row on a holding's Overview tab (UX noise audit, Wave 3):
 * price, base value, margin of safety. All three are values the backend already
 * stored; nothing is recomputed here. Unknown stays unknown: a withheld or
 * missing value is said to be withheld or missing, never shown as a number. */

export interface KeyNumberTile {
  id: "price" | "base" | "margin";
  label: string;
  value: string;
  tone: "good" | "bad" | "neutral" | "unknown";
  /** One short phrase under the value, only when the value alone could mislead. */
  hint?: string;
}

export interface KeyNumbers {
  tiles: KeyNumberTile[];
  /** One muted line for why a value is missing; null when nothing needs saying. */
  note: string | null;
}

interface Scenario {
  label: string;
  value: string | null;
  margin: string | null;
}

function baseScenario(v: HoldingValuation): Scenario | null {
  const pick = <T extends { label: string }>(xs: T[] | undefined): T | undefined =>
    xs?.find((s) => s.label.toLowerCase() === "base");
  const dcf = pick(v.dcf?.scenarios);
  if (dcf) return { label: "base", value: dcf.intrinsic_value_per_share, margin: dcf.margin_of_safety };
  const fin = pick(v.financials?.scenarios);
  if (fin) return { label: "base", value: fin.value_per_share, margin: fin.margin_of_safety };
  const fund = pick(v.fund_look_through?.scenarios);
  if (fund) return { label: "base", value: fund.value_per_unit, margin: fund.margin_of_safety };
  return null;
}

export function buildKeyNumbers(v: HoldingValuation): KeyNumbers {
  const currency = v.valuation_currency;
  const price: KeyNumberTile = {
    id: "price",
    label: "Price",
    value: v.current_price_per_share ? formatPrice(v.current_price_per_share, currency) : "Not fetched",
    tone: v.current_price_per_share ? "neutral" : "unknown",
  };

  if (v.valuation_status === "implausible") {
    return {
      tiles: [
        price,
        { id: "base", label: "Base value", value: "Withheld", tone: "unknown", hint: "Not credible against the price" },
        { id: "margin", label: "Margin of safety", value: "—", tone: "unknown" },
      ],
      note: null,
    };
  }

  const base = v.valuation_status === "unavailable" ? null : baseScenario(v);
  if (!base || base.value === null) {
    return {
      tiles: [price],
      note: "No value estimate yet. The Financials tab says what is missing.",
    };
  }

  const mos = base.margin;
  const tone: KeyNumberTile["tone"] = mos === null ? "unknown" : Number(mos) >= 0 ? "good" : "bad";
  return {
    tiles: [
      price,
      { id: "base", label: "Base value", value: currency ? `${currency} ${formatDecimal(base.value)}` : formatDecimal(base.value), tone: "neutral" },
      {
        id: "margin",
        label: "Margin of safety",
        value: mos === null ? "—" : formatPercent(mos),
        tone,
        hint: mos === null ? "No price to compare" : undefined,
      },
    ],
    note: null,
  };
}
