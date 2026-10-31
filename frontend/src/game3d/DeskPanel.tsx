import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { JournalEntryInput } from "../lib/types";
import { describeError } from "../lib/errors";
import { DESK_BLOCK_WORDS, deskInput, deskReady } from "./deskForm";
import type { DeskBlock } from "./deskForm";
import type { TowerView } from "./stateToWorld";

/**
 * The writing desk panel (Standing 2): pick a holding (the biggest one still unwritten is already
 * chosen), write two lines, press "Write it down". It creates one NEW journal entry through the
 * journal write the app already has; it never edits or deletes an old one. If the save fails the
 * words stay where they are and the panel says so. Nothing is saved until the button is pressed.
 */
export default function DeskPanel({
  holdings,
  missing,
  written,
  block,
  onSave,
  onClose,
}: {
  holdings: readonly TowerView[];
  /** Holdings that still lack a reason or a wrong-if line, biggest first. */
  missing: readonly TowerView[];
  written: number;
  /** Why saving is off right now (sample, unreadable, ...), or null. */
  block: DeskBlock | null;
  onSave: (input: JournalEntryInput) => Promise<void>;
  onClose: () => void;
}) {
  const firstId = (missing[0] ?? holdings[0])?.holdingId ?? "";
  const [holdingId, setHoldingId] = useState(firstId);
  const [why, setWhy] = useState("");
  const [wrongIf, setWrongIf] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedName, setSavedName] = useState<string | null>(null);

  // After a save the next unwritten holding is picked for you; a holding you chose yourself stays.
  const known = holdings.some((h) => h.holdingId === holdingId);
  useEffect(() => {
    if (!known && firstId) setHoldingId(firstId);
  }, [known, firstId]);

  const draft = { holdingId, why, wrongIf };
  const ready = deskReady(draft) && block === null && !saving;
  const total = holdings.length;

  const save = async () => {
    if (!ready) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(deskInput(draft));
      const name = holdings.find((h) => h.holdingId === holdingId)?.name ?? "it";
      setSavedName(name);
      setWhy("");
      setWrongIf("");
      // Move on to the next holding that still needs words, if any.
      const next = missing.find((m) => m.holdingId !== holdingId);
      if (next) setHoldingId(next.holdingId);
    } catch (e) {
      // Keep what was typed so nothing is lost.
      setError(describeError(e, "your journal").message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <aside aria-label="Writing desk" className="g3d-panel g3d-slide absolute right-3 top-14 z-20 max-h-[calc(100%-4.5rem)] w-80 max-w-[44%] overflow-y-auto p-3 text-sm">
      <header className="g3d-head">
        <h2>✒️ Writing desk</h2>
        <button type="button" className="g3d-x" aria-label="Close the desk" onClick={onClose}>×</button>
      </header>

      {block ? (
        <p className="g3d-demo" role="status">{DESK_BLOCK_WORDS[block]}</p>
      ) : (
        <p className="g3d-muted mt-1">{written} of {total} holdings have both lines.</p>
      )}

      <label className="g3d-label" htmlFor="desk-holding">Holding</label>
      <select
        id="desk-holding"
        className="g3d-field"
        value={holdingId}
        disabled={block !== null || saving}
        onChange={(e) => {
          setHoldingId(e.target.value);
          setSavedName(null);
        }}
      >
        {holdings.map((h) => (
          <option key={h.holdingId} value={h.holdingId}>{h.name}</option>
        ))}
      </select>

      <label className="g3d-label" htmlFor="desk-why">Why I own it</label>
      <textarea id="desk-why" className="g3d-field" rows={3} value={why} disabled={block !== null || saving} onChange={(e) => setWhy(e.target.value)} />

      <label className="g3d-label" htmlFor="desk-wrong">What proves me wrong</label>
      <textarea id="desk-wrong" className="g3d-field" rows={3} value={wrongIf} disabled={block !== null || saving} onChange={(e) => setWrongIf(e.target.value)} />

      <div className="mt-3 flex items-center gap-2">
        <button type="button" className="g3d-btn" disabled={!ready} onClick={save}>
          {saving ? "Writing..." : "Write it down"}
        </button>
        <button type="button" className="g3d-btn" onClick={onClose}>Close (E)</button>
      </div>

      <div aria-live="polite">
        {savedName && !error && <p className="g3d-muted mt-2">Written down for {savedName}.</p>}
        {error && <p className="g3d-demo" role="alert">Not saved: {error} Your words are still here.</p>}
      </div>

      <p className="g3d-muted mt-3">
        Old entries and real buys or sells: <Link to="/journal" className="underline">the journal</Link>.
      </p>
    </aside>
  );
}
