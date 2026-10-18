import ObjectArtImage from "../../ObjectArtImage";
import { getObjectArt, useArtMode } from "../../../lib/stitchArt";
import CouncilChamber from "./CouncilChamber";
import { seatLabel, type Seat } from "../../../lib/councilSeats";
import { ASK_LABEL } from "../../../lib/councilAsk";
import type { GameAdvisorName } from "../../../lib/types";

/** Where each counselor sits in the room pictures, as percent of the picture (both rooms share one layout):
 * a hotspot over the painted figure. The Oracle sits left of the table, the Partner right. */
const SITTERS = [
  { who: "oracle", left: 17, top: 28, width: 18.5, height: 55.5 },
  { who: "partner", left: 62.9, top: 30, width: 20.7, height: 52 },
] as const;

function Sitter({ who, left, top, width, height, onCall }: (typeof SITTERS)[number] & { onCall: (who: GameAdvisorName) => void }) {
  return (
    <button type="button" className="council-sitter" style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }} onClick={() => onCall(who)}>
      <span className="council-sitter-tag">{ASK_LABEL[who]}</span>
    </button>
  );
}

/** A quiet night: nothing on the agenda, so eight hollow "none found" seats are replaced by one picture of
 * the empty hall and one line. It is not a reward or an all clear: the line says the rules found nothing,
 * and the unchecked-rules note stays when something could not be checked. With Object art off, or no picture
 * packed, the usual chamber is drawn instead. */
export default function CouncilQuiet({
  seats,
  onJump,
  unresolved,
  onCall,
  busy = false,
}: {
  seats: Seat[];
  onJump: (kind: Seat["kind"]) => void;
  unresolved: boolean;
  /** Pressing a seated counselor: the page hands the call to the lectern below. Without it they are not buttons. */
  onCall?: (who: GameAdvisorName) => void;
  /** The agenda has items: the room shows the table laid with papers, and the occupied seats become a row of buttons. */
  busy?: boolean;
}) {
  const mode = useArtMode();
  const roomId = busy ? "council-room-busy" : "council-room-quiet";
  if (mode !== "stitch" || getObjectArt(roomId) === null) {
    return <CouncilChamber seats={seats} onJump={onJump} unresolved={unresolved} />;
  }
  const occupied = seats.filter((s) => s.occupied);
  return (
    <div
      className="chamber relative overflow-hidden rounded-xl p-2 text-center sm:p-3"
      role="group"
      aria-label={busy ? "Council chamber: items on the agenda tonight" : "Council chamber: nothing on the agenda tonight"}
    >
      <div className="council-room mx-auto max-w-5xl">
        <ObjectArtImage id={roomId} width={1200} className="block h-auto w-full rounded-lg" fallback={null} />
        {onCall && SITTERS.map((x) => <Sitter key={x.who} {...x} onCall={onCall} />)}
      </div>
      {busy ? (
        <ul className="mt-2 flex flex-wrap justify-center gap-2" aria-label="Council seats">
          {occupied.map((s) => (
            <li key={s.kind}>
              <button
                type="button"
                className="min-h-[44px] rounded-md border border-[#d9a93e] bg-[#3a2414] px-3 py-1 text-xs font-semibold text-[#f6e6bd] hover:bg-[#4a3220] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#f2d27a]"
                aria-label={seatLabel(s)}
                onClick={() => onJump(s.kind)}
              >
                {s.label}
                {s.count !== null && <span className="ml-1.5 text-[#f2d27a]">{s.count}</span>}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <>
          <p className="mt-2 text-sm font-semibold text-[#f6e6bd]">Nothing on the table tonight.</p>
          <p className="text-xs text-[#cdb98c]">The rules found nothing. That is not proof there is nothing.</p>
        </>
      )}
      {unresolved && (
        <p className="mt-2 border-t border-dashed border-[#6b5a3c] pt-2 text-xs text-[#cdb98c]">
          Some rules could not be checked (see below). An empty chair is not proof of nothing.
        </p>
      )}
    </div>
  );
}
