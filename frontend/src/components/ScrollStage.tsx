import LampLogo from "./LampLogo";
import { sealVisible, type ScrollPhase } from "../lib/scroll";

/** Game mode G28: the two rollers of the scroll reader. Decoration only (hidden from assistive tech). */
export function ScrollRollers({ phase }: { phase: ScrollPhase }) {
  return (
    <>
      <div className="scroll-roller scroll-roller-top" data-phase={phase} aria-hidden="true" />
      <div className="scroll-roller scroll-roller-bottom" data-phase={phase} aria-hidden="true" />
    </>
  );
}

/** Game mode G28: the wax seal and its caption, shown until the paper starts to unroll. Pressing
 * the seal moves the sequence on; any key skips it (handled by the reader). */
export function ScrollSeal({
  phase,
  kicker,
  title,
  onBreak,
}: {
  phase: ScrollPhase;
  kicker: string;
  title: string;
  onBreak: () => void;
}) {
  if (!sealVisible(phase)) return null;
  return (
    <>
      <button type="button" className="scroll-seal" data-phase={phase} onClick={onBreak} aria-label="Break the seal and open the report">
        <LampLogo simple className="h-10 w-10" />
      </button>
      <div className="scroll-caption" data-phase={phase} aria-hidden="true">
        <p className="text-[11px] uppercase tracking-widest text-[#d9bf86]">{kicker}</p>
        <p className="font-display text-base">{title}</p>
        <p className="mt-1 text-[11px] text-[#d9bf86]/80">Press any key to open</p>
      </div>
    </>
  );
}
