/**
 * The one interior hall box (S21). The tower library and the Town Hall used to declare the same room twice;
 * both now point here, so a change to the shell is a change in one place. Pure data, no three.js, no React.
 * Local coordinates: x east, z south, y up. Every interior sits at the origin; that is safe because only one
 * area is drawn at a time.
 */
export const INTERIOR_BOX = { minX: -11, maxX: 11, minZ: -10, maxZ: 9, height: 7 } as const;
/** A closed pair of doors in the south wall; E beside it leads back out. */
export const INTERIOR_DOOR = { x: 0, z: INTERIOR_BOX.maxZ, width: 3.2 } as const;
