import { useEffect, useRef } from "react";
import { STARTER_WORDS } from "./starterWordsV2";

type RowKey = keyof typeof STARTER_WORDS.plain.rows;

/**
 * "Practice yard, plain" (#493): the yard's own Plain view. The same facts as the yard, as labelled lines, for anyone who
 * would rather read than look (and for screen readers). It opens in the yard instead of the flat Fortress, which would show
 * real data. Every row says "Not looked at yet" until its beat has been played; nothing is worked out here.
 */
export default function PracticePlainPanel({ seen, onClose }: { seen: Partial<Record<RowKey, string>>; onClose: () => void }) {
  const p = STARTER_WORDS.plain;
  const keys = Object.keys(p.rows) as RowKey[];
  // The same keyboard path as the other panels: focus moves in, Escape closes, and focus goes back to what opened it.
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Escape") return;
      e.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      opener?.focus();
    };
  }, [onClose]);
  return (
    <aside
      aria-label={p.title}
      className="g3d-panel g3d-slide absolute bottom-3 left-3 top-[7rem] z-30 md:top-[6.25rem] w-80 max-w-[94%] overflow-y-auto p-3 text-sm"
    >
      <header className="g3d-head">
        <h2>{p.title}</h2>
        <button ref={close} type="button" className="g3d-x" aria-label={p.close} onClick={onClose}>
          ×
        </button>
      </header>
      <p className="g3d-muted mt-1">{p.intro}</p>
      <dl className="mt-2 space-y-1">
        {keys.map((k) => (
          <div key={k} className="g3d-card">
            <dt className="g3d-tag">{p.rows[k]}</dt>
            <dd className={seen[k] ? "" : "g3d-muted italic"}>{seen[k] ?? p.notYet}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
