import { useRef } from "react";
import type { MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { CapsuleCollider, RigidBody, useRapier } from "@react-three/rapier";
import type { RapierRigidBody } from "@react-three/rapier";
import * as THREE from "three";
import Avatar from "./Avatar";
import { HeroFigure } from "./Figures";
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

interface Props {
  keys: MutableRefObject<Keys>;
  orbit: MutableRefObject<OrbitState>;
  /** Written every frame with where the hero stands, so others can ask who is near. */
  pos: MutableRefObject<{ x: number; z: number }>;
}

/**
 * The hero: a Rapier capsule driven by WASD, with a solid figure from simple shapes (a
 * rigged model can replace it later). Camera follows behind and above.
 */
export default function Player({ keys, orbit, pos: posOut }: Props) {
  const body = useRef<RapierRigidBody>(null);
  const model = useRef<THREE.Group>(null);
  const facing = useRef(0);
  const { world, rapier } = useRapier();

  useFrame((state, delta) => {
    const rb = body.current;
    if (!rb) return;
    const dt = Math.min(delta, 0.05);
    const pos = rb.translation();
    const vel = rb.linvel();
    posOut.current.x = pos.x;
    posOut.current.z = pos.z;
    const k = keys.current;

    const dir = moveVector(k, orbit.current.yaw);
    const speed = k.run ? RUN_SPEED : WALK_SPEED;

    // Standing on something? A short ray down from the capsule centre.
    const ray = new rapier.Ray({ x: pos.x, y: pos.y, z: pos.z }, { x: 0, y: -1, z: 0 });
    const grounded = world.castRay(ray, CENTRE_HEIGHT + 0.15, true, undefined, undefined, undefined, rb) !== null;
    const vy = grounded && k.jump && vel.y <= 0.1 ? JUMP_SPEED : vel.y;
    rb.setLinvel({ x: dir.x * speed, y: vy, z: dir.z * speed }, true);

    // Turn the body towards where it is walking.
    if (dir.x !== 0 || dir.z !== 0) {
      facing.current += shortestAngle(facing.current, facingYaw(dir)) * Math.min(1, TURN_RATE * dt);
    }
    if (model.current) model.current.rotation.y = facing.current;

    // Follow camera: behind and above, easing so it never snaps.
    const o = orbit.current;
    const [ox, oy, oz] = cameraOffset(o.yaw, o.pitch, o.distance);
    const fx = pos.x;
    const fy = pos.y - CENTRE_HEIGHT + FOCUS_HEIGHT;
    const fz = pos.z;
    const cam = state.camera;
    cam.position.lerp(new THREE.Vector3(fx + ox, fy + oy, fz + oz), 1 - Math.exp(-CAMERA_FOLLOW * dt));
    cam.lookAt(fx, fy + lookUpHeight(o.pitch, o.distance), fz);
  });

  return (
    <RigidBody
      ref={body}
      position={[SPAWN.x, SPAWN.y, SPAWN.z]}
      enabledRotations={[false, false, false]}
      colliders={false}
      canSleep={false}
      linearDamping={0}
    >
      <CapsuleCollider args={[HALF_HEIGHT, RADIUS]} friction={0} />
      <group ref={model} position={[0, -CENTRE_HEIGHT, 0]}>
        <Avatar id="hero" height={HALF_HEIGHT * 2 + RADIUS * 2} fallback={<HeroFigure />} />
      </group>
    </RigidBody>
  );
}
