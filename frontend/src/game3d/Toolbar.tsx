import type { OpenPanels, PanelId } from "./hudPanels";

interface Props {
  open: OpenPanels;
  onToggle: (id: PanelId) => void;
  /** Quests still open (a badge, so a shut panel does not hide that something is waiting). */
  questsWaiting: number;
  towerCount: number;
  statsOn: boolean;
  statsLabel: string;
  onToggleStats: () => void;
  /** The "Where to?" signpost menu: open or not, and a way to flip it. */
  whereOpen: boolean;
  onToggleWhere: () => void;
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
export default function Toolbar({ open, onToggle, questsWaiting, towerCount, statsOn, statsLabel, onToggleStats, whereOpen, onToggleWhere }: Props) {
  return (
    <div role="toolbar" aria-label="Courtyard menu" className="g3d-toolbar absolute left-1/2 top-3 z-30 -translate-x-1/2">
      <Tool label="Quests" hint="Q" icon="📜" pressed={open.quests} badge={questsWaiting} onClick={() => onToggle("quests")} />
      <Tool label="Towers" hint="T" icon="🏰" pressed={open.towers} badge={towerCount} onClick={() => onToggle("towers")} />
      <Tool label="Where to?" hint="G" icon="🪧" pressed={whereOpen} onClick={onToggleWhere} />
      <Tool label={statsOn ? statsLabel : "Stats"} hint="P" icon="📊" pressed={statsOn} onClick={onToggleStats} />
    </div>
  );
}
