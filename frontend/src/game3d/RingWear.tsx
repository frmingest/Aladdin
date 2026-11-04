import { INK, PAL } from "./Inked";
import type { FountainPlan } from "./fountainDressing";

const at = (angle: number, r: number): [number, number, number] => [Math.cos(angle) * r, 0, Math.sin(angle) * r];

/**
 * The condition ladder's code-built wear for a ring of six pieces (A3): the footing, the bracing posts, the loose boards, the
 * patches and the cracks. The pieces themselves are drawn by the dressing; this part is the same for every theme that reuses
 * `fountainPlan`, and it reads the wall tier only. Place it inside the dressing's StaticBatch.
 */
export default function RingWear({ plan, ring, pieceTop, skip }: { plan: FountainPlan; ring: number; pieceTop: number; skip?: "footing" }) {
  const p = plan;
  const wall = (angle: number) => ({ x: Math.cos(angle) * ring, z: Math.sin(angle) * ring, rotY: -angle - Math.PI / 2 });
  return (
    <>
      {p.footing > 0 && skip !== "footing" && (
        <mesh position={[0, p.footing / 2, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[ring - 0.3, ring - 0.25, p.footing, 24]} />
          <meshStandardMaterial color={PAL.slate} flatShading />
        </mesh>
      )}
      {p.props.map((pr, i) => {
        const pos = at(pr.angle, ring - 0.4);
        return (
          <mesh key={`prop${i}`} position={[pos[0], pr.broken ? 0.3 : 0.55, pos[2]]} rotation={[0, 0, pr.broken ? 0.9 : 0.4]} castShadow>
            <boxGeometry args={[0.12, pr.broken ? 0.6 : 1.1, 0.12]} />
            <meshStandardMaterial color={PAL.timberDark} flatShading />
          </mesh>
        );
      })}
      {Array.from({ length: p.looseBoards }, (_, i) => {
        const pos = at(0.6 + i * 1.7, 1.5);
        return (
          <mesh key={`board${i}`} position={[pos[0], p.footing + 0.4, pos[2]]} rotation={[0.5 + i * 0.2, i, 0.3]}>
            <boxGeometry args={[0.1, 0.6, 0.22]} />
            <meshStandardMaterial color={PAL.timber} flatShading />
          </mesh>
        );
      })}
      {p.patches.map((m, i) => {
        const w = wall(m.angle);
        return (
          <mesh key={`patch${i}`} position={[w.x, p.footing + pieceTop, w.z]} rotation={[0, w.rotY, 0]}>
            <boxGeometry args={[0.4, 0.06, 0.1]} />
            <meshStandardMaterial color={PAL.timberLight} flatShading />
          </mesh>
        );
      })}
      {p.cracks.map((m, i) => {
        const w = wall(m.angle);
        return (
          <mesh key={`crack${i}`} position={[w.x, p.footing + pieceTop, w.z]} rotation={[0, w.rotY + (i % 2 ? 0.5 : -0.5), 0]}>
            <boxGeometry args={[0.45, 0.04, 0.05]} />
            <meshBasicMaterial color={INK} />
          </mesh>
        );
      })}
    </>
  );
}
