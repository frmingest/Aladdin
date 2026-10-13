import { useId, useMemo, useRef, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  buildCircleMap,
  CIRCLE_R,
  FOG_FROM,
  hudFacts,
  INSIDE_CAPTION,
  collapsedText,
  DRAG_HINT,
  HIT_PX,
  levelForBand,
  TRAY_TITLE,
  ZONE_EDGES,
  NO_SECTOR_TITLE,
  NOT_JUDGED_TITLE,
  RING_LABEL,
  ringLabelPos,
  type CircleBand,
  type CircleMarker,
} from "../../../lib/circleMap";
import type { Competence, CompetenceLevel } from "../../../lib/types";
import { GameFrame } from "../GameFrame";
import CircleGlyph from "./CircleGlyph";
import CircleRingArt, { FogStake } from "./CircleRingArt";
import FogPanel from "./FogPanel";
import NightPanel from "./NightPanel";
import { useZoneDrag, type DragState } from "./useZoneDrag";
import "./circleMap.css";

/** The Circle of Competence drawn as a ring map (game mode, Circle page hero). The layout is the pure
 * function in lib/circleMap.ts; this file only draws it. The painted ground is decorative and
 * aria-hidden; every marker is a real button (>= 44 px) with its sector, level and share in its
 * name, and every label is HTML, not SVG text. Neutral parchment and ink: nothing is green, and the
 * inside of the circle is an outline, never a glow. Pressing a marker hands the sector to the page,
 * which opens its panel. Placement is direct: drag a marker onto a zone and the page saves it (the one
 * write, unchanged: a PUT, or a DELETE when it is dropped in the fog). The panel's radios and the tap
 * are the keyboard way to do the same thing. */

function Ground() {
  const id = useId().replace(/:/g, "");
  const ring = (r: number) => `M${50 - r} 50 a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0 Z`;
  return (
    <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
      <defs>
        <pattern id={`cm-fog-${id}`} width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M0 0 V3" stroke="rgb(var(--c-ink-faint))" strokeWidth="0.35" strokeOpacity="0.45" />
        </pattern>
      </defs>
      {/* open ground beyond the line */}
      <path d={ring(50)} fill="rgb(214 168 90 / 0.05)" />
      {/* the fog band at the rim */}
      <path d={`${ring(50)} ${ring(FOG_FROM * 50)}`} fillRule="evenodd" fill={`url(#cm-fog-${id})`} />
      <path d={ring(FOG_FROM * 50)} fill="none" stroke="rgb(var(--c-ink-faint))" strokeWidth="0.45" strokeDasharray="1.6 1.4" />
      <path d={ring(49.6)} fill="none" stroke="rgb(var(--c-ink-muted))" strokeWidth="0.5" />
      {/* the circle itself: an outline only, whatever is or is not inside it */}
      <path d={ring(CIRCLE_R * 50)} fill="none" stroke="rgb(var(--c-ink))" strokeWidth="0.9" />
      <path d="M50 22 v-3 M50 78 v3 M22 50 h-3 M78 50 h3" stroke="rgb(var(--c-ink))" strokeWidth="0.7" strokeLinecap="round" />
      {/* astrolabe ticks on the rim: decoration only, they carry no data */}
      <path d={Array.from({ length: 72 }, (_, k) => { const a = (k * 5 * Math.PI) / 180; const r1 = k % 6 === 0 ? 47.2 : 48.4; return `M${(50 + r1 * Math.cos(a)).toFixed(2)} ${(50 + r1 * Math.sin(a)).toFixed(2)} L${(50 + 49.6 * Math.cos(a)).toFixed(2)} ${(50 + 49.6 * Math.sin(a)).toFixed(2)}`; }).join(" ")} stroke="rgb(var(--c-accent))" strokeOpacity="0.55" strokeWidth="0.3" />
    </svg>
  );
}

const ZONE_WORD: Record<CircleBand, string> = RING_LABEL;

/** The drop zones, drawn only while a marker is being dragged. The zone under the pointer is outlined
 * and lightly filled; the shape of the zones is the same circle the page already draws. */
function ZoneOverlay({ hot }: { hot: CircleBand | null }) {
  const ring = (r: number) => `M${50 - r} 50 a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0 Z`;
  const a = ZONE_EDGES.inside * 50;
  const b = ZONE_EDGES.edge * 50;
  const c = ZONE_EDGES.outside * 50;
  const zones: { band: CircleBand; d: string; rule?: "evenodd" }[] = [
    { band: "inside", d: ring(a) },
    { band: "edge", d: `${ring(b)} ${ring(a)}`, rule: "evenodd" },
    { band: "outside", d: `${ring(c)} ${ring(b)}`, rule: "evenodd" },
    { band: "fog", d: `${ring(50)} ${ring(c)}`, rule: "evenodd" },
  ];
  return (
    <svg viewBox="0 0 100 100" className="circle-zones" aria-hidden>
      {zones.map((z) => (
        <path key={z.band} d={z.d} fillRule={z.rule} className="circle-zone" data-zone={z.band} data-hot={hot === z.band ? "true" : undefined} />
      ))}
    </svg>
  );
}

type Bind = ReturnType<typeof useZoneDrag>["bind"];

function Marker({
  m,
  selected,
  dragging,
  draggable,
  bind,
  onPress,
}: {
  m: CircleMarker;
  selected: boolean;
  dragging: boolean;
  draggable: boolean;
  bind: Bind;
  onPress: (sector: string | null) => void;
}) {
  const style = { "--dx": m.dx, "--dy": m.dy, "--hit": `${Math.max(HIT_PX, m.sizePx)}px`, opacity: m.opacity } as CSSProperties;
  const isSector = m.kind === "sector";
  const events = isSector ? bind(m.sector, m.level, m.sizePx) : { onClick: () => onPress(null) };
  return (
    <button
      type="button"
      className="circle-marker"
      data-band={m.band}
      data-kind={m.kind}
      data-selected={selected ? "true" : undefined}
      data-dragging={dragging ? "true" : undefined}
      data-draggable={isSector && draggable ? "true" : undefined}
      style={style}
      aria-pressed={isSector ? selected : undefined}
      aria-label={isSector ? `${m.label}. Press to choose its mark, or drag it onto a zone` : `${m.label}. Go to the list`}
      title={m.label}
      {...events}
    >
      <span className="circle-marker-disc" style={{ width: m.sizePx, height: m.sizePx }}>
        <CircleGlyph level={m.level} size={m.sizePx} rotate={m.angleDeg} />
        {m.pin > 0 && (
          <span className="circle-pin" aria-hidden>
            {m.pin}
          </span>
        )}
        {m.kind === "nosector" && <FogStake />}
        {m.showName && (
          <span className="circle-name" data-rank={m.nameRank ?? undefined} aria-hidden>
            {m.sector}
          </span>
        )}
      </span>
    </button>
  );
}

/** The copy of the marker that follows the pointer. It takes the shape of the zone it is over, so the
 * result of letting go is visible before it happens: a dashed "?" over the fog means "clear". */
function Ghost({ drag }: { drag: DragState }) {
  const level = drag.zone ? levelForBand(drag.zone) || null : null;
  return createPortal(
    <span
      className="circle-ghost"
      data-zone={drag.zone ?? "none"}
      style={{ left: drag.x, top: drag.y, width: drag.size + 6, height: drag.size + 6 }}
      aria-hidden
    >
      <CircleGlyph level={level} size={drag.size} />
      <span className="circle-ghost-word">{drag.zone ? ZONE_WORD[drag.zone] : "Let go to cancel"}</span>
    </span>,
    document.body,
  );
}

function Hud({ data }: { data: Competence }) {
  const facts = hudFacts(data);
  const level: Record<string, CompetenceLevel | null> = { inside: "know", edge: "partly", outside: "outside", unmarked: null };
  return (
    <dl className="game-hud circle-hud" aria-label="Your holdings against your marks">
      {facts.map((f) => (
        <div key={f.key} className="game-hud-item has-icon">
          <CircleGlyph level={level[f.key]} size={22} className="circle-hud-glyph" />
          <dt className="game-hud-label">{f.label}</dt>
          <dd className="game-hud-value tabular">{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Tent() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden className="shrink-0">
      <path d="M3 20 L12 5 L21 20 Z M12 5 V20 M8 20 L12 13 L16 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

export default function CircleMap({
  data,
  onPress,
  onSelect,
  onPlace,
  selected = null,
  readOnly = false,
  status = "",
  onUndo,
}: {
  data: Competence;
  /** Tags and the "smaller sectors" button: go to the list (null). */
  onPress: (sector: string | null) => void;
  /** A marker or chip was pressed: choose it (falls back to onPress when the page gives no panel). */
  onSelect?: (sector: string) => void;
  /** A marker was dropped on a zone that changes its level; "" clears the mark. */
  onPlace?: (sector: string, level: CompetenceLevel | "") => void;
  selected?: string | null;
  /** Demo data, or a save in flight: markers can be pressed but not dragged. */
  readOnly?: boolean;
  /** What the last drop did, read aloud and shown under the map. */
  status?: string;
  onUndo?: () => void;
}) {
  const model = useMemo(() => buildCircleMap(data), [data]);
  const { noSector, notJudged, collapsed } = model;
  const bands = (Object.keys(RING_LABEL) as CircleBand[]).map((b) => ({ b, pos: ringLabelPos(b) }));
  const fogLines = noSector.names.length > 0 ? noSector.names : [];
  const mapRef = useRef<HTMLDivElement>(null);
  const canDrag = !readOnly && !!onPlace;
  const { drag, bind } = useZoneDrag({
    mapRef,
    disabled: !canDrag,
    onPlace: (sector, level) => onPlace?.(sector, level),
    onTap: (sector) => (onSelect ?? onPress)(sector),
  });
  return (
    <div>
      <Hud data={data} />
      <GameFrame>
        <NightPanel className="circle-stage">
          {!!onPlace && !data.demo && <p className="circle-hint">{DRAG_HINT}</p>}
          <div className="circle-map" ref={mapRef} role="group" aria-label="Circle of competence: one marker per sector" data-dragging={drag ? "true" : undefined}>
            <Ground />
            <ZoneOverlay hot={drag?.zone ?? null} />
            <CircleRingArt />
            {bands.map(({ b, pos }) => (
              <span key={b} className="circle-ring-label" style={{ left: `${pos.left}%`, top: `${pos.top}%` }} data-band={b} data-hot={drag?.zone === b ? "true" : undefined}>
                {RING_LABEL[b]}
              </span>
            ))}
            {model.markers.map((m) => (
              <Marker key={m.key} m={m} selected={selected === m.sector && m.kind === "sector"} dragging={drag?.sector === m.sector} draggable={canDrag} bind={bind} onPress={onPress} />
            ))}
          </div>
          <p className="circle-caption">{INSIDE_CAPTION}</p>
          <p className="circle-status" role="status" aria-live="polite">
            {status}
            {status && onUndo && (
              <>
                {" "}
                <button type="button" className="mark-clear" onClick={onUndo}>
                  Undo
                </button>
              </>
            )}
          </p>
          {model.quiet.length > 0 && (
            <div className="circle-tray">
              <p className="circle-tray-title">{TRAY_TITLE}</p>
              <ul className="circle-tray-list">
                {model.quiet.map((q) => (
                  <li key={q.sector}>
                    <button
                      type="button"
                      className="circle-chip"
                      data-draggable={canDrag ? "true" : undefined}
                      data-dragging={drag?.sector === q.sector ? "true" : undefined}
                      data-selected={selected === q.sector ? "true" : undefined}
                      aria-pressed={selected === q.sector}
                      aria-label={`${q.sector}: not marked, nothing held. Press to choose its mark, or drag it onto a zone`}
                      {...bind(q.sector, q.level, 28)}
                    >
                      {q.sector}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(noSector.count > 0 || notJudged.count > 0 || collapsed) && (
            <div className="circle-tags">
              {noSector.count > 0 && (
                <FogPanel title={`${NO_SECTOR_TITLE}, ${noSector.weightText}`} lines={fogLines} className="circle-tag-fog" />
              )}
              {notJudged.count > 0 && (
                <div className="circle-tag">
                  <Tent />
                  <span>
                    <span className="font-semibold">{NOT_JUDGED_TITLE}</span>
                    <span className="block text-xs text-ink-muted">{notJudged.count} {notJudged.count === 1 ? "fund or gold holding" : "funds or gold"}</span>
                  </span>
                </div>
              )}
              {collapsed && (
                <button
                  type="button"
                  className="circle-tag circle-tag-button"
                  data-fog={collapsed.levels.some((l) => l.band === "fog") ? "true" : undefined}
                  onClick={() => onPress(null)}
                  aria-label={`${collapsedText(collapsed).title}: ${collapsedText(collapsed).detail}. Go to the list`}
                >
                  <span>
                    <span className="font-semibold">{collapsedText(collapsed).title}</span>
                    <span className="block text-xs text-ink-muted">{collapsedText(collapsed).detail}</span>
                  </span>
                </button>
              )}
            </div>
          )}
        </NightPanel>
      </GameFrame>
      {drag && <Ghost drag={drag} />}
    </div>
  );
}
