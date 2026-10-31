import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { PAL, Part } from "./Inked";
import { DESK, DESK_FACING, SHELF, bookSlots } from "./desk";

/** Fixed colours by slot, never by data: the books are told apart by being there, not by colour. */
const BOOK_COLORS = [PAL.teal, PAL.cream, PAL.teal, PAL.cream] as const;

/**
 * The open-air writing desk and its shelf (Standing 2). Plain code-built shapes, the same ink
 * outline as the rest. The furniture is decoration; the one fact is the number of books on the
 * shelf: one per holding with a reason AND a wrong-if line. No light source, no animation
 * (so reduced motion needs nothing).
 */
export default function Desk({ books }: { books: number }) {
  const slots = bookSlots(books);
  return (
    <group>
      {/* The desk: top, four legs and a chair. */}
      <RigidBody type="fixed" colliders={false} position={[DESK.x, 0, DESK.z]} rotation={[0, DESK_FACING, 0]}>
        <CuboidCollider args={[1.15, 0.5, 0.6]} position={[0, 0.5, 0]} />
        <Part color={PAL.timberLight} position={[0, 1.02, 0]} grow={1.1}>
          <boxGeometry args={[2.3, 0.1, 1.2]} />
        </Part>
        {([-1, 1] as const).flatMap((sx) =>
          ([-1, 1] as const).map((sz) => (
            <Part key={`${sx}${sz}`} color={PAL.timberDark} position={[sx * 1.0, 0.5, sz * 0.48]} grow={1.25}>
              <boxGeometry args={[0.14, 1, 0.14]} />
            </Part>
          )),
        )}
        {/* A page and an ink pot on the desk: a plain sheet, nothing written on it. */}
        <Part color={PAL.cream} position={[-0.3, 1.09, 0.05]} grow={1.15} ink={false}>
          <boxGeometry args={[0.7, 0.03, 0.5]} />
        </Part>
        <Part color={PAL.iron} position={[0.6, 1.17, -0.2]} grow={1.2}>
          <cylinderGeometry args={[0.1, 0.12, 0.2, 10]} />
        </Part>
        {/* Chair, on the courtyard side of the desk. */}
        <Part color={PAL.timber} position={[0, 0.5, 1.15]} grow={1.12}>
          <boxGeometry args={[0.7, 0.08, 0.7]} />
        </Part>
        <Part color={PAL.timberDark} position={[0, 0.25, 1.15]} grow={1.2}>
          <boxGeometry args={[0.55, 0.5, 0.55]} />
        </Part>
        <Part color={PAL.timber} position={[0, 0.95, 1.46]} grow={1.12}>
          <boxGeometry args={[0.7, 0.8, 0.08]} />
        </Part>
      </RigidBody>

      {/* The shelf of written reasons: one book for every holding with both lines. */}
      <RigidBody type="fixed" colliders={false} position={[SHELF.x, 0, SHELF.z]} rotation={[0, DESK_FACING, 0]}>
        <CuboidCollider args={[1.1, 1.15, 0.3]} position={[0, 1.15, 0]} />
        <Part color={PAL.timberDark} position={[0, 1.15, -0.2]} grow={1.04}>
          <boxGeometry args={[2.2, 2.3, 0.08]} />
        </Part>
        {([-1.1, 1.1] as const).map((x) => (
          <Part key={x} color={PAL.timber} position={[x, 1.15, 0]} grow={1.2}>
            <boxGeometry args={[0.1, 2.3, 0.5]} />
          </Part>
        ))}
        {[0.2, 1.2, 2.25].map((y) => (
          <Part key={y} color={PAL.timberLight} position={[0, y, 0]} grow={1.12}>
            <boxGeometry args={[2.2, 0.1, 0.5]} />
          </Part>
        ))}
        {slots.map((s, i) => (
          <Part key={i} color={BOOK_COLORS[i % BOOK_COLORS.length]} position={[s.x, s.y + s.h / 2 + 0.05, 0]} grow={1.14}>
            <boxGeometry args={[0.34, s.h, 0.38]} />
          </Part>
        ))}
      </RigidBody>
    </group>
  );
}
