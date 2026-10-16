import { getObjectArt, useArtMode } from "../../../lib/stitchArt";
import { CANDLES, MAX_FROST_COPIES, type WinterSceneState } from "../../../lib/winter";
import "./winter.css";

/**
 * The war-room of Winter Rehearsal (E2, visual verb: endure). Five candles stand on the war-table and go
 * out one by one as the replay moves toward the bottom of the fall; frost climbs the walls and icicles hang
 * from the ledge as the day gets deeper. Every fact (candles, frost, icicle count) is drawn by code over
 * neutral pictures, and the page states each of them in words and in a table, so the scene is hidden from
 * assistive technology. Art off: the same scene with drawn shapes only. The scene only changes when you
 * move the slider: nothing loops, nothing moves by itself, and nothing is animated under reduced motion.
 */

export const SCENE_W = 420;
export const SCENE_H = 260;
const HALO = { paintOrder: "stroke", stroke: "#10101c", strokeWidth: 3, strokeLinejoin: "round" } as const;

/** Where the icicle copies hang (centre x as a fraction of the scene), by how many hang. */
export const ICICLE_SPOTS: Record<number, readonly number[]> = {
  0: [],
  1: [0.5],
  2: [0.3, 0.7],
  3: [0.18, 0.5, 0.82],
};

/** Candle foot points on the table top, as fractions of the scene: along the runner, left to right. */
export function candleSpots(): { x: number; y: number }[] {
  return Array.from({ length: CANDLES }, (_, i) => ({ x: 0.31 + i * 0.1, y: 0.63 - i * 0.057 }));
}

function Art({ id, left, top, width, anchor = "top" }: { id: string; left: number; top: number; width: number; anchor?: "top" | "bottom" }) {
  const art = getObjectArt(id);
  if (!art) return null;
  const h = (width * art.height) / art.width;
  const y = anchor === "bottom" ? top - h : top;
  return (
    <img
      src={art.src}
      alt=""
      aria-hidden="true"
      width={art.width}
      height={art.height}
      decoding="async"
      className="ws-art"
      style={{
        left: `${((left - width / 2) / SCENE_W) * 100}%`,
        top: `${(y / SCENE_H) * 100}%`,
        width: `${(width / SCENE_W) * 100}%`,
      }}
    />
  );
}

export default function WinterScene({ state }: { state: WinterSceneState }) {
  const mode = useArtMode();
  const stitch = mode === "stitch";
  const frostH = state.frost * SCENE_H * 0.55;
  const spots = ICICLE_SPOTS[Math.min(state.icicles, MAX_FROST_COPIES)] ?? [];
  const candles = candleSpots();
  return (
    <div className="ws-scene" aria-hidden="true" data-testid="winter-scene">
      <div className="ws-layer">
        {stitch && getObjectArt("backdrop-winter") && (
          <img src={getObjectArt("backdrop-winter")!.src} alt="" aria-hidden="true" decoding="async" className="ws-backdrop" />
        )}
        {stitch && <Art id="winter-war-table" left={SCENE_W / 2} top={SCENE_H - 6} width={290} anchor="bottom" />}
        {stitch &&
          spots.map((cx, i) => <Art key={i} id="winter-icicles" left={cx * SCENE_W} top={-6} width={92} />)}
      </div>
      <svg viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} className="ws-svg" role="presentation" focusable="false">
        <defs>
          <linearGradient id="ws-frost" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#d7ecf5" stopOpacity="0.85" />
            <stop offset="1" stopColor="#d7ecf5" stopOpacity="0" />
          </linearGradient>
        </defs>
        {!stitch && (
          <g>
            <rect width={SCENE_W} height={SCENE_H} fill="#1c1b2e" />
            <polygon points="90,215 300,150 340,170 140,245" fill="#6b4a32" stroke="#26253b" strokeWidth="2" />
            {spots.map((cx, i) => (
              <polygon key={i} points={`${cx * SCENE_W - 14},0 ${cx * SCENE_W + 14},0 ${cx * SCENE_W},46`} fill="#bfe3ee" stroke="#26253b" strokeWidth="1.5" />
            ))}
          </g>
        )}
        {frostH > 0 && <rect x="0" y="0" width={SCENE_W} height={frostH} fill="url(#ws-frost)" />}
        {candles.map((c, i) => {
          const lit = i < state.candlesLit;
          const cx = c.x * SCENE_W;
          const cy = c.y * SCENE_H;
          return (
            <g key={i} data-candle={lit ? "lit" : "out"}>
              <rect x={cx - 3.5} y={cy - 16} width="7" height="16" rx="1.5" fill="#eee4d3" stroke="#26253b" strokeWidth="1.2" />
              {lit ? (
                <ellipse cx={cx} cy={cy - 22} rx="3.4" ry="6" fill="#f2a93b" stroke="#26253b" strokeWidth="1" />
              ) : (
                <path d={`M${cx} ${cy - 17} q-3 -5 0 -9 q3 -4 0 -8`} fill="none" stroke="#a9adbf" strokeWidth="1.4" strokeLinecap="round" strokeDasharray="2 2" />
              )}
            </g>
          );
        })}
        <text x="10" y={SCENE_H - 26} fontSize="12" fontWeight="700" fill="#f6e9d2" style={HALO}>
          {state.candlesLit} of {CANDLES} candles lit
        </text>
        <text x="10" y={SCENE_H - 10} fontSize="12" fill="#f6e9d2" style={HALO}>
          Frost: {Math.round(state.frost * 100)}% of the worst day
        </text>
      </svg>
    </div>
  );
}
