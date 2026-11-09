import type { OpenPanels, PanelId } from "./hudPanels";
import { soundLabel } from "./soundPlan";

interface Props {
  open: OpenPanels;
  onToggle: (id: PanelId) => void;
  /** Quests still open (a badge, so a shut panel does not hide that something is waiting). */
  questsWaiting: number;
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
}

function Tool({
  label,
  hint,
  icon,
  pressed,
  badge,
  onClick,
}: {
  label: string;
  hint: string;
  icon: string;
  pressed: boolean;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button type="button" className="g3d-tool" aria-pressed={pressed} title={`${label} (${hint})`} onClick={onClick}>
      <span aria-hidden className="g3d-tool-icon">{icon}</span>
      <span>{label}</span>
      {badge !== undefined && badge > 0 && <span className="g3d-badge">{badge}</span>}
      <kbd aria-hidden className="g3d-kbd">{hint}</kbd>
    </button>
  );
}

/** The little menu at the top: open or shut each panel, so the scene stays clear until you want a panel. */
export default function Toolbar({ open, onToggle, questsWaiting, towerCount, statsOn, statsLabel, onToggleStats, showStats = true, whereOpen, onToggleWhere, sound }: Props) {
  return (
    <div role="toolbar" aria-label="Courtyard menu" className="g3d-toolbar absolute left-1/2 top-3 z-30 -translate-x-1/2">
      <Tool label="Quests" hint="Q" icon="📜" pressed={open.quests} badge={questsWaiting} onClick={() => onToggle("quests")} />
      <Tool label="Towers" hint="T" icon="🏰" pressed={open.towers} badge={towerCount} onClick={() => onToggle("towers")} />
      <Tool label="Where to?" hint="G" icon="🪧" pressed={whereOpen} onClick={onToggleWhere} />
      {sound && <Tool label={soundLabel(sound.on).label} hint="M" icon={soundLabel(sound.on).icon} pressed={sound.on} onClick={sound.onToggle} />}
      {(showStats || statsOn) && <Tool label={statsOn ? statsLabel : "Stats"} hint="P" icon="📊" pressed={statsOn} onClick={onToggleStats} />}
    </div>
  );
}
