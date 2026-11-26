import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { CapsuleCollider, RigidBody, useRapier } from "@react-three/rapier";
import type { RapierRigidBody } from "@react-three/rapier";
import * as THREE from "three";
import Avatar from "./Avatar";
import type { Motion } from "./animClips";
import { CAMERA_HIDE_HERO_WITHIN, cameraPull } from "./cameraRoom";
import type { CameraRoom } from "./cameraRoom";
import { HeroFigure } from "./Figures";
import { MAX_FRAME_DT } from "./physicsStep";
import { SPAWN } from "./layout";
import {
  JUMP_SPEED,
  RUN_SPEED,
  WALK_SPEED,
  cameraOffset,
  facingYaw,
  lookUpHeight,
  moveVector,
  shortestAngle,
} from "./movement";
import type { Keys } from "./movement";
import type { OrbitState } from "./useOrbit";

const HALF_HEIGHT = 0.5;
const RADIUS = 0.35;
/** Capsule centre sits this far above the feet. */
const CENTRE_HEIGHT = HALF_HEIGHT + RADIUS;
const FOCUS_HEIGHT = 1.5;
const TURN_RATE = 12;
const CAMERA_FOLLOW = 14;
/** Calm frames (under 50 ms each) to hover after a door, and the longest to hover whatever the frame rate. */
const HOVER_FRAMES = 4;
const HOVER_MAX_MS = 3000;
/** Below this the hero has left the world: put it back. */
const VOID_Y = -25;

interface Props {
  keys: MutableRefObject<Keys>;
  orbit: MutableRefObject<OrbitState>;
  /** Written every frame with where the hero stands, so others can ask who is near. */
  pos: MutableRefObject<{ x: number; z: number }>;
  /** A new key moves the hero there (into a tower's library, or back out of its door). */
  teleport?: Teleport | null;
  /** A new number starts one short cheer. */
  cheerKey?: number | null;
  /** Stand still (a move between places is under way). */
  hold?: boolean;
  /** The room the hero is in, when it has walls: the camera stays inside it. Null on open ground. */
  room?: CameraRoom | null;
}

export interface Teleport {
  key: number;
  x: number;
  z: number;
  /** Camera yaw to arrive with (the camera sits behind the hero). */
  yaw: number;
}

/**
 * The hero: a Rapier capsule driven by WASD, with a solid figure from simple shapes (a
 * rigged model can replace it later). Camera follows behind and above.
 */
export default function Player({ keys, orbit, pos: posOut, teleport = null, cheerKey = null, hold = false, room = null }: Props) {
  const body = useRef<RapierRigidBody>(null);
  const model = useRef<THREE.Group>(null);
  const facing = useRef(0);
  const motion = useRef<Motion>({ moving: false, running: false });
  const drawnAt = useRef(new THREE.Vector3());
  const { world, rapier } = useRapier();
  // After a door the hero hovers until the scene has settled: the first frames of a new room hitch (shaders,
  // models). With fixed steps (#486) a long frame no longer means one long step, but the hover stays: it also keeps her
  // still while the new floor's colliders arrive.
  const hover = useRef<{ frames: number; until: number } | null>(null);
  const holdRef = useRef(hold);
  holdRef.current = hold;
  const roomRef = useRef(room);
  roomRef.current = room;
  // Where to put the hero back if it ever falls out of the world.
  const home = useRef<{ x: number; z: number }>({ x: SPAWN.x, z: SPAWN.z });

  // Walking through a door: put the hero at the new spot, stop dead, and turn the camera to face the right way.
  useEffect(() => {
    const rb = body.current;
    if (!teleport || !rb) return;
    rb.setTranslation({ x: teleport.x, y: 1.5, z: teleport.z }, true);
    rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
    rb.setGravityScale(0, true);
    hover.current = { frames: HOVER_FRAMES, until: performance.now() + HOVER_MAX_MS };
    home.current = { x: teleport.x, z: teleport.z };
    posOut.current.x = teleport.x;
    posOut.current.z = teleport.z;
    orbit.current.yaw = teleport.yaw;
    facing.current = teleport.yaw + Math.PI;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teleport?.key]);

  useFrame((state, delta) => {
    const rb = body.current;
    if (!rb) return;
    const dt = Math.min(delta, MAX_FRAME_DT);
    const pos = rb.translation();
    const vel = rb.linvel();
    posOut.current.x = pos.x;
    posOut.current.z = pos.z;
    const k = keys.current;

    // Hovering after a door: no gravity, no walking, until a few calm frames have passed.
    const h = hover.current;
    let frozen = false;
    if (holdRef.current) {
      // A move between places: stand still until the new floor is there and the screen has cleared.
      frozen = true;
      rb.setLinvel({ x: 0, y: rb.linvel().y, z: 0 }, true);
    }
    if (h) {
      // A calm frame is shorter than the frame-time cap; a capped (slow) frame reports exactly MAX_FRAME_DT, so never counts.
      if (delta < MAX_FRAME_DT) h.frames -= 1;
      if (h.frames <= 0 || performance.now() > h.until) {
        hover.current = null;
        rb.setGravityScale(1, true);
      } else {
        frozen = true;
        rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
      }
    }
    // Safety net: out of the world means back where the last door (or the spawn) put you.
    if (pos.y < VOID_Y) {
      rb.setTranslation({ x: home.current.x, y: 1.5, z: home.current.z }, true);
      rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
      return;
    }

    const dir = moveVector(k, orbit.current.yaw);
    const speed = k.run ? RUN_SPEED : WALK_SPEED;

    // Standing on something? A short ray down from the capsule centre.
    const ray = new rapier.Ray({ x: pos.x, y: pos.y, z: pos.z }, { x: 0, y: -1, z: 0 });
    const grounded = world.castRay(ray, CENTRE_HEIGHT + 0.15, true, undefined, undefined, undefined, rb) !== null;
    const vy = grounded && k.jump && vel.y <= 0.1 ? JUMP_SPEED : vel.y;
    if (!frozen) rb.setLinvel({ x: dir.x * speed, y: vy, z: dir.z * speed }, true);

    motion.current.moving = dir.x !== 0 || dir.z !== 0;
    motion.current.running = k.run;

    // Turn the body towards where it is walking.
    if (dir.x !== 0 || dir.z !== 0) {
      facing.current += shortestAngle(facing.current, facingYaw(dir)) * Math.min(1, TURN_RATE * dt);
    }
    if (model.current) model.current.rotation.y = facing.current;

    // Follow camera: behind and above, easing so it never snaps. It follows the hero as drawn (#486): physics runs in
    // fixed steps and rapier draws her between the last two, so following the body itself would make her judder.
    const o = orbit.current;
    const [ox, oy, oz] = cameraOffset(o.yaw, o.pitch, o.distance);
    const drawn = model.current?.parent ? model.current.parent.getWorldPosition(drawnAt.current) : null;
    const seen = drawn ?? pos;
    const fx = seen.x;
    const fy = seen.y - CENTRE_HEIGHT + FOCUS_HEIGHT;
    const fz = seen.z;
    // In a room the camera comes in along its own line of sight until it is inside the walls (same view, closer).
    const walls = roomRef.current;
    const pull = walls ? cameraPull([fx, fy, fz], [ox, oy, oz], walls) : 1;
    const cam = state.camera;
    cam.position.lerp(new THREE.Vector3(fx + ox * pull, fy + oy * pull, fz + oz * pull), 1 - Math.exp(-CAMERA_FOLLOW * dt));
    if (walls) {
      // The easing starts from wherever the camera was (outside, on walking in): never let it show the room from behind a wall.
      cam.position.x = THREE.MathUtils.clamp(cam.position.x, walls.minX + 0.05, walls.maxX - 0.05);
      cam.position.z = THREE.MathUtils.clamp(cam.position.z, walls.minZ + 0.05, walls.maxZ - 0.05);
      cam.position.y = Math.min(cam.position.y, walls.height - 0.05);
    }
    cam.lookAt(fx, fy + lookUpHeight(o.pitch, o.distance * pull), fz);
    // Backed against a wall the camera ends up at her shoulder: do not draw her from the inside.
    if (model.current) model.current.visible = !walls || Math.hypot(cam.position.x - fx, cam.position.y - fy, cam.position.z - fz) > CAMERA_HIDE_HERO_WITHIN;
  });

  return (
    <RigidBody
      ref={body}
      position={[SPAWN.x, SPAWN.y, SPAWN.z]}
      enabledRotations={[false, false, false]}
      colliders={false}
      canSleep={false}
      linearDamping={0}
      // Continuous collision detection (#480). Physics now runs in fixed 1/60 s steps (#486), so one step carries her at
      // most about 0.2 m; CCD stays as a second guard for thin posts and walls.
      ccd
    >
      <CapsuleCollider args={[HALF_HEIGHT, RADIUS]} friction={0} />
      <group ref={model} position={[0, -CENTRE_HEIGHT, 0]}>
        <Avatar id="hero" height={HALF_HEIGHT * 2 + RADIUS * 2} fallback={<HeroFigure />} loadingFallback={null} motion={motion} cheerKey={cheerKey} />
      </group>
    </RigidBody>
  );
}
