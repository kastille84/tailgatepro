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
   *  signatures against further edits. */
  completedAt: string | null;
  syncedAt: string | null;
  createdAt: string;
}
