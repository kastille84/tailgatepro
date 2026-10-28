/** A logged toolbox talk meeting. Mirrors the server's `toMeetingLog` output
 *  (server/services/meetingLogs.js). */
export interface MeetingLog {
  id: string;
  projectId: string;
  talkId: string | null;
  foremanId: string;
  companyId: string;
  /** Signed-URL-backed path is resolved separately (`getCrewPhotoUrl`) — this
   *  is the raw Storage path, not a directly-usable URL. */
  crewPhotoUrl: string | null;
  finalPdfUrl: string | null;
  /** Set once the meeting is completed — locks the meeting log and its
   *  signatures against further edits. Stamped at server receipt (an audit
   *  record), so for a meeting completed offline it can be well after the
   *  meeting actually happened — see `heldAt`. */
  completedAt: string | null;
  /** When the meeting was actually held, as reported by the client at
   *  completion. Falls back to `completedAt` on the server for rows that never
   *  had one; null until the meeting is completed. */
  heldAt: string | null;
  syncedAt: string | null;
  createdAt: string;
  /** HMAC-SHA256 tamper-evidence seal (Phase 9e), set once at completion. Null
   *  until completed, and for a meeting completed before this feature
   *  shipped (not backfilled). Never verify by comparing this string
   *  client-side — always call `verifyMeetingSeal`. */
  contentSeal: string | null;
  sealedAt: string | null;
}

/** The result of `GET /api/meetings/:id/verify-seal` (or the GC-side
 *  equivalent): whether the meeting's current server-side state still
 *  matches its stored content seal. */
export interface SealVerification {
  valid: boolean;
  sealedAt: string;
  /** Present only when an image embedded in the PDF no longer matches the
   *  hash sealed at render time (a Storage-level swap). */
  imageMismatches?: SealImageMismatch[];
}

/** One embedded image that no longer matches its sealed hash. */
export type SealImageMismatch =
  | { kind: "crewPhoto" }
  | { kind: "signature"; id: string; workerName: string };

/** The result of the unauthenticated `GET /api/public/meetings/:id/verify`
 *  behind the QR code printed on every report. Pass/fail only, no names. */
export interface PublicSealStatus {
  sealed: true;
  valid: boolean;
  sealedAt: string;
  /** Whether a file fingerprint exists to check a dropped PDF against; false
   *  for a meeting completed before the PDF seal shipped. */
  fileFingerprint: boolean;
  imageMismatchCount: number;
}

/** How a dropped PDF compares to the one TailgatePro generated. */
export type PdfFileCheckStatus =
  | "current"
  | "superseded"
  | "no-match"
  | "record-altered";

export interface PdfFileCheck {
  matches: boolean;
  status: PdfFileCheckStatus;
}
