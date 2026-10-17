import type { TopMark } from "../../lib/marketStreet";

/**
 * The analyst's seal for the street: a round wax seal with a star (solid), or a dashed ring with a star (old).
 * Decorative: the fact is in the stall's sentence and the printed ribbon next to it. Shape differs per state, so
 * colour is never the only signal. Paint lives in street.css (.ms-seal-*), not here.
 */
export default function TopMarkSeal({ kind }: { kind: TopMark }) {
  const old = kind === "old";
  return (
    <svg className={`ms-seal${old ? " is-old" : ""}`} viewBox="0 0 32 32" aria-hidden focusable="false">
      {!old && <path className="ms-seal-wax" d="M16 1.5 l3 1.6 3.4-.6 1.9 2.9 3.4.9.4 3.5 2.6 2.4-1.1 3.3 1.1 3.3-2.6 2.4-.4 3.5-3.4.9-1.9 2.9-3.4-.6-3 1.6-3-1.6-3.4.6-1.9-2.9-3.4-.9-.4-3.5L1.9 19.5 3 16.2 1.9 12.9l2.6-2.4.4-3.5 3.4-.9 1.9-2.9 3.4.6z" />}
      <circle className="ms-seal-ring" cx="16" cy="16" r={old ? 11.5 : 9.5} />
      <path className="ms-seal-star" d="M16 8.6l2.2 4.7 5.1.6-3.8 3.5 1 5.1-4.5-2.6-4.5 2.6 1-5.1-3.8-3.5 5.1-.6z" />
    </svg>
  );
}
