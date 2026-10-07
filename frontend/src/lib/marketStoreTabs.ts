/** The store page's tabs (game mode, UX noise audit Wave G2). One page used to stack nine
 * sections (1,339 words); now only the open tab is mounted. The tab is kept in the URL
 * (?tab=gates) so it can be linked to. Pure. */

export const STORE_TABS = [
  { id: "decision", label: "Decision" },
  { id: "gates", label: "Gates" },
  { id: "moat", label: "Moat" },
  { id: "numbers", label: "Numbers and case" },
  { id: "tripwires", label: "Tripwires" },
] as const;

export type StoreTabId = (typeof STORE_TABS)[number]["id"];

/** The tab named in the URL, or the decision when it is missing or not a tab. */
export function storeTab(param: string | null): StoreTabId {
  const hit = STORE_TABS.find((t) => t.id === param);
  return hit ? hit.id : "decision";
}
