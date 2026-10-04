import { tailgateDb } from "./tailgateDb";
import { withTimeout } from "../withTimeout";
import type { MeetingDraftRow } from "../../interfaces/meetingDraft";

// Mirrors mediaBlobs.ts's DEXIE_WRITE_TIMEOUT_MS — a stuck local write has no
// queue to fall back to, so it should reject for real rather than hang.
const DEXIE_WRITE_TIMEOUT_MS = 5_000;

/** Singleton row id — one foreman only ever has one meeting wizard in
 *  progress at a time, so the draft doesn't need its own generated id to be
 *  looked up again later. */
export const DRAFT_ROW_ID = "meeting-wizard-draft";

/** Reads the in-progress meeting draft, or `undefined` if none exists (a
 *  fresh wizard, or one already cleared by a finished Save or an explicit
 *  discard). */
export const getActiveDraft = (): Promise<MeetingDraftRow | undefined> =>
  tailgateDb.meetingDraftCache.get(DRAFT_ROW_ID);

/** Writes (replaces) the singleton draft row. Called at discrete step-commit
 *  points as the wizard advances — never on every keystroke or in-progress
 *  quiz/signature stroke. */
export const putDraft = async (
  row: Omit<MeetingDraftRow, "id">,
): Promise<void> => {
  await withTimeout(
    tailgateDb.meetingDraftCache.put({ ...row, id: DRAFT_ROW_ID }),
    DEXIE_WRITE_TIMEOUT_MS,
    "Couldn't save your progress locally — try again.",
  );
};

/** Removes the draft once Save finishes, or a user explicitly discards it via
 *  the resume-draft prompt. */
export const clearDraft = async (): Promise<void> => {
  await withTimeout(
    tailgateDb.meetingDraftCache.delete(DRAFT_ROW_ID),
    DEXIE_WRITE_TIMEOUT_MS,
  );
};
