import { useState } from "react";
import type { StandingWire } from "../lib/types";
import { LOOKED_BUTTON, WIRES_SAMPLE, WIRES_TITLE, lookAtWire, wireLine } from "./wires";

/**
 * Fired wires nobody has looked at yet, one line and one button each (Standing 3, T2). Pressing the
 * button marks the wire seen through the call the Thesis page already uses, then the Standing is read
 * again. Nothing here says what to do about a holding.
 */
export default function WireList({
  wires,
  demo,
  onLook,
  onRefresh,
}: {
  wires: readonly StandingWire[];
  demo: boolean;
  onLook: (id: string) => Promise<unknown>;
  onRefresh: () => Promise<unknown>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  if (!demo && wires.length === 0) return null;

  async function look(id: string) {
    setBusy(id);
    setMessage(null);
    const r = await lookAtWire(id, onLook, onRefresh);
    setBusy(null);
    if (!r.ok) setMessage(r.message);
  }

  return (
    <section className="g3d-card" aria-label={WIRES_TITLE}>
      <p className="g3d-tag">Watch</p>
      <h3>{WIRES_TITLE}</h3>
      {demo ? (
        <p className="g3d-muted">{WIRES_SAMPLE}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {wires.map((w) => (
            <li key={w.tripwire_id}>
              <p>{wireLine(w)}</p>
              {w.label && <p className="g3d-muted">{w.label}</p>}
              <button type="button" className="g3d-btn mt-1" disabled={busy !== null} onClick={() => look(w.tripwire_id)}>
                {LOOKED_BUTTON}
              </button>
            </li>
          ))}
        </ul>
      )}
      {message && <p role="alert" className="g3d-muted mt-2">{message}</p>}
    </section>
  );
}
