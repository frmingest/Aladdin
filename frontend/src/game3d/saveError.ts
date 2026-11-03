import { ApiError } from "../lib/api";
import { readableDetail } from "../lib/errors";

/**
 * The detail behind a failed save, for a hover only. The face says "Couldn't save that." (voiceV2). The old hover came from
 * `describeError`, which always says "Could not load ...", the wrong verb for a save.
 */
export function saveErrorDetail(e: unknown): string {
  if (e instanceof ApiError) return readableDetail(e.message) ?? `error ${e.status}`;
  if (e instanceof TypeError) return "No answer from the server.";
  return "";
}
