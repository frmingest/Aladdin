/** Short labels for why a holding has no DCF on the Margin-of-safety board (Wave 1 noise reduction).
 * The backend's sentence stays available as the detail; this only gives the reader the one-word cause.
 * Pure, and it never invents a cause: text it does not recognise gets the neutral "Not valued yet". */
export interface ShortReason {
  label: string;
  /** "data" = something to supply; "model" = a method or plausibility limit; "note" = informational. */
  kind: "data" | "model" | "note";
}

export function shortReason(reason: string | null | undefined): ShortReason {
  const r = (reason ?? "").toLowerCase();
  if (r.includes("far outside what a sound model gives") || r.includes("withheld")) {
    return { label: "Check inputs", kind: "model" };
  }
  if (r.includes("not profitable")) return { label: "Loss-making", kind: "model" };
  if (r.includes("only one profitable year")) return { label: "One profitable year", kind: "model" };
  if (r.includes("fewer than two periods") || r.includes("complete owner-earnings inputs")) {
    return { label: "Data missing", kind: "data" };
  }
  if (r.includes("no financial history") || r.includes("no history")) {
    return { label: "No financial history", kind: "data" };
  }
  if (r.includes("no roe")) return { label: "No ROE data", kind: "data" };
  if (r.includes("beta unavailable")) return { label: "Default beta used", kind: "note" };
  if (r.includes("risk-free rate")) return { label: "No risk-free rate", kind: "data" };
  return { label: "Not valued yet", kind: "note" };
}
