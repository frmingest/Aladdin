import { useState } from "react";
import { Link } from "react-router-dom";
import { describeError } from "../lib/errors";
import type { StormDrillInput } from "../lib/types";
import { FALL_DEFAULT, FALL_MAX, FALL_MIN, FALL_STEP, drillInput, drillReady, fallPercent } from "./stormDrill";
import type { DrillBlock } from "./stormDrill";
import {
  DRILL_BLOCK_WORDS,
  DRILL_FALL_LABEL,
  DRILL_PANEL_SUB,
  DRILL_PANEL_TITLE,
  DRILL_PLAN_LABEL,
  DRILL_SAVE,
  DRILL_SAVING,
} from "./stormDrillWordsV1";

/**
 * The Storm Drill panel: pick a fall (the camp is already standing), write what you would do,
 * press "Write it down". It creates one NEW drill note; it never edits or deletes an old one. If
 * the save fails the words stay where they are and the panel says so. Nothing is saved until the
 * button is pressed.
 */
export default function DrillPanel({
  count,
  block,
  onSave,
  onClose,
}: {
  count: number;
  block: DrillBlock | null;
  onSave: (input: StormDrillInput) => Promise<void>;
  onClose: () => void;
}) {
  const [fall, setFall] = useState(FALL_DEFAULT);
  const [plan, setPlan] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const draft = { fall, plan };
  const ready = drillReady(draft) && block === null && !saving;

  const save = async () => {
    if (!ready) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(drillInput(draft));
      setSaved(true);
      setPlan("");
    } catch (e) {
      setError(describeError(e, "your drills").message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <aside aria-label="Storm Drill" className="g3d-panel g3d-slide absolute right-3 top-14 z-20 max-h-[calc(100%-4.5rem)] w-80 max-w-[44%] overflow-y-auto p-3 text-sm">
      <header className="g3d-head">
        <h2>⚔️ {DRILL_PANEL_TITLE}</h2>
        <button type="button" className="g3d-x" aria-label="Close the drill" onClick={onClose}>×</button>
      </header>
      <p className="g3d-muted mt-1">{DRILL_PANEL_SUB}</p>
      {block ? (
        <p className="g3d-demo" role="status">{DRILL_BLOCK_WORDS[block]}</p>
      ) : (
        <p className="g3d-muted mt-1">{count === 0 ? "No drills written yet." : `${count} written so far.`}</p>
      )}

      <label className="g3d-label" htmlFor="drill-fall">{DRILL_FALL_LABEL} {fallPercent(fall)}</label>
      <input
        id="drill-fall"
        type="range"
        className="w-full"
        min={FALL_MIN}
        max={FALL_MAX}
        step={FALL_STEP}
        value={fall}
        disabled={block !== null || saving}
        onChange={(e) => {
          setFall(Number(e.target.value));
          setSaved(false);
        }}
      />

      <label className="g3d-label" htmlFor="drill-plan">{DRILL_PLAN_LABEL}</label>
      <textarea
        id="drill-plan"
        className="g3d-field"
        rows={4}
        value={plan}
        disabled={block !== null || saving}
        onChange={(e) => setPlan(e.target.value)}
      />

      <div className="mt-3 flex items-center gap-2">
        <button type="button" className="g3d-btn" disabled={!ready} onClick={save}>
          {saving ? DRILL_SAVING : DRILL_SAVE}
        </button>
        <button type="button" className="g3d-btn" onClick={onClose}>Close (E)</button>
      </div>

      <div aria-live="polite">
        {saved && !error && <p className="g3d-muted mt-2">Written down.</p>}
        {error && <p className="g3d-demo" role="alert">Not saved: {error} Your words are still here.</p>}
      </div>

      <p className="g3d-muted mt-3">
        What a fall does to each tower: <Link to="/fortress/siege" className="underline">the Siege Simulator</Link>.
      </p>
    </aside>
  );
}
