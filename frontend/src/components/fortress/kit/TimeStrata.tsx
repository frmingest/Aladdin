import { Link } from "react-router-dom";
import { dayLabel, strata, timeStrip } from "../../../lib/chronicle";
import type { Chronicle } from "../../../lib/types";
import ObjectArtImage from "../../ObjectArtImage";
import { gapPlotId } from "../../../lib/roomArt";
import "./strata.css";

/** A change on the spine: a lozenge, or (Object art on) a block of strata, one layer per day on record. */
function ChangeMark() {
  return <ObjectArtImage id="strata-block" width={22} className="strata-mark-img" fallback={<span className="strata-mark" aria-hidden />} />;
}

/** Beside a gap (Object art on): a wall sconce whose torch is out. The ring with a slash and the hatched
 * block stay, so a gap is told by shape and by its words; the sconce only says "no light was kept". */
function GapSconce() {
  // The covered plot says "nothing was kept here" more plainly than the dark sconce; the sconce is the fallback.
  const plot = gapPlotId();
  const sconce = <ObjectArtImage id="room-sconce" width={36} className="strata-sconce" fallback={null} />;
  if (!plot) return sconce;
  return <ObjectArtImage id={plot} width={44} className="strata-sconce" fallback={sconce} />;
}

/** The Chronicle as time strata (game mode, Stitch room look): a strip that shows where the stored frames
 * and the unrecorded days fall, and a spine of what changed. A gap is drawn as a hatched gap, never as a
 * quiet day. It shows only what the Chronicle already holds: no count or label of its own. The strip is
 * decoration (aria-hidden); the spine is the same facts as a list. */

export function TimeStrip({ chronicle }: { chronicle: Chronicle }) {
  const strip = timeStrip(chronicle);
  if (!strip) return null;
  return (
    <div className="strata-strip" aria-hidden>
      <div className="strata-rail" />
      {strip.gaps.map((g, n) => (
        <span key={n} className="strata-void" style={{ left: `${g.left}%`, width: `${g.width}%` }} />
      ))}
      {strip.ticks.map((t, n) => (
        <span key={n} className={`strata-tick ${t.source === "stored" ? "is-stored" : "is-rebuilt"}`} style={{ left: `${t.at}%` }} />
      ))}
    </div>
  );
}

export default function TimeStrata({ chronicle }: { chronicle: Chronicle }) {
  const entries = strata(chronicle);
  return (
    <ol className="strata-spine">
      {entries.map((e) =>
        e.kind === "gap" ? (
          <li key={`gap-${e.first_day}`} className="strata-node strata-node-gap">
            <span className="strata-mark" aria-hidden />
            <div className="strata-gap">
              <GapSconce />
              <span className="strata-day">
                {dayLabel(e.first_day)} – {dayLabel(e.last_day)}
              </span>
              <p>{e.text}</p>
            </div>
          </li>
        ) : (
          <li key={`chg-${e.day}`} className="strata-node">
            <ChangeMark />
            <div className="strata-entry">
              <span className="strata-day">{dayLabel(e.day)}</span>
              <ul>
                {e.changes.map((c, n) => (
                  <li key={`${c.kind}-${n}`}>
                    {c.holding_id && c.holding_name ? (
                      <>
                        <Link to={`/holdings/${c.holding_id}`} className="text-accent hover:underline">
                          {c.holding_name}
                        </Link>
                        {c.text.startsWith(c.holding_name) ? c.text.slice(c.holding_name.length) : `: ${c.text}`}
                      </>
                    ) : (
                      c.text
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </li>
        ),
      )}
    </ol>
  );
}
