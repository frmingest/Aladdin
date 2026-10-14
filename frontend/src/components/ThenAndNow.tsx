import { useState } from "react";
import { api } from "../lib/api";
import { describeError } from "../lib/errors";
import { formatDate } from "../lib/format";
import type { ThenAndNow as ThenAndNowData, ThenNowChange } from "../lib/types";

/** B2 Then and Now. Opens under a journal record and shows what the analyst believed the day the
 * decision was written next to what it believes now. Only lines that changed are shown; there are
 * no arrows, colours or words that call a change good or bad. Both sides are the analyst's view
 * before it saw your notes, so your own thesis never colours it. Read-only. */

function Items({ items }: { items: string[] }) {
  if (items.length === 0) return <p className="text-ink-faint">Nothing listed.</p>;
  return (
    <ul className="list-disc space-y-1 pl-5 text-ink">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

function Change({ c }: { c: ThenNowChange }) {
  return (
    <div className="rounded-md border border-border-subtle p-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{c.label}</h4>
      {c.kind === "value" ? (
        <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-ink-faint">Then</dt>
            <dd className="text-ink">{c.then_value ?? <span className="text-ink-faint">Not stated</span>}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-faint">Now</dt>
            <dd className="text-ink">{c.now_value ?? <span className="text-ink-faint">Not stated</span>}</dd>
          </div>
        </dl>
      ) : (
        <>
          <div className="mt-2 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs text-ink-faint">Then</p>
              <Items items={c.then_items} />
            </div>
            <div>
              <p className="mb-1 text-xs text-ink-faint">Now</p>
              <Items items={c.now_items} />
            </div>
          </div>
          <p className="mt-2 text-xs text-ink-faint">
            The model words these differently each time, so read the two lists side by side.
          </p>
        </>
      )}
    </div>
  );
}

export function ThenAndNowView({ data }: { data: ThenAndNowData }) {
  if (data.status !== "compared") {
    return <p className="text-sm text-ink-muted">{data.note}</p>;
  }
  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-faint">
        Then: analysed {data.then?.analyzed_at ? formatDate(data.then.analyzed_at) : "on an unknown date"}. Now: analysed{" "}
        {data.now?.analyzed_at ? formatDate(data.now.analyzed_at) : "on an unknown date"}. Both are the analyst&apos;s view
        before it saw your notes.
      </p>
      {data.changes.length === 0 ? (
        <p className="text-sm text-ink-muted">{data.note}</p>
      ) : (
        <div className="space-y-3">
          {data.changes.map((c) => (
            <Change key={c.key} c={c} />
          ))}
        </div>
      )}
      {data.unchanged_count > 0 && data.changes.length > 0 && (
        <p className="text-xs text-ink-faint">
          {data.unchanged_count} other {data.unchanged_count === 1 ? "line says" : "lines say"} the same as then.
        </p>
      )}
    </div>
  );
}

type Load =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "done"; data: ThenAndNowData };

export default function ThenAndNow({ entryId }: { entryId: string }) {
  const [open, setOpen] = useState(false);
  const [load, setLoad] = useState<Load>({ state: "idle" });

  const fetchIt = () => {
    setLoad({ state: "loading" });
    api
      .getThenAndNow(entryId)
      .then((data) => setLoad({ state: "done", data }))
      .catch((e: unknown) => setLoad({ state: "error", message: describeError(e, "the comparison").message }));
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && (load.state === "idle" || load.state === "error")) fetchIt();
  };

  const panelId = `then-now-${entryId}`;
  return (
    <div className="mt-3 border-t border-border-subtle pt-3">
      <button
        type="button"
        className="text-sm text-accent underline underline-offset-2"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggle}
      >
        {open ? "Hide then and now" : "Then and now"}
      </button>
      <div id={panelId} className="mt-2" hidden={!open} aria-live="polite">
        {load.state === "loading" && <p className="text-sm text-ink-muted">Opening the old analysis…</p>}
        {load.state === "error" && <p className="text-sm text-ink-muted">{load.message}</p>}
        {load.state === "done" && <ThenAndNowView data={load.data} />}
      </div>
    </div>
  );
}
