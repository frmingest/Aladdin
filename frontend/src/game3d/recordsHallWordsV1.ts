/**
 * Words on the plate over the Hall of Records shelves (version 1, #505). A change that alters meaning is a new version
 * file (CLAUDE.md rule 3). The counted lines moved here unchanged from `recordsHallRoomLogic.ts`; NOT_READ is new.
 */
export const RECORDS_HALL_TITLE = "The Hall of Records";
/** The journal was read and holds no decisions. */
export const RECORDS_HALL_EMPTY = "No books yet. Write a decision at the desk.";
/** The journal is still loading or could not be read: unknown, so no number and no guess (fog). */
export const RECORDS_HALL_NOT_READ = "Not read yet. The shelves are under dust sheets.";

export const decisionsLine = (n: number): string => `${n} ${n === 1 ? "decision" : "decisions"} on the shelves`;
export const owedLine = (n: number): string => `${n} ${n === 1 ? "book wears" : "books wear"} a ribbon: a look-back is owed`;
export const moreLine = (n: number): string => `${n} more in the page`;
