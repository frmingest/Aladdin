/**
 * The price post's words (version 2, 2026-11-08: "why" for the flat page's "thesis", per the text review glossary). Short, game voice. A change to any wording that could be shown for
 * real is a NEW version file, never an edit of this one. Version 1 (pricePostWordsV1.ts) is untouched. The reasons are the stored lines, printed as they are.
 */
export const PRICE_WORDS_VERSION = "v2";

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
    whole: "Why still stands",
    cracked: "Why cracked",
    broken: "Why broken",
    fog: "Why not read yet",
  },
  banner: {
    sheltered: "Sheltered",
    exposed: "Exposed",
    breach_risk: "Breach risk",
    fog: "Siege not read",
  },
} as const;
