import ObjectArtImage from "../../ObjectArtImage";
import { getObjectArt, useArtMode } from "../../../lib/stitchArt";
import CouncilChamber from "./CouncilChamber";
import type { Seat } from "../../../lib/councilSeats";

/** A quiet night: nothing on the agenda, so eight hollow "none found" seats are replaced by one picture of
 * the empty hall and one line. It is not a reward or an all clear: the line says the rules found nothing,
 * and the unchecked-rules note stays when something could not be checked. With Object art off, or no picture
 * packed, the usual chamber is drawn instead. */
export default function CouncilQuiet({
  seats,
  onJump,
  unresolved,
}: {
  seats: Seat[];
  onJump: (kind: Seat["kind"]) => void;
  unresolved: boolean;
}) {
  const mode = useArtMode();
  if (mode !== "stitch" || getObjectArt("council-quiet") === null) {
    return <CouncilChamber seats={seats} onJump={onJump} unresolved={unresolved} />;
  }
  return (
    <div className="chamber relative overflow-hidden rounded-xl px-4 py-5 text-center" role="group" aria-label="Council chamber: nothing on the agenda tonight">
      <div className="mx-auto max-w-md">
        <ObjectArtImage id="council-quiet" width={448} className="mx-auto h-auto max-w-full" fallback={null} />
      </div>
      <p className="mt-1 text-sm font-semibold text-[#f6e6bd]">Nothing on the table tonight.</p>
      <p className="text-xs text-[#cdb98c]">The rules found nothing. That is not proof there is nothing.</p>
      {unresolved && (
        <p className="mt-2 border-t border-dashed border-[#6b5a3c] pt-2 text-xs text-[#cdb98c]">
          Some rules could not be checked (see below). An empty chair is not proof of nothing.
        </p>
      )}
    </div>
  );
}
