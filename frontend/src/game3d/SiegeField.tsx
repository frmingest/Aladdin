import { Component, Suspense, useEffect, useMemo, useRef } from "react";
import type { MutableRefObject, ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { Html, useGLTF } from "@react-three/drei";
import { CuboidCollider, CylinderCollider, RigidBody } from "@react-three/rapier";
import { AnimationMixer, Box3, LoopRepeat } from "three";
import type { Group, Mesh, Object3D } from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import Battlefield from "./Battlefield";
import { CAMP_URL } from "./campPieces";
import { SIEGE_URL, SKELETON_URL } from "./holdingPieces";
import { PAL, Part } from "./Inked";
import { fitToHeight } from "./modelFit";
import { prefersReducedMotion } from "./motionPref";
import { OUTLINE_WORLD, addOutlines } from "./outline";
import {
  ATTACKERS,
  ENGINES,
  FIELD_BANNERS,
  FIELD_EXIT,
  FIELD_EXIT_LEAVE_RANGE,
  FIELD_EXIT_RANGE,
  FIELD_HALF,
  FIELD_MAX_SECTIONS,
  FIELD_ROCKS,
  FIELD_TENT,
  SECTION_HEIGHT,
  SECTION_THICKNESS,
  SECTION_WIDTH,
  ghostsFor,
  sectionsFor,
} from "./siegeField";
import type { Attacker, Section } from "./siegeField";
import { FIELD_WORDS } from "./siegeFieldWordsV1";
import { BANNER_FOR, SIEGE_STONE, STORM_STONE, WINCH, fieldSpotAt, stonePlate, winchPosition, yardstickName } from "./siegeFieldTools";
import type { FieldSpotId, FieldTools } from "./siegeFieldTools";
import { FIELD_TOOLS_WORDS } from "./siegeFieldToolsWordsV1";
import { fallPercent } from "./stormDrill";
import { YARD_FAILED, YARD_READING, yardFogTitle, yardMoreLine } from "./siegeYardWordsV2";
import { useSiegeYard } from "./useSiegeYard";
import type { YardView } from "./siegeYard";

/** The same flat ground colour as the Town and the courtyard, so nothing here is flattered by colour. */
const GRASS = "#7a9e5c";

/** If a model file fails to load, the piece (and only that group) is left out; the ground, the walls' plates and the road back stay. */
class PiecesBoundary extends Component<{ what: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn(`3D siege field ${this.props.what} failed to load, leaving it out:`, error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function Model({ source, name, scale }: { source: Object3D; name: string; scale: number | [number, number, number] }) {
  const object = useMemo(() => {
    const node = source.getObjectByName(name);
    if (!node) return null;
    const copy = node.clone(true);
    copy.traverse((o) => {
      o.castShadow = true;
      o.receiveShadow = true;
    });
    return copy;
  }, [source, name]);
  return object ? <primitive object={object} scale={scale} /> : null;
}

function WallSection({ s, source }: { s: Section; source: Object3D }) {
  const fall = s.height / SECTION_HEIGHT;
  return (
    <RigidBody type="fixed" colliders={false} position={[s.x, 0, s.z]}>
      {s.solid && <CuboidCollider args={[SECTION_WIDTH / 2, Math.max(s.height, 0.5) / 2, SECTION_THICKNESS / 2]} position={[0, Math.max(s.height, 0.5) / 2, 0]} />}
      {/* The wall piece is centred on its own origin, one unit wide; squash it by the share that is left. */}
      <Model source={source} name="wall" scale={[SECTION_WIDTH, SECTION_WIDTH * fall, SECTION_THICKNESS]} />
      {Array.from({ length: s.rubble }, (_, i) => (
        <group key={i} position={[(i - (s.rubble - 1) / 2) * 1.1, 0, 1.5 + (i % 2) * 0.5]} rotation={[0, i * 1.7, 0]}>
          <Model source={source} name={i === 0 ? "rocks_small" : "rocks_large"} scale={1.6} />
        </group>
      ))}
    </RigidBody>
  );
}

/** A name over each section, in the flat page's own words: the tower, the share lost. */
function SectionPlate({ s }: { s: Section }) {
  return (
    <Html position={[s.x, Math.max(s.height, 0.8) + 1.4, s.z]} center distanceFactor={16} zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
      <div className="g3d-nameplate" aria-hidden="true">
        {s.name} {s.shock}
      </div>
    </Html>
  );
}

function Wall({ view, source }: { view: YardView; source: Object3D }) {
  const sections = useMemo(() => sectionsFor(view.rows), [view]);
  const ghosts = useMemo(() => ghostsFor(view.fog), [view]);
  return (
    <>
      {sections.map((s) => (
        <WallSection key={s.id} s={s} source={source} />
      ))}
      {sections.map((s) => (
        <SectionPlate key={`plate-${s.id}`} s={s} />
      ))}
      {/* Towers that could not be tested stand behind the line as pale ghosts with a "?", never a height. */}
      {ghosts.map((g) => (
        <group key={g.id} position={[g.x, 0, g.z]}>
          <mesh position={[0, 2.2, 0]}>
            <boxGeometry args={[SECTION_WIDTH * 1.2, 4.4, SECTION_THICKNESS * 1.6]} />
            <meshStandardMaterial color="#e8eef2" transparent opacity={0.3} depthWrite={false} />
          </mesh>
          <Html position={[0, 5.2, 0]} center distanceFactor={16} zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
            <div className="g3d-nameplate" aria-hidden="true">
              {g.name} {FIELD_WORDS.fogMark}
            </div>
          </Html>
        </group>
      ))}
      {view.fog.length > 0 && (
        <Html position={[0, 7.4, ghosts[0]?.z ?? -30]} center distanceFactor={16} zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
          <div className="g3d-nameplate" aria-hidden="true">
            {yardFogTitle(view.fog.length)}
          </div>
        </Html>
      )}
    </>
  );
}

function Engines({ source }: { source: Object3D }) {
  return (
    <>
      {ENGINES.map((e) => (
        <RigidBody key={e.id} type="fixed" colliders={false} position={[e.x, 0, e.z]} rotation={[0, e.yaw, 0]}>
          <CylinderCollider args={[1, e.solid * 0.8]} position={[0, 1, 0]} />
          <Model source={source} name={e.model} scale={e.scale} />
        </RigidBody>
      ))}
    </>
  );
}

/** One skeleton, breathing. It never walks, never attacks and never reacts to anything: no number rides on it. */
function Skeleton({ a }: { a: Attacker }) {
  const { scene, animations } = useGLTF(SKELETON_URL(a.file));
  const group = useRef<Group>(null);
  const mixer = useRef<AnimationMixer | null>(null);
  const reduced = useRef(prefersReducedMotion());
  const fitted = useMemo(() => {
    const object = clone(scene);
    object.traverse((o) => {
      const m = o as Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
        m.frustumCulled = false;
      }
    });
    object.updateWorldMatrix(true, true);
    const box = new Box3().setFromObject(object);
    return { object, ...fitToHeight(box.min, box.max, a.height) };
  }, [scene, a.height]);
  useEffect(() => {
    const m = new AnimationMixer(fitted.object);
    mixer.current = m;
    const clip = animations.find((c) => c.name === "Idle");
    if (clip) {
      const action = m.clipAction(clip, fitted.object);
      action.setLoop(LoopRepeat, Infinity);
      action.play();
      // Reduced motion: one still frame, held. Otherwise start part-way in, so the ranks do not breathe in step.
      m.update(a.phase);
    }
    return () => {
      m.stopAllAction();
      m.uncacheRoot(fitted.object);
      mixer.current = null;
    };
  }, [fitted.object, animations, a.phase]);
  useEffect(() => addOutlines(fitted.object, OUTLINE_WORLD / fitted.scale), [fitted]);
  useFrame((_, delta) => {
    if (!reduced.current) mixer.current?.update(delta);
  });
  return (
    <RigidBody type="fixed" colliders={false} position={[a.x, 0, a.z]} rotation={[0, a.yaw, 0]}>
      <CylinderCollider args={[0.9, 0.45]} position={[0, 0.9, 0]} />
      <group ref={group}>
        <group scale={fitted.scale} position={fitted.offset}>
          <primitive object={fitted.object} />
        </group>
      </group>
    </RigidBody>
  );
}

function Attackers() {
  return (
    <>
      {ATTACKERS.map((a) => (
        <PiecesBoundary key={a.id} what={a.id}>
          <Suspense fallback={null}>
            <Skeleton a={a} />
          </Suspense>
        </PiecesBoundary>
      ))}
    </>
  );
}

function Scatter({ source, tools }: { source: Object3D; tools: FieldTools }) {
  return (
    <>
      {FIELD_ROCKS.map((r) => (
        <group key={r.id} position={[r.x, 0, r.z]} rotation={[0, r.yaw, 0]}>
          <Model source={source} name={r.model} scale={r.scale} />
        </group>
      ))}
      {/* The two yardstick banners: the one in use flies full height, the other hangs low. Shape, not colour. */}
      {FIELD_BANNERS.map((b) => {
        const key = b.id === BANNER_FOR.local ? "local" : "global";
        const active = tools.benchmark === key;
        return (
          <group key={b.id} position={[b.x, 0, b.z]}>
            <Model source={source} name="flag_banner_long" scale={active ? b.scale : b.scale * 0.65} />
            <Html position={[0, active ? 6 : 4.3, 0]} center distanceFactor={16} zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
              <div className="g3d-nameplate" aria-hidden="true">
                {yardstickName(key)}
                {active ? ` · ${FIELD_TOOLS_WORDS.bannerNow}` : ""}
              </div>
            </Html>
          </group>
        );
      })}
    </>
  );
}

/** The fall winch: a frame, a rope and a weight that sits higher the bigger the fall. It only mirrors the fall. */
function Winch({ tools }: { tools: FieldTools }) {
  const t = winchPosition(tools.fall, tools.min, tools.max);
  const weightY = 0.9 + t * 2.4;
  return (
    <group position={[WINCH.x, 0, WINCH.z]}>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[1.2, 0.7]} position={[0, 1.2, 0]} />
      </RigidBody>
      <Part color={PAL.timberDark} position={[-0.6, 1.9, 0]} grow={1.1}>
        <boxGeometry args={[0.22, 3.8, 0.22]} />
      </Part>
      <Part color={PAL.timberDark} position={[0.6, 1.9, 0]} grow={1.1}>
        <boxGeometry args={[0.22, 3.8, 0.22]} />
      </Part>
      <Part color={PAL.timberLight} position={[0, 3.8, 0]} grow={1.1}>
        <boxGeometry args={[1.5, 0.22, 0.22]} />
      </Part>
      <Part color={PAL.timberLight} position={[0, 2.35, 0]} grow={1.05}>
        <boxGeometry args={[0.05, 2.9, 0.05]} />
      </Part>
      <Part color={PAL.teal} position={[0, weightY, 0]} grow={1.15}>
        <boxGeometry args={[0.55, 0.5, 0.55]} />
      </Part>
      <Html position={[0, 4.7, 0]} center distanceFactor={16} zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
        <div className="g3d-nameplate" aria-hidden="true">
          {FIELD_TOOLS_WORDS.winchPlate(fallPercent(tools.fall))}
        </div>
      </Html>
    </group>
  );
}

/** A marker stone: "Storm line" or "Siege line", with the fall that reaches it. A pennant tops the one the fall is at. */
function MarkerStone({ source, id, tools }: { source: Object3D; id: "storm" | "siege"; tools: FieldTools }) {
  const at = id === "storm" ? STORM_STONE : SIEGE_STONE;
  const fall = id === "storm" ? tools.toStorm : tools.toSiege;
  const chosen = fall !== null && fall === tools.fall;
  return (
    <group position={[at.x, 0, at.z]}>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[0.8, 0.9]} position={[0, 0.8, 0]} />
      </RigidBody>
      <Model source={source} name="rocks_large" scale={1.9} />
      {chosen && (
        <Part color={PAL.teal} position={[0, 2.5, 0]} grow={1.15}>
          <boxGeometry args={[0.7, 0.3, 0.05]} />
        </Part>
      )}
      <Html position={[0, 3.3, 0]} center distanceFactor={16} zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
        <div className="g3d-nameplate" aria-hidden="true">
          {stonePlate(id, tools)}
        </div>
      </Html>
    </group>
  );
}

function SiegePieces({ view, tools }: { view: YardView | null; tools: FieldTools }) {
  const gltf = useGLTF(SIEGE_URL);
  return (
    <>
      {view && <Wall view={view} source={gltf.scene} />}
      <Engines source={gltf.scene} />
      <Scatter source={gltf.scene} tools={tools} />
      <MarkerStone source={gltf.scene} id="storm" tools={tools} />
      <MarkerStone source={gltf.scene} id="siege" tools={tools} />
    </>
  );
}

/** The command tent, and over it the whole book's answer in the flat page's words. */
function Tent({ status }: { status: "reading" | "failed" | YardView }) {
  const camp = useGLTF(CAMP_URL);
  return (
    <>
      <RigidBody type="fixed" colliders={false} position={[FIELD_TENT.x, 0, FIELD_TENT.z]} rotation={[0, FIELD_TENT.yaw, 0]}>
        <CylinderCollider args={[1.5, FIELD_TENT.solid]} position={[0, 1.5, 0]} />
        <Model source={camp.scene} name="tent" scale={FIELD_TENT.scale} />
      </RigidBody>
      <Html position={[FIELD_TENT.x, 6, FIELD_TENT.z]} center distanceFactor={16} zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
        <div className="g3d-nameplate" style={{ maxWidth: 260, whiteSpace: "normal", textAlign: "center" }} aria-hidden="true">
          {status === "reading" ? (
            YARD_READING
          ) : status === "failed" ? (
            YARD_FAILED
          ) : (
            <>
              <strong>{status.level}</strong>
              <br />
              {status.headline}
              <br />
              {status.more > 0 && (
                <>
                  {yardMoreLine(status.more)}
                  <br />
                </>
              )}
              <em>{FIELD_WORDS.whatIf}</em>
            </>
          )}
        </div>
      </Html>
    </>
  );
}

/** The post at the south end: a pennant and a board pointing back to the courtyard. Shape only. */
function ExitPost() {
  return (
    <group position={[FIELD_EXIT.x + 4.5, 0, FIELD_EXIT.z]}>
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

/** Tells the page when the road back is in reach. Only on change. */
function ExitWatch({ pos, onNearExit }: { pos: MutableRefObject<{ x: number; z: number }>; onNearExit: (near: boolean) => void }) {
  const last = useRef(false);
  useFrame(() => {
    const d = Math.hypot(FIELD_EXIT.x - pos.current.x, FIELD_EXIT.z - pos.current.z);
    const near = d <= (last.current ? FIELD_EXIT_LEAVE_RANGE : FIELD_EXIT_RANGE);
    if (near !== last.current) {
      last.current = near;
      onNearExit(near);
    }
  });
  return null;
}

/** Tells the page which tool is in reach (the winch, a stone or a banner). Only on change. */
function SpotWatch({ pos, onNearSpot }: { pos: MutableRefObject<{ x: number; z: number }>; onNearSpot: (id: FieldSpotId | null) => void }) {
  const last = useRef<FieldSpotId | null>(null);
  useFrame(() => {
    const now = fieldSpotAt(pos.current, last.current);
    if (now !== last.current) {
      last.current = now;
      onNearSpot(now);
    }
  });
  return null;
}

interface Props {
  pos: MutableRefObject<{ x: number; z: number }>;
  onNearExit: (near: boolean) => void;
  onNearSpot: (id: FieldSpotId | null) => void;
  /** The fall and yardstick being drawn (the page owns them, so E can change them). */
  tools: FieldTools;
  /** The preset falls and range the backend answered with, so the stones know their numbers. */
  onPresets: (p: { toStorm: number | null; toSiege: number | null; min: number; max: number }) => void;
}

/**
 * The Siege Field: a wall line with one section per holding (its shape is the share that holding loses at the
 * drill's default fall), five siege engines, eight skeletons breathing in front of them and a command tent. The
 * ground, the invisible walls, the road back and the plates are code-built, so a failed model load leaves a bare but
 * working field. The camp is the same whatever the fall says; only the wall line carries a number.
 */
export default function SiegeField({ pos, onNearExit, onNearSpot, tools, onPresets }: Props) {
  const yard = useSiegeYard(tools.fall, FIELD_MAX_SECTIONS, tools.benchmark);
  const view = yard.status === "ready" ? yard.view : null;
  // The stones' numbers come from the same answer the wall line is drawn from.
  const toStorm = view?.toStorm ?? null;
  const toSiege = view?.toSiege ?? null;
  const dropMin = view?.dropMin;
  const dropMax = view?.dropMax;
  useEffect(() => {
    if (dropMin !== undefined && dropMax !== undefined) onPresets({ toStorm, toSiege, min: dropMin, max: dropMax });
  }, [toStorm, toSiege, dropMin, dropMax, onPresets]);
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        {/* Deep on purpose: one long frame (a model loading) must not let the hero fall through a thin slab. */}
        <CuboidCollider args={[170, 10, 170]} position={[0, -10, 0]} />
        {/* Four invisible walls keep the hero on the field. */}
        <CuboidCollider args={[FIELD_HALF + 2, 5, 1]} position={[0, 5, -FIELD_HALF - 1]} />
        <CuboidCollider args={[FIELD_HALF + 2, 5, 1]} position={[0, 5, FIELD_HALF + 1]} />
        <CuboidCollider args={[1, 5, FIELD_HALF + 2]} position={[-FIELD_HALF - 1, 5, 0]} />
        <CuboidCollider args={[1, 5, FIELD_HALF + 2]} position={[FIELD_HALF + 1, 5, 0]} />
      </RigidBody>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[160, 48]} />
        <meshStandardMaterial color={GRASS} flatShading />
      </mesh>
      <ExitPost />
      <ExitWatch pos={pos} onNearExit={onNearExit} />
      <SpotWatch pos={pos} onNearSpot={onNearSpot} />
      <Winch tools={tools} />
      <PiecesBoundary what="pieces">
        <Suspense fallback={null}>
          <SiegePieces view={view} tools={tools} />
        </Suspense>
      </PiecesBoundary>
      <Attackers />
      <Battlefield />
      <PiecesBoundary what="tent">
        <Suspense fallback={null}>
          <Tent status={yard.status === "ready" ? yard.view : yard.status} />
        </Suspense>
      </PiecesBoundary>
    </group>
  );
}
