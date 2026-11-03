/**
 * The price post's words (version 1, 2026-11-03). Short, game voice. A change to any wording that could be shown for
 * real is a NEW version file, never an edit of this one. The reasons are the stored lines, printed as they are.
 */
export const PRICE_WORDS_VERSION = "v1";

export const PRICE_WORDS = {
  title: "Price post",
  gauge: {
    bargain: "Lots of room",
    discount: "Some room",
    full_price: "No room",
    overpriced: "Too dear",
    fog: "Not priced yet",
  },
  scroll: {
    whole: "Thesis whole",
    cracked: "Thesis cracked",
    broken: "Thesis broken",
    fog: "No thesis read",
  },
  banner: {
    sheltered: "Sheltered",
    exposed: "Exposed",
    breach_risk: "Breach risk",
    fog: "Siege not read",
  },
} as const;
