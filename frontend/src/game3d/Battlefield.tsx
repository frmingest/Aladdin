import { useMemo } from "react";
import {
  BATTLE_BOARD,
  BATTLE_COLORS,
  BATTLE_GROUND,
  BATTLE_X0,
  CHALK_DEPTH,
  CHALK_OFFSET,
  SCORCH_DEPTH,
  WAR_TABLE,
  battlefieldFor,
  boardLines,
  notesFor,
  tableLines,
} from "./battlefield";
import type { BattleRow } from "./battlefield";
import { useBattlefield } from "./useBattlefield";
import WorldLabel from "./WorldLabel";
import WorldSign from "./WorldSign";

/** One holding's two bars on the flat ground: scorch (what happened) over chalk (what the page said). No colliders: you walk over them. */
function Row({ r }: { r: BattleRow }) {
  return (
    <group>
      {r.tested ? (
        <>
          {r.scorch > 0 && (
            <mesh position={[BATTLE_X0 + r.scorch / 2, 0.08, r.z]}>
              <boxGeometry args={[r.scorch, 0.1, SCORCH_DEPTH]} />
              <meshStandardMaterial color={BATTLE_COLORS.scorch} flatShading />
            </mesh>
          )}
          {r.chalk > 0 && (
            <mesh position={[BATTLE_X0 + r.chalk / 2, 0.08, r.z + CHALK_OFFSET]}>
              <boxGeometry args={[r.chalk, 0.1, CHALK_DEPTH]} />
              <meshStandardMaterial color={BATTLE_COLORS.chalk} flatShading />
            </mesh>
          )}
        </>
      ) : (
        /* A holding the method could not be tested on: a pale ghost post and a "?", never a bar. */
        <mesh position={[BATTLE_X0 + 0.4, 0.6, r.z]}>
          <boxGeometry args={[0.6, 1.2, 0.6]} />
          <meshStandardMaterial color={BATTLE_COLORS.fog} transparent opacity={0.35} depthWrite={false} />
        </mesh>
      )}
      <WorldLabel position={[BATTLE_X0 + 6, 1.1, r.z + 0.4]} distanceFactor={16} ariaHidden>
          {r.plate}
        </WorldLabel>
    </group>
  );
}

function Board({ lines }: { lines: string[] }) {
  return (
    <>
      {/* The title is painted on a banner; the lines under it stay a plate until they move into a panel. */}
      <WorldSign spec={{ kind: "banner", lines: [lines[0] ?? ""] }} position={[BATTLE_BOARD.x, 4.4, BATTLE_BOARD.z]} width={4} />
      {lines.length > 1 && (
        <WorldLabel position={[BATTLE_BOARD.x, 2.6, BATTLE_BOARD.z]} distanceFactor={16} ariaHidden>
          {lines.slice(1).map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </WorldLabel>
      )}
    </>
  );
}

/** The war table: a plain slab on four legs with up to three parchment notes lying on it, and the same notes as a board. */
function WarTable({ lines, pinned }: { lines: string[]; pinned: number }) {
  const { x, z, width, depth, height } = WAR_TABLE;
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, height, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, 0.2, depth]} />
        <meshStandardMaterial color={BATTLE_COLORS.table} flatShading />
      </mesh>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * (width / 2 - 0.25), height / 2, sz * (depth / 2 - 0.25)]}>
            <boxGeometry args={[0.25, height, 0.25]} />
            <meshStandardMaterial color={BATTLE_COLORS.table} flatShading />
          </mesh>
        )),
      )}
      {Array.from({ length: pinned }, (_, i) => (
        <mesh key={i} position={[(i - (pinned - 1) / 2) * 1.3, height + 0.13, 0]} rotation={[0, i * 0.35 - 0.3, 0]}>
          <boxGeometry args={[1, 0.04, 1.4]} />
          <meshStandardMaterial color={BATTLE_COLORS.parchment} flatShading />
        </mesh>
      ))}
      <WorldLabel position={[0, height + 3, 0]} distanceFactor={16} ariaHidden>
          {lines.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </WorldLabel>
    </group>
  );
}

/**
 * The old battlefield and the war table. Reads once when the field opens; the ground, the board and the table are
 * drawn whatever the reads say, so a failed read leaves a bare but working strip with a word saying so.
 */
export default function Battlefield() {
  const { backtest, drills } = useBattlefield();
  const field = useMemo(() => battlefieldFor(backtest.status === "ready" ? backtest.value : null), [backtest]);
  const board = useMemo(() => boardLines(backtest, field.more), [backtest, field.more]);
  const table = useMemo(() => tableLines(drills), [drills]);
  const pinned = useMemo(() => notesFor(drills.status === "ready" ? drills.value : null).length, [drills]);
  return (
    <group>
      <mesh position={[BATTLE_GROUND.x, 0.04, BATTLE_GROUND.z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[BATTLE_GROUND.width, BATTLE_GROUND.depth]} />
        <meshStandardMaterial color={BATTLE_COLORS.ground} flatShading />
      </mesh>
      <Board lines={board} />
      {field.rows.map((r) => (
        <Row key={r.id} r={r} />
      ))}
      <WarTable lines={table} pinned={pinned} />
    </group>
  );
}
