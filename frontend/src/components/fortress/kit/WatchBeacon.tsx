import ObjectArtImage from "../../ObjectArtImage";
import { useArtMode } from "../../../lib/stitchArt";
import { beaconFor } from "../../../lib/sectionScene";
import type { NightWatchState, NightWatchStatus } from "../../../lib/types";

const WORDS = { lit: "Beacon lit: the watch reported in", alert: "Beacon high: the watch wants a look", out: "Beacon out: the watch has not reported" } as const;

/** The Night Watch turret. The picture is an empty bowl; the flame is drawn here from the stored status, and a watch that has
 * not reported on time is a cold bowl with a wisp of fog, never a lit or "quiet" look. Static, game mode only. */
export default function WatchBeacon({ status, watchState }: { status: NightWatchStatus; watchState: NightWatchState }) {
  if (useArtMode() !== "stitch") return null;
  const state = beaconFor(status, watchState);
  return (
    <div className="relative h-[4.5rem] w-[3.75rem] shrink-0" data-testid="watch-beacon" data-state={state} role="img" aria-label={WORDS[state]}>
      <ObjectArtImage id="watch-turret" width={58} fallback={null} />
      <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-1/2 top-[-6px] h-6 w-6 -translate-x-1/2" aria-hidden="true" focusable="false">
        {state === "lit" && <path d="M12 3c2 4 5 6 5 10a5 5 0 0 1-10 0c0-2 1-3 2-5 1 1 1.5 2 2 2 .5-3 0-5 1-7Z" className="fill-accent" />}
        {state === "alert" && (
          <>
            <path d="M12 1c3 5 7 7 7 12a7 7 0 0 1-14 0c0-3 1.5-4.5 3-7 1 1.5 1.5 2.5 2 2.5.7-3.5 0-5 2-7.5Z" className="fill-negative" />
            <path d="M12 9v5M12 16.5v.5" className="stroke-surface" strokeWidth="2" strokeLinecap="round" fill="none" />
          </>
        )}
        {state === "out" && (
          <path d="M5 16c2-2 3 0 5-1s2-3 4-2 3 2 5 0M6 20c3-1 4 1 6 0s3-1 6 0" className="stroke-ink-faint" strokeWidth="1.4" strokeLinecap="round" fill="none" strokeDasharray="1 2.5" />
        )}
      </svg>
    </div>
  );
}
