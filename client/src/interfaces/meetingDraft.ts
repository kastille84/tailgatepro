/** In-progress meeting wizard state, written incrementally as the wizard
 *  advances (a foreman collecting several signatures on a job site is
 *  exactly the user most likely to get interrupted mid-flow) so reopening
 *  the app resumes the draft instead of losing already-collected data. Phase
 *  4e only defines this table's schema; the wizard that reads/writes it, and
 *  the concrete shape of `data`, are Phase 4g's concern. See
 *  `docs/meeting-flow-design.md`. */
export interface MeetingDraftRow {
  id: string;
  projectId: string;
  talkId: string | null;
  status: string;
  updatedAt: string;
  /** Freeform bag for unsubmitted step data — Phase 4g's concern. */
  data: Record<string, unknown>;
}
