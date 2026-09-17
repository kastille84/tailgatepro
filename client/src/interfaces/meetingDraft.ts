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

/** Where the wizard was when the draft was last persisted. */
export type WizardStep =
  | "project"
  | "talk"
  | "present"
  | "signatures"
  | "photo"
  | "save";

/** One crew member's answer to one quiz question — structurally identical to
 *  `features/meeting-flow/Quiz.tsx`'s `QuizAnswerSelection` (kept as its own
 *  declaration here rather than imported, since `interfaces/` has no existing
 *  precedent for depending on `features/`). */
export interface DraftQuizAnswer {
  questionIndex: number;
  selectedIndex: number;
}

/** One crew member collected during the wizard's "signatures" step. Quiz and
 *  signature are captured together per worker, not once per meeting —
 *  `signatures.quiz_score`/`quiz_answers` are recorded per signature in the
 *  schema (`docs/meeting-flow-design.md`). `signatureId`/`blobUploaded` are
 *  Save-phase checkpoints: unset until the wizard's final Save step actually
 *  creates/uploads this signer's record, so a retried Save after a partial
 *  failure never creates a duplicate (see `MeetingWizard.tsx`). */
export interface DraftSigner {
  localId: string;
  workerName: string;
  /** `null` when the talk has no quiz (`talk.quiz === null`). */
  quizAnswers: DraftQuizAnswer[] | null;
  signatureBlob: Blob;
  signatureId?: string;
  blobUploaded?: boolean;
}

/** The concrete shape of `MeetingDraftRow.data` (see its doc comment above).
 *  `meetingLogId`/`photoUploaded` are the same kind of Save-phase checkpoint
 *  as `DraftSigner`'s, for the meeting log and crew photo respectively. */
export interface MeetingDraftData {
  currentStep: WizardStep;
  signers: DraftSigner[];
  /** `undefined` = not yet decided, `null` = explicitly skipped, a `Blob` =
   *  captured and pending upload. */
  photoBlob?: Blob | null;
  meetingLogId?: string;
  photoUploaded?: boolean;
}
