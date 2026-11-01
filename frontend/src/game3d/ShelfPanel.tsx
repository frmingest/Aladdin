import type { Shelf, ShelfId, ShelfTone } from "./libraryShelves";
import { SHELF_MARK, shelfMark } from "./libraryShelves";

interface Props {
  name: string;
  /** The shelf you are reading (opened); the others stay folded so the whole library is still listed in words. */
  open: ShelfId | null;
  shelves: Shelf[];
  demo: boolean;
  onClose: () => void;
}

const STATE_WORDS = { known: "", unknown: "Not surveyed", na: "Doesn't apply" } as const;

function Mark({ tone, mark }: { tone: ShelfTone; mark?: string }) {
  return <span aria-hidden="true">{mark ?? SHELF_MARK[tone]} </span>;
}

/**
 * The facts of the library, in words. The room is for mood and walking; this list says exactly what each
 * shelf stands for, and it lists every shelf (the plain view of the room). Unknown stays "Not surveyed".
 */
export default function ShelfPanel({ name, open, shelves, demo, onClose }: Props) {
  return (
    <aside
      aria-label={`${name} library, in words`}
      className="g3d-panel g3d-slide absolute bottom-3 right-3 top-14 z-20 w-80 max-w-[44%] overflow-y-auto p-3 text-sm"
    >
      <header className="g3d-head">
        <h2>📚 {name}</h2>
        <button type="button" className="g3d-x" aria-label="Close the shelf" onClick={onClose}>×</button>
      </header>
      {demo && <p className="g3d-demo">Sample fortress, not your holdings.</p>}
      <p className="g3d-muted mt-1">More books means sturdier, safer or bigger. Bare shelf means nothing good to show.</p>
      <div className="mt-2 space-y-2">
        {shelves.map((s) => (
          <details key={`${s.id}-${s.id === open}`} className="g3d-card !mt-0" open={s.id === open}>
            <summary className="cursor-pointer">
              <span className="font-semibold text-[#fff1cf]">
                <Mark tone={s.tone} mark={shelfMark(s)} />
                {s.title}
              </span>
              <span className="g3d-muted"> · {s.asks}</span>
              {s.state !== "known" && <span className="g3d-chip fog ml-2">{STATE_WORDS[s.state]}</span>}
            </summary>
            <ul className="mt-2 space-y-1">
              {s.lines.map((l, i) => (
                <li key={i} className="g3d-muted">
                  {l.tone !== undefined && <Mark tone={l.tone} />}
                  {l.label && <strong className="font-semibold text-[#fff1cf]">{l.label}: </strong>}
                  {l.text}
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
      <button type="button" className="g3d-btn mt-3" onClick={onClose}>Close (E)</button>
    </aside>
  );
}
