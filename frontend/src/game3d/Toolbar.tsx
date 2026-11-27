import type { OpenPanels, PanelId } from "./hudPanels";
import { soundLabel } from "./soundPlan";
import type { StickSide } from "./touchInput";
import { TOUCH_WORDS } from "./touchWordsV1";

interface Props {
  open: OpenPanels;
  onToggle: (id: PanelId) => void;
  /** Quests still open (a badge, so a shut panel does not hide that something is waiting). */
  questsWaiting: number;
  /** Round stops still open (real or sample); 0 hides it. It replaces the quest badge on the chip so the chip never grows. */
  roundOpen?: number;
  /**
   * First Steps still to do (#478). While First Steps is open the panel shows it first and alone, so the chip counts it,
   * over the round and the long quests. 0 (or left out) falls back to the round, then the quests.
   */
  guideLeft?: number;
  /** Screen-reader name for the chip while First Steps is open. */
  guideLabel?: string;
  towerCount: number;
  statsOn: boolean;
  statsLabel: string;
  onToggleStats: () => void;
  /** The frame-rate readout is a developer tool: shown with ?debug, or while it is on. P and F3 still toggle it. */
  showStats?: boolean;
  /** The "Where to?" signpost menu: open or not, and a way to flip it. */
  whereOpen: boolean;
  onToggleWhere: () => void;
  /** Opt-in sound. Left out where the browser has no Web Audio, so no dead button shows. */
  sound?: { on: boolean; onToggle: () => void };
  /** In the practice yard: hide the tools that open the real fortress's panels. */
  practice?: boolean;
  /** Touch screens only (#485): which side the thumb stick is on, and a way to swap it with the seal. Left out on a desktop. */
  hands?: { side: StickSide; onSwap: () => void };
}

function Tool({
  label,
  hint,
  icon,
  pressed,
  badge,
  label_aria,
  onClick,
}: {
  label: string;
  hint: string;
  icon: string;
  pressed: boolean;
  badge?: number;
  label_aria?: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="g3d-tool" aria-pressed={pressed} title={`${label} (${hint})`} aria-label={label_aria} onClick={onClick}>
      <span aria-hidden className="g3d-tool-icon">{icon}</span>
      <span>{label}</span>
      {badge !== undefined && badge > 0 && <span className="g3d-badge">{badge}</span>}
      <kbd aria-hidden className="g3d-kbd">{hint}</kbd>
    </button>
  );
}

/** The little menu at the top: open or shut each panel, so the scene stays clear until you want a panel. */
export default function Toolbar({ open, onToggle, questsWaiting, roundOpen = 0, guideLeft = 0, guideLabel, towerCount, statsOn, statsLabel, onToggleStats, showStats = true, whereOpen, onToggleWhere, sound, practice = false, hands }: Props) {
  return (
    <div role="toolbar" aria-label="Courtyard menu" className="g3d-toolbar absolute left-1/2 top-3 z-30 -translate-x-1/2">
      {/* The practice yard (#493) shows nothing of the real fortress: no Quests or Towers there, only the way out and sound. */}
      {!practice && <Tool
        label="Quests"
        hint="Q"
        icon="📜"
        pressed={open.quests}
        badge={guideLeft > 0 ? guideLeft : roundOpen > 0 ? roundOpen : questsWaiting}
        label_aria={guideLeft > 0 ? guideLabel : roundOpen > 0 ? `Quests, ${roundOpen} stops open` : undefined}
        onClick={() => onToggle("quests")}
      />}
      {!practice && <Tool label="Towers" hint="T" icon="🏰" pressed={open.towers} badge={towerCount} onClick={() => onToggle("towers")} />}
      <Tool label="Where to?" hint="G" icon="🪧" pressed={whereOpen} onClick={onToggleWhere} />
      {sound && <Tool label={soundLabel(sound.on).label} hint="M" icon={soundLabel(sound.on).icon} pressed={sound.on} onClick={sound.onToggle} />}
      {/* Touch only: swap the stick and the seal for a left hand. */}
      {hands && (
        <button type="button" className="g3d-tool" title={TOUCH_WORDS.swapChip} aria-label={TOUCH_WORDS.swapLabel(hands.side)} onClick={hands.onSwap}>
          <span aria-hidden className="g3d-tool-icon">🤚</span>
          <span>{TOUCH_WORDS.swapChip}</span>
        </button>
      )}
      {(showStats || statsOn) && <Tool label={statsOn ? statsLabel : "Stats"} hint="P" icon="📊" pressed={statsOn} onClick={onToggleStats} />}
    </div>
  );
}
