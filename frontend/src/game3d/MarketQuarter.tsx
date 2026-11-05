import { Component, Suspense, useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import { Html, useGLTF } from "@react-three/drei";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { CanvasTexture, SRGBColorSpace } from "three";
import type { Object3D } from "three";
import { MARKET_QUARTER_URL } from "./holdingPieces";
import { INK, PAL, Part } from "./Inked";
import { StallPiece } from "./MarketStreet";
import StaticBatch from "./StaticBatch";
import {
  FOG_GAP,
  LANE_BANNERS,
  LANE_HOUSE,
  LANE_SIGN,
  LANE_TILES,
  QUARTER_EXIT,
  QUARTER_HALF,
  goodsFor,
} from "./quarterPlan";
import type { Quarter } from "./quarterPlan";
import { QUARTER_WORDS } from "./quarterWordsV1";
import { streetOverflowLine } from "./streetPlan";
import { TOWN_FILES } from "./townPieces";

/** The same flat ground colour as the Town, the Siege Field and the courtyard, so nothing here is flattered by colour. */
const GRASS = "#7a9e5c";

/** If a model file fails to load, only that group is left out; the ground, the plates, the pennants and the road back stay. */
class PiecesBoundary extends Component<{ what: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn(`3D market quarter ${this.props.what} failed to load, leaving it out:`, error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** One clone of a named node from market-quarter.glb, placed. Still, no fact: it rides the static batch. */
function Piece({ source, node, scale, position, yaw = 0 }: { source: Object3D; node: string; scale: number; position: [number, number, number]; yaw?: number }) {
  const object = useMemo<Object3D | null>(() => {
    const found = source.getObjectByName(node);
    if (!found) return null;
    const copy = found.clone(true);
    copy.traverse((o) => {
      o.castShadow = true;
      o.receiveShadow = true;
    });
    return copy;
  }, [source, node]);
  if (!object) return null;
  return <primitive object={object} scale={scale} position={position} rotation={[0, yaw, 0]} />;
}

/** The stalls, from the stall models the courtyard street already draws, each with its pennant and its plate. */
function Stalls({ quarter }: { quarter: Quarter }) {
  const gltf = useGLTF(TOWN_FILES.market);
  return (
    <StaticBatch rebuildKey={JSON.stringify(quarter.stalls)}>
      {quarter.stalls.map((s) => (
        <StallPiece key={s.holdingId} stall={s} source={gltf.scene} />
      ))}
    </StaticBatch>
  );
}

/**
 * Everything fixed from market-quarter.glb: goods beside each stall (a set picked from the company id alone), the boardwalk,
 * the banner poles and the house at the far end. Nothing here depends on a number.
 */
function Dressing({ quarter }: { quarter: Quarter }) {
  const gltf = useGLTF(MARKET_QUARTER_URL);
  const src = gltf.scene;
  return (
    <>
      <StaticBatch rebuildKey={JSON.stringify(quarter.stalls.map((s) => s.holdingId))}>
        {quarter.stalls.map((s) => (
          <group key={s.holdingId} position={[s.x, 0, s.z]} rotation={[0, s.yaw, 0]}>
            {goodsFor(s.holdingId).map((g, i) => (
              <Piece key={`${g.node}${i}`} source={src} node={g.node} scale={g.scale} position={[g.x, g.y, g.z]} yaw={g.yaw} />
            ))}
          </group>
        ))}
      </StaticBatch>
      <StaticBatch>
        {/* A tile is 0.15 thick with its foot at -0.1, so at height 0 it lies 0.05 proud of the ground: seen, not a step (no collider). */}
        {LANE_TILES.map((t) => (
          <Piece key={t.id} source={src} node="floor_wood" scale={1} position={[t.x, 0, t.z]} />
        ))}
        {LANE_BANNERS.map((b) => (
          <group key={b.id} position={[b.x, 0, b.z]} rotation={[0, b.yaw, 0]}>
            <Part color={PAL.timberDark} position={[0, 1.95, 0.3]} grow={1.1}>
              <boxGeometry args={[0.14, 3.9, 0.14]} />
            </Part>
            <Piece source={src} node="banner_thin_blue" scale={1} position={[0, 0, 0]} />
          </group>
        ))}
        <Piece source={src} node="home_A" scale={LANE_HOUSE.scale} position={[LANE_HOUSE.x, 0, LANE_HOUSE.z]} yaw={LANE_HOUSE.yaw} />
      </StaticBatch>
      <RigidBody type="fixed" colliders={false} position={[LANE_HOUSE.x, 0, LANE_HOUSE.z]}>
        <CuboidCollider args={[LANE_HOUSE.solid, 1.7, LANE_HOUSE.solid]} position={[0, 1.7, 0]} />
      </RigidBody>
    </>
  );
}

/** Dark ink on cream with a timber rim, like the stall plates. Painted once; it is world-size, so it never balloons when you stand close. */
function paintSign(text: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 768;
  c.height = 192;
  const g = c.getContext("2d");
  if (!g) return c;
  g.fillStyle = PAL.cream;
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = PAL.timberDark;
  g.lineWidth = 10;
  g.strokeRect(5, 5, c.width - 10, c.height - 10);
  g.fillStyle = INK;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = `700 64px "Segoe UI", system-ui, sans-serif`;
  g.fillText(text, c.width / 2, c.height / 2 + 4, c.width - 48);
  return c;
}

/** A board with words on both faces, so the lane reads the same from either end. Words only; it carries no fact. */
function SignBoard({ text, width, position }: { text: string; width: number; position: [number, number, number] }) {
  const tex = useMemo(() => {
    const x = new CanvasTexture(paintSign(text));
    x.colorSpace = SRGBColorSpace;
    x.anisotropy = 4;
    return x;
  }, [text]);
  useEffect(() => () => tex.dispose(), [tex]);
  const height = width / 4;
  return (
    <group position={position}>
      <Part color={PAL.timber} position={[0, 0, 0]} grow={1.04}>
        <boxGeometry args={[width + 0.2, height + 0.2, 0.1]} />
      </Part>
      <mesh position={[0, 0, 0.055]}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, -0.055]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** A pale veil over the quiet stretch: stalls with no price stand in mist, never in a made-up gap. Shape and words, no number. */
function QuietStretch({ fogZ, count, gate }: { fogZ: number; count: number; gate: boolean }) {
  const rows = Math.ceil(count / 2);
  const depth = rows * 7 + 4;
  const mid = fogZ + 3.5 - depth / 2;
  return (
    <>
      <mesh position={[0, 1.8, mid]}>
        <boxGeometry args={[26, 3.6, depth]} />
        <meshStandardMaterial color="#e8eef2" transparent opacity={0.14} depthWrite={false} />
      </mesh>
      {/* The far gate: two posts and a lintel across the lane, just before the mist (only when priced stalls stand before it). */}
      {gate && (
      <group position={[0, 0, fogZ + FOG_GAP / 2 + 3.5]}>
        {([-4.6, 4.6] as const).map((x) => (
          <Part key={x} color={PAL.timberDark} position={[x, 1.6, 0]} grow={1.1}>
            <boxGeometry args={[0.3, 3.2, 0.3]} />
          </Part>
        ))}
        <Part color={PAL.timberLight} position={[0, 3.3, 0]} grow={1.05}>
          <boxGeometry args={[9.5, 0.3, 0.3]} />
        </Part>
      </group>
      )}
      <SignBoard text={QUARTER_WORDS.fogTitle} width={3} position={[0, 2.75, fogZ + FOG_GAP / 2 + 3.5]} />
    </>
  );
}

/** The sign where the lane starts, and (when some stalls have no stand) the line about them at the far end. */
function Signs({ overflow }: { overflow: number }) {
  return (
    <>
      <group position={[LANE_SIGN.x, 0, LANE_SIGN.z]}>
        {([-2, 2] as const).map((x) => (
          <Part key={x} color={PAL.timberDark} position={[x, 1.25, 0]} grow={1.12}>
            <boxGeometry args={[0.16, 2.5, 0.16]} />
          </Part>
        ))}
      </group>
      <SignBoard text={QUARTER_WORDS.laneSign} width={3.6} position={[LANE_SIGN.x, 2, LANE_SIGN.z + 0.02]} />
      {overflow > 0 && (
        <Html position={[0, 4.4, LANE_HOUSE.z + 5]} center distanceFactor={16} zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
          <div className="g3d-nameplate" style={{ maxWidth: 260, whiteSpace: "normal", textAlign: "center" }} aria-hidden="true">
            {streetOverflowLine(overflow)}
          </div>
        </Html>
      )}
    </>
  );
}

/** The post at the south end: a pennant and a board pointing back to the courtyard. Shape only. */
function ExitPost() {
  return (
    <group position={[QUARTER_EXIT.x + 4.5, 0, QUARTER_EXIT.z]}>
      <Part color={PAL.timberDark} position={[0, 1.75, 0]} grow={1.12}>
        <boxGeometry args={[0.24, 3.5, 0.24]} />
      </Part>
      <Part color={PAL.timberLight} position={[-0.7, 2.6, 0.15]} grow={1.1}>
        <boxGeometry args={[1.4, 0.34, 0.08]} />
      </Part>
      <Part color={PAL.teal} position={[0, 3.7, 0]} grow={1.15}>
        <boxGeometry args={[0.7, 0.3, 0.05]} />
      </Part>
    </group>
  );
}

/**
 * The Market Quarter: one lane, one stall per watchlist company (up to twelve), the nearest your price standing nearest the arch
 * and the stalls with no price in a mist at the far end. The ground, the invisible walls, the plates, the pennants and the road
 * back are code-built, so a failed model load leaves a bare but working lane. The dressing is the same whatever the numbers say;
 * only a stall's pennant and plate carry a fact, and where it stands says how near your price it is.
 */
export default function MarketQuarter({ quarter }: { quarter: Quarter }) {
  const unpriced = quarter.stalls.filter((s) => s.unpriced).length;
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        {/* Deep on purpose: one long frame (a model loading) must not let the hero fall through a thin slab. */}
        <CuboidCollider args={[170, 10, 170]} position={[0, -10, 0]} />
        {/* Four invisible walls keep the hero in the quarter. */}
        <CuboidCollider args={[QUARTER_HALF + 2, 5, 1]} position={[0, 5, -QUARTER_HALF - 1]} />
        <CuboidCollider args={[QUARTER_HALF + 2, 5, 1]} position={[0, 5, QUARTER_HALF + 1]} />
        <CuboidCollider args={[1, 5, QUARTER_HALF + 2]} position={[-QUARTER_HALF - 1, 5, 0]} />
        <CuboidCollider args={[1, 5, QUARTER_HALF + 2]} position={[QUARTER_HALF + 1, 5, 0]} />
      </RigidBody>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[160, 48]} />
        <meshStandardMaterial color={GRASS} flatShading />
      </mesh>
      <ExitPost />
      <Signs overflow={quarter.overflow.length} />
      {quarter.fogZ !== null && <QuietStretch fogZ={quarter.fogZ} count={unpriced} gate={unpriced < quarter.stalls.length} />}
      {quarter.stalls.length > 0 && (
        <PiecesBoundary what="stalls">
          <Suspense fallback={null}>
            <Stalls quarter={quarter} />
          </Suspense>
        </PiecesBoundary>
      )}
      <PiecesBoundary what="dressing">
        <Suspense fallback={null}>
          <Dressing quarter={quarter} />
        </Suspense>
      </PiecesBoundary>
    </group>
  );
}
