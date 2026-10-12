import Crest from "./Crest";
import type { CrestKind } from "../../../lib/crest";
import TorchPair from "./TorchPair";
import RoomBackdrop from "./RoomBackdrop";
import RoomProps from "./RoomProps";

/** The banner at the top of every game room (page-scene kit): a crest for the room, the title on a
 * gilded plate, the subtitle, the page's actions and two wall torches. It replaces PageHeader's plain
 * title only inside game mode on the fortress routes; the Game mode switch (top bar) is the only way back. */
export default function GamePageHeader({
  title,
  subtitle,
  actions,
  crest,
}: {
  title: React.ReactNode;
  subtitle?: string;
  actions?: React.ReactNode;
  crest: CrestKind;
}) {
  return (
    <header className="game-banner relative mb-6 overflow-hidden rounded-xl">
      <RoomBackdrop room={crest} />
      <TorchPair className="pointer-events-none absolute inset-x-0 top-0 h-7 w-full opacity-90" />
      <div className="relative flex flex-col gap-3 px-4 pb-3 pt-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Crest kind={crest} />
          <div className="min-w-0">
            <h1 className="font-display text-xl font-semibold tracking-tight text-[#f6e6bd] sm:text-2xl">{title}</h1>
            {subtitle && <p className="mt-0.5 text-sm text-[#cdb98c]">{subtitle}</p>}
          </div>
        </div>
        <RoomProps room={crest} />
        <div className="game-banner-actions flex flex-wrap items-center gap-3">
          {actions}
        </div>
      </div>
    </header>
  );
}
