import type { Shelf, ShelfTone } from "./libraryShelves";
import { SHELF_MARK, shelfMark } from "./libraryShelves";

interface Props {
  name: string;
  /** Only the shelf you are standing at: the other shelves are not listed. */
  shelf: Shelf;
  demo: boolean;
  onClose: () => void;
}

const STATE_WORDS = { known: "", unknown: "Not surveyed", na: "Doesn't apply" } as const;

function Mark({ tone, mark }: { tone: ShelfTone; mark?: string }) {
  return <span aria-hidden="true">{mark ?? SHELF_MARK[tone]} </span>;
}

/**
 * The facts of one shelf, in words (the plain view of what you stand at). Unknown stays "Not surveyed".
 */
export default function ShelfPanel({ name, shelf: s, demo, onClose }: Props) {
  return (
    <aside
      aria-label={`${name}, ${s.title}, in words`}
      className="g3d-panel g3d-slide absolute bottom-3 right-3 top-14 z-20 w-80 max-w-[44%] overflow-y-auto p-3 text-sm"
    >
      <header className="g3d-head">
        <h2>📚 {s.title}</h2>
        <button type="button" className="g3d-x" aria-label="Close the shelf" onClick={onClose}>×</button>
      </header>
      {demo && <p className="g3d-demo">Sample fortress, not your holdings.</p>}
      <p className="g3d-muted mt-1">
        <Mark tone={s.tone} mark={shelfMark(s)} />
        {name} · {s.asks}
        {s.state !== "known" && <span className="g3d-chip fog ml-2">{STATE_WORDS[s.state]}</span>}
      </p>
      <ul className="mt-2 space-y-1">
        {s.lines.map((l, i) => (
          <li key={i} className="g3d-muted">
            {l.tone !== undefined && <Mark tone={l.tone} />}
            {l.label && <strong className="font-semibold text-[#fff1cf]">{l.label}: </strong>}
            {l.text}
          </li>
        ))}
      </ul>
      <button type="button" className="g3d-btn mt-3" onClick={onClose}>Close (E)</button>
    </aside>
  );
}
