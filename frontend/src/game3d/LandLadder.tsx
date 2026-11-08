import LandBlock from "./LandBlock";
import StreamBand from "./StreamBand";
import { GHOST, NEUTRAL, RUNGS } from "./landCondition";
import { ALL_STREAMS } from "./landStream";
import WorldLabel from "./WorldLabel";

/** The picture of the ladder: the same block at all five rungs, then the ghost and the neutral, then the five stream looks. */
export const LADDER_PICTURE = [
  ...RUNGS.map((c) => ({ label: c.name!, condition: c })),
  { label: "ghost", condition: GHOST },
  { label: "neutral", condition: NEUTRAL },
] as const;

const GAP = 7;

export default function LandLadder() {
  const x0 = -((LADDER_PICTURE.length - 1) * GAP) / 2;
  const SGAP = 9;
  const s0 = -((ALL_STREAMS.length - 1) * SGAP) / 2;
  return (
    <group>
      {LADDER_PICTURE.map((p, i) => (
        <group key={p.label} position={[x0 + i * GAP, 0, 0]}>
          <LandBlock condition={p.condition} />
          <WorldLabel position={[0, 3.6, 0]} distanceFactor={14}>{p.label}</WorldLabel>
        </group>
      ))}
      {ALL_STREAMS.map((s, i) => (
        <group key={s.look} position={[s0 + i * SGAP, 0, 11]}>
          <StreamBand stream={s} />
          <WorldLabel position={[0, 1.4, 0]} distanceFactor={14}>{s.look}</WorldLabel>
        </group>
      ))}
    </group>
  );
}
