/** Words for reading the old journal entries at the writing desk (version 1). A change that alters meaning is a new version file. */
export const DESK_READ_BOOKS = "Read the old books";
export const BOOKS_PANEL_TITLE = "The old books";
export const BOOKS_CLOSE = "Close";
export const BOOKS_BACK = "Back to the desk";
export const BOOKS_PLAIN = "Open the journal";
export const BOOKS_EMPTY = "No entries yet. Write the first one at the desk.";
export const BOOKS_FAILED = "The journal could not be read just now.";
export const BOOKS_NOT_WRITTEN = "Not written";

export const deskDueLine = (n: number): string => `${n} ${n === 1 ? "look-back is" : "look-backs are"} due. Open the old books.`;
