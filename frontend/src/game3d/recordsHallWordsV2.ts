/**
 * Words on the plate over the Hall of Records shelves (version 2, #523). V1 (`recordsHallWordsV1.ts`) was shown to Faiz, so
 * this is a new file, not an edit (CLAUDE.md rule 3). What changed from V1, nothing else:
 * - the owed line is one clause, "N owe a look-back" (V1: "N books wear a ribbon: a look-back is owed" wrapped to three
 *   lines with a lone "owed", which made the plate taller and hid more of the middle case);
 * - the overflow line reads "N more on the page" (V1: "in the page").
 * The ribbon itself still shows which books owe one; the plate only counts them.
 */
export const RECORDS_HALL_TITLE = "The Hall of Records";
/** The journal was read and holds no decisions. */
export const RECORDS_HALL_EMPTY = "No books yet. Write a decision at the desk.";
/** The journal has not been read yet (first load still on its way): unknown, so no number and no guess (fog). */
export const RECORDS_HALL_NOT_READ = "Not read yet.";
/** The first read failed: still unknown (fog), and says so without promising a retry that may not come. */
export const RECORDS_HALL_READ_FAILED = "Could not read the books just now.";

export const decisionsLine = (n: number): string => `${n} ${n === 1 ? "decision" : "decisions"} on the shelves`;
export const owedLine = (n: number): string => `${n} ${n === 1 ? "owes" : "owe"} a look-back`;
export const moreLine = (n: number): string => `${n} more on the page`;
