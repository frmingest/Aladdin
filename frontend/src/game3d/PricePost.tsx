import { useRef, useState } from "react";
import type { MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { PAL, Part } from "./Inked";
import { BANNER_SHAPE, GAUGE_FILL, PRICE_LEAVE_RANGE, PRICE_POST, PRICE_RANGE } from "./holdingLand";
import type { PricePost as PricePostData } from "./holdingLand";
import { PRICE_WORDS } from "./pricePostWordsV2";
import WorldLabel from "./WorldLabel";

const MIST = "#cfd6dc";
const GAUGE_H = 2.2;
const BANNER = "#d6a53a";

/**
 * The price post (S25 PR 3), by the exit: a plank gauge (margin of safety), a sealed scroll (thesis) and a small banner
 * (siege exposure). Shape and height carry the meaning, never colour alone. An unknown fact is mist with a "?", never a
 * made-up height. Walk up to it to read the stored reason; no key press is needed.
 */
export default function PricePost({ post, pos }: { post: PricePostData; pos: MutableRefObject<{ x: number; z: number }> }) {
  const [near, setNear] = useState(false);
  const last = useRef(false);
  useFrame(() => {
    const d = Math.hypot(PRICE_POST.x - pos.current.x, PRICE_POST.z - pos.current.z);
    const n = d <= (last.current ? PRICE_LEAVE_RANGE : PRICE_RANGE);
    if (n !== last.current) {
      last.current = n;
      setNear(n);
    }
  });
  const fill = GAUGE_FILL[post.gauge];
  const shape = BANNER_SHAPE[post.banner];
  const scroll = post.scroll;
  return (
    <group position={[PRICE_POST.x, 0, PRICE_POST.z]}>
      {/* The plank gauge: a post with four notches; the marker sits at the stored margin of safety. */}
      <Part color={PAL.timber} position={[-0.9, GAUGE_H / 2, 0]} grow={1.08}>
        <boxGeometry args={[0.3, GAUGE_H, 0.2]} />
      </Part>
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <Part key={f} color={PAL.timberDark} position={[-0.9, f * (GAUGE_H - 0.3) + 0.1, 0.12]} grow={1.2}>
          <boxGeometry args={[0.5, 0.05, 0.06]} />
        </Part>
      ))}
      {fill !== null ? (
        <Part color={PAL.cream} position={[-0.9, fill * (GAUGE_H - 0.3) + 0.1, 0.2]} grow={1.15}>
          <boxGeometry args={[0.7, 0.14, 0.1]} />
        </Part>
      ) : (
        <mesh position={[-0.9, 1.1, 0.2]}>
          <sphereGeometry args={[0.55, 10, 8]} />
          <meshStandardMaterial color={MIST} transparent opacity={0.4} depthWrite={false} />
        </mesh>
      )}

      {/* The sealed scroll on its own post: whole, cracked (a gap), broken (two halves apart), or mist. */}
      <Part color={PAL.timber} position={[0, 0.8, 0]} grow={1.1}>
        <boxGeometry args={[0.2, 1.6, 0.2]} />
      </Part>
      {scroll === "whole" && (
        <Part color={PAL.cream} position={[0, 1.8, 0]} rotation={[0, 0, Math.PI / 2]} grow={1.12}>
          <cylinderGeometry args={[0.18, 0.18, 0.9, 8]} />
        </Part>
      )}
      {scroll === "cracked" && (
        <>
          <Part color={PAL.cream} position={[-0.25, 1.8, 0]} rotation={[0, 0, Math.PI / 2]} grow={1.12}>
            <cylinderGeometry args={[0.18, 0.18, 0.38, 8]} />
          </Part>
          <Part color={PAL.cream} position={[0.25, 1.8, 0]} rotation={[0, 0, Math.PI / 2]} grow={1.12}>
            <cylinderGeometry args={[0.18, 0.18, 0.38, 8]} />
          </Part>
        </>
      )}
      {scroll === "broken" && (
        <>
          <Part color={PAL.cream} position={[-0.4, 1.9, 0]} rotation={[0, 0, Math.PI / 2 + 0.4]} grow={1.12}>
            <cylinderGeometry args={[0.18, 0.18, 0.38, 8]} />
          </Part>
          <Part color={PAL.cream} position={[0.4, 0.2, 0.3]} rotation={[0, 0.5, Math.PI / 2]} grow={1.12}>
            <cylinderGeometry args={[0.18, 0.18, 0.38, 8]} />
          </Part>
        </>
      )}
      {scroll === "fog" && (
        <mesh position={[0, 1.8, 0]}>
          <sphereGeometry args={[0.5, 10, 8]} />
          <meshStandardMaterial color={MIST} transparent opacity={0.4} depthWrite={false} />
        </mesh>
      )}

      {/* The siege banner on a short pole: short square, long pennant, notched pennant, or mist. */}
      <Part color={PAL.timber} position={[0.9, 1.2, 0]} grow={1.1}>
        <boxGeometry args={[0.1, 2.4, 0.1]} />
      </Part>
      {shape === "short" && (
        <Part color={BANNER} position={[1.2, 2.0, 0]} grow={1.1}>
          <boxGeometry args={[0.5, 0.5, 0.05]} />
        </Part>
      )}
      {shape === "pennant" && (
        <Part color={BANNER} position={[1.6, 2.05, 0]} grow={1.1}>
          <boxGeometry args={[1.3, 0.45, 0.05]} />
        </Part>
      )}
      {shape === "notched" && (
        <>
          <Part color={BANNER} position={[1.45, 2.05, 0]} grow={1.1}>
            <boxGeometry args={[1, 0.45, 0.05]} />
          </Part>
          <Part color={PAL.slateDark} position={[2.0, 2.05, 0]} grow={1.1}>
            <boxGeometry args={[0.18, 0.45, 0.05]} />
          </Part>
        </>
      )}
      {shape === "mist" && (
        <mesh position={[1.2, 2.0, 0]}>
          <sphereGeometry args={[0.5, 10, 8]} />
          <meshStandardMaterial color={MIST} transparent opacity={0.4} depthWrite={false} />
        </mesh>
      )}

      <WorldLabel position={[0, 3.1, 0]} distanceFactor={9}>
          <div className="whitespace-nowrap font-semibold">{PRICE_WORDS.title}</div>
          {near && (
            <>
              <div className="whitespace-nowrap">{fill === null ? "? " : ""}{PRICE_WORDS.gauge[post.gauge]}</div>
              <div className="whitespace-nowrap">{scroll === "fog" ? "? " : ""}{PRICE_WORDS.scroll[scroll]}</div>
              <div className="whitespace-nowrap">{shape === "mist" ? "? " : ""}{PRICE_WORDS.banner[post.banner]}</div>
              {post.gaugeReason && <div className="max-w-[16rem] whitespace-normal text-[11px] italic opacity-90">{post.gaugeReason}</div>}
            </>
          )}
        </WorldLabel>
    </group>
  );
}
