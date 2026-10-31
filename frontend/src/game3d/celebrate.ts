/**
 * The quest-done celebration (S8): the one place a model shows a fact, so the rule is narrow.
 * It cheers only when quest 1 reads exactly "done" from the person's own journal, never on the
 * sample journal, and only once per page load. Pure, so every status is tested.
 */
import type { QuestStatus } from "./quest";

export function celebrationDue(status: QuestStatus, demo: boolean, alreadyDone: boolean): boolean {
  return status === "done" && !demo && !alreadyDone;
}
