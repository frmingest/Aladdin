import Crest from "./Crest";
import type { CrestKind } from "../../../lib/crest";
import TorchPair from "./TorchPair";
import { useArtPack } from "../../../lib/artPack";
import { PLAIN_TOGGLE_ID, togglePlain, usePlainView } from "../../../lib/plainView";

/** The banner at the top of every game room (page-scene kit): a crest for the room, the title on a
 * gilded plate, the subtitle, the page's actions and two wall torches. It replaces PageHeader's plain
 * title only inside game mode on the fortress routes; Plain view brings the ordinary header back. */
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
  const [plain, setPlain] = usePlainView();
  const [art, setArt] = useArtPack();
  return (
    <header className={`game-banner${art ? " game-banner-art" : ""} relative mb-6 overflow-hidden rounded-xl`}>
      {!art && <TorchPair className="pointer-events-none absolute inset-x-0 top-0 h-7 w-full opacity-90" />}
      <div
        className={`relative flex flex-col gap-3 ${
          art ? "items-center px-[12%] py-5 sm:px-[27%]" : "px-4 pb-3 pt-6 sm:flex-row sm:items-center sm:justify-between sm:px-6"
        }`}
      >
        <div className={`flex min-w-0 items-center gap-3${art ? " justify-center" : ""}`}>
          <Crest kind={crest} />
          <div className="min-w-0">
            <h1 className="font-display text-xl font-semibold tracking-tight text-[#f6e6bd] sm:text-2xl">{title}</h1>
            {subtitle && <p className="mt-0.5 text-sm text-[#cdb98c]">{subtitle}</p>}
          </div>
        </div>
        <div className={`game-banner-actions flex flex-wrap items-center gap-3${art ? " justify-center" : ""}`}>
          {actions}
          <button
            type="button"
            onClick={() => setArt(!art)}
            aria-pressed={art}
            title="Switch the generated artwork on or off"
            className="min-h-[44px] whitespace-nowrap rounded-md border border-[#8a6a32] px-3 text-xs font-semibold text-[#f2d27a] hover:bg-black/20"
          >
            Painted art
          </button>
          <button
            id={PLAIN_TOGGLE_ID}
            type="button"
            onClick={() => togglePlain(plain, setPlain)}
            aria-pressed={plain}
            className="min-h-[44px] whitespace-nowrap rounded-md border border-[#8a6a32] px-3 text-xs font-semibold text-[#f2d27a] hover:bg-black/20"
          >
            Plain view
          </button>
        </div>
      </div>
    </header>
  );
}
