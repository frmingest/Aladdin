import type { RecordReviewState } from "./types";

/**
 * Time capsules (game mode G37, Sprint 28): the 6- and 12-month reviews of a journal decision shown
 * as a seal. Pure presentation over the review state the backend already decided; nothing is
 * granted for opening one and no decision is graded. A decision is not its outcome.
 */

export type CapsuleState = "sealed" | "unsealed" | "opened";

export function capsuleState(review: RecordReviewState): CapsuleState {
  if (review === "written") return "opened";
  return review === "due" ? "unsealed" : "sealed";
}

export function capsuleLabel(months: 6 | 12, review: RecordReviewState): string {
  switch (capsuleState(review)) {
    case "opened":
      return `Month ${months}: opened, review written`;
    case "unsealed":
      return `Month ${months}: unsealed, review owed`;
    default:
      return `Month ${months}: sealed until it is due`;
  }
}

export const CAPSULE_CLASS: Record<CapsuleState, string> = {
  sealed: "bg-raised text-ink-faint",
  unsealed: "bg-caution-subtle text-caution",
  opened: "bg-positive-subtle text-positive",
};

export const CAPSULE_MARK: Record<CapsuleState, string> = { sealed: "●", unsealed: "◐", opened: "○" };
