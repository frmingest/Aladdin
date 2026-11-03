import { Html } from "@react-three/drei";
import { PAL, Part } from "./Inked";
import { LANTERN_LOOKS } from "./holdingLand";
import type { Lantern } from "./holdingLand";

const FLAME = "#f4c35a";
const GLASS = "#e9e2c8";
const MIST = "#cfd6dc";

/**
 * One survey lantern (S25 PR 2). The look comes from the survey check alone, never from a verdict:
 *   lit  = a warm flame in a cage, a tick     (check is clear)
 *   mist = a hooded lamp in pale mist, a "?"  (check is in fog)
 *   bare = a bare post with a dash            (check was not judged)
 * Shape and mark carry the meaning, so colour is never the only signal. No red, no green.
 */
export default function LanternPost({ lantern, active }: { lantern: Lantern; active: boolean }) {
  const { shape, mark } = LANTERN_LOOKS[lantern.look];
  return (
    <group position={[lantern.x, 0, lantern.z]}>
      <Part color={PAL.timber} position={[0, 0.9, 0]} grow={1.1}>
        <boxGeometry args={[0.18, 1.8, 0.18]} />
      </Part>
      {shape === "flame" && (
        <>
          <Part color={GLASS} position={[0, 1.95, 0]} grow={1.06}>
            <boxGeometry args={[0.46, 0.5, 0.46]} />
          </Part>
          <mesh position={[0, 1.95, 0]}>
            <coneGeometry args={[0.16, 0.36, 6]} />
            <meshStandardMaterial color={FLAME} emissive={FLAME} emissiveIntensity={0.9} flatShading />
          </mesh>
          <pointLight position={[0, 1.95, 0]} intensity={0.6} distance={5} color={FLAME} />
        </>
      )}
      {shape === "hood" && (
        <>
          <Part color={PAL.slate} position={[0, 1.95, 0]} grow={1.06}>
            <boxGeometry args={[0.4, 0.4, 0.4]} />
          </Part>
          <mesh position={[0, 2.35, 0]}>
            <coneGeometry args={[0.38, 0.4, 6]} />
            <meshStandardMaterial color={PAL.slateDark} flatShading />
          </mesh>
          <mesh position={[0, 1.4, 0]}>
            <sphereGeometry args={[0.7, 10, 8]} />
            <meshStandardMaterial color={MIST} transparent opacity={0.28} depthWrite={false} />
          </mesh>
        </>
      )}
      {shape === "post" && (
        <Part color={PAL.timberDark} position={[0, 1.85, 0]} grow={1.08}>
          <boxGeometry args={[0.34, 0.1, 0.1]} />
        </Part>
      )}
      <Html position={[0, 2.9, 0]} center distanceFactor={9} zIndexRange={[10, 0]}>
        <div
          className={`pointer-events-none whitespace-nowrap rounded px-2 py-0.5 text-xs text-white ${active ? "bg-black/85 ring-1 ring-white/60" : "bg-black/60"}`}
        >
          <span aria-hidden="true" className="mr-1 font-bold">
            {mark}
          </span>
          {lantern.label}
        </div>
      </Html>
    </group>
  );
}
