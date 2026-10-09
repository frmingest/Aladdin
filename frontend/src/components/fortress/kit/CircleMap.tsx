import { useId, useMemo, type CSSProperties } from "react";
import {
  buildCircleMap,
  CIRCLE_R,
  FOG_FROM,
  hudFacts,
  INSIDE_CAPTION,
  MAP_REF_PX,
  NO_SECTOR_TITLE,
  NOT_JUDGED_TITLE,
  RING_LABEL,
  ringLabelTop,
  type CircleBand,
  type CircleMarker,
} from "../../../lib/circleMap";
import type { Competence, CompetenceLevel } from "../../../lib/types";
import { GameFrame } from "../GameFrame";
import CircleGlyph from "./CircleGlyph";
import FogPanel from "./FogPanel";
import ParchmentPanel from "./ParchmentPanel";
import "./circleMap.css";

/** The Circle of Competence drawn as a ring map (game mode, Circle page hero). The layout is the pure
 * function in lib/circleMap.ts; this file only draws it. The painted ground is decorative and
 * aria-hidden; every marker is a real button (>= 44 px) with its sector, level and share in its
 * name, and every label is HTML, not SVG text. Neutral parchment and ink: nothing is green, and the
 * inside of the circle is an outline, never a glow. Pressing a marker hands the sector to the page,
 * which focuses its mark control; the only write stays that control's own Save. */

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
      <path d={ring(50)} fill="rgb(120 80 30 / 0.08)" />
      {/* the fog band at the rim */}
      <path d={`${ring(50)} ${ring(FOG_FROM * 50)}`} fillRule="evenodd" fill={`url(#cm-fog-${id})`} />
      <path d={ring(FOG_FROM * 50)} fill="none" stroke="rgb(var(--c-ink-faint))" strokeWidth="0.45" strokeDasharray="1.6 1.4" />
      <path d={ring(49.6)} fill="none" stroke="rgb(var(--c-ink-muted))" strokeWidth="0.5" />
      {/* the circle itself: an outline only, whatever is or is not inside it */}
      <path d={ring(CIRCLE_R * 50)} fill="none" stroke="rgb(var(--c-ink))" strokeWidth="0.9" />
      <path d="M50 22 v-3 M50 78 v3 M22 50 h-3 M78 50 h3" stroke="rgb(var(--c-ink))" strokeWidth="0.7" strokeLinecap="round" />
    </svg>
  );
}

function Marker({ m, onPress }: { m: CircleMarker; onPress: (sector: string) => void }) {
  const style = { "--dx": m.dx, "--dy": m.dy, "--px": `${m.sizePx}px`, "--s": Math.round((m.sizePx / MAP_REF_PX) * 1000) / 10, opacity: m.opacity } as CSSProperties;
  return (
    <button
      type="button"
      className="circle-marker"
      data-band={m.band}
      style={style}
      aria-label={`${m.label}. Go to its mark control`}
      title={m.label}
      onClick={() => onPress(m.sector)}
    >
      <span className="circle-marker-disc">
        <CircleGlyph level={m.level} size={m.sizePx} fluid rotate={m.angleDeg} />
      </span>
      <span className="circle-pin" aria-hidden>
        {m.pin}
      </span>
      {m.showName && (
        <span className="circle-name" data-rank={m.nameRank ?? undefined} aria-hidden>
          {m.sector}
        </span>
      )}
    </button>
  );
}

function Hud({ data }: { data: Competence }) {
  const facts = hudFacts(data);
  const level: Record<string, CompetenceLevel | null> = { inside: "know", edge: "partly", outside: "outside", unmarked: null };
  return (
    <dl className="game-hud circle-hud" aria-label="Your holdings against your marks">
      {facts.map((f) => (
        <div key={f.key} className="game-hud-item">
          <CircleGlyph level={level[f.key]} size={22} className="circle-hud-glyph" />
          <div className="min-w-0">
            <dt className="game-hud-label">{f.label}</dt>
            <dd className="game-hud-value tabular">{f.value}</dd>
          </div>
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

export default function CircleMap({ data, onPress }: { data: Competence; onPress: (sector: string | null) => void }) {
  const model = useMemo(() => buildCircleMap(data), [data]);
  const { noSector, notJudged, collapsed } = model;
  const bands = (Object.keys(RING_LABEL) as CircleBand[]).map((b) => ({ b, top: ringLabelTop(b) }));
  const fogLines = noSector.names.length > 0 ? noSector.names : [];
  return (
    <div>
      <Hud data={data} />
      <GameFrame>
        <ParchmentPanel className="circle-stage">
          <div className="circle-map" role="group" aria-label="Circle of competence: one marker per sector">
            <Ground />
            {bands.map(({ b, top }) => (
              <span key={b} className="circle-ring-label" style={{ top: `${top}%` }} data-band={b}>
                {RING_LABEL[b]}
              </span>
            ))}
            {model.markers.map((m) => (
              <Marker key={m.key} m={m} onPress={onPress} />
            ))}
          </div>
          <p className="circle-caption">{INSIDE_CAPTION}</p>
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
                    <span className="block text-xs text-ink-muted">{notJudged.count} funds or gold</span>
                  </span>
                </div>
              )}
              {collapsed && (
                <button
                  type="button"
                  className="circle-tag circle-tag-button"
                  data-fog={collapsed.unmarked > 0 ? "true" : undefined}
                  onClick={() => onPress(null)}
                  aria-label={`${collapsed.count} smaller sectors${collapsed.unmarked > 0 ? `, ${collapsed.unmarked} unmarked` : ""}. Go to the list`}
                >
                  <span>
                    <span className="font-semibold">{collapsed.count} smaller sectors</span>
                    {collapsed.unmarked > 0 && <span className="block text-xs text-ink-muted">{collapsed.unmarked} unmarked</span>}
                  </span>
                </button>
              )}
            </div>
          )}
        </ParchmentPanel>
      </GameFrame>
    </div>
  );
}
