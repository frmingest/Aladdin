import type { PrinterResult } from "../lib/types";
import { bookPlate, holdingPlate } from "./mintRoomLogic";
import type { PlateText } from "./mintRoomLogic";
import { MINT_WORDS } from "./mintWordsV1";

interface Props {
  result: PrinterResult | null;
  /** The answer no longer matches the levers. */
  stale: boolean;
  onClose: () => void;
}

function Row({ p }: { p: PlateText }) {
  return (
    <li className="g3d-card">
      <h3>{p.name}</h3>
      <p>
        <strong>{p.verdict}</strong>
      </p>
      {p.lines.map((l) => (
        <p key={l} className="g3d-muted">
          {l}
        </p>
      ))}
    </li>
  );
}

/**
 * The Mint's Plain view: the same plates as lines of text, for anyone who would rather read than look (and for screen readers).
 * Built from the same `mintRoom.ts` functions as the wall, so it can never say more than the wall does: a NOK range appears only
 * where the backend allowed one. Read-only; nothing here is saved.
 */
export default function MintPlainPanel({ result, stale, onClose }: Props) {
  return (
    <aside
      aria-label={MINT_WORDS.plainTitle}
      className="g3d-panel g3d-slide absolute bottom-3 left-3 top-[7.5rem] z-30 md:top-14 w-96 max-w-[94%] overflow-y-auto p-3 text-sm"
    >
      <header className="g3d-head">
        <h2>{MINT_WORDS.plainTitle}</h2>
        <button type="button" className="g3d-x" aria-label={MINT_WORDS.plainClose} onClick={onClose}>
          ×
        </button>
      </header>
      <p className="g3d-muted mt-1">{result?.banner ?? MINT_WORDS.banner}</p>
      {!result ? (
        <p className="mt-2">{MINT_WORDS.wallEmpty}</p>
      ) : (
        <>
          {stale && <p className="mt-2">{MINT_WORDS.wallStale}</p>}
          <ul className="mt-2 space-y-1">
            <Row p={bookPlate(result)} />
            {result.holdings.map((h) => {
              const p = holdingPlate(h);
              return <Row key={p.key} p={p} />;
            })}
          </ul>
          {result.warnings.map((w) => (
            <p key={w} className="g3d-muted mt-2">
              {w}
            </p>
          ))}
        </>
      )}
    </aside>
  );
}
