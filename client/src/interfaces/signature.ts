/** One answer submitted against a talk's quiz, scored server-side —
 *  `correct` is always computed by the server (`scoreQuiz` in
 *  server/services/signatures.js), never trusted from the client. */
export interface QuizAnswer {
  questionIndex: number;
  selectedIndex: number | null;
  correct: boolean;
}

/** A worker's signature on a meeting log. Mirrors the server's `toSignature`
 *  output (server/services/signatures.js). */
export interface Signature {
  id: string;
  meetingId: string;
  workerName: string;
  /** Storage path relative to the `signatures` bucket
   *  (`{meetingId}/{id}.png`) — set at row-creation time, ahead of the
   *  actual blob upload. Resolved to a usable URL separately. */
  signaturePath: string;
  quizPassed: boolean | null;
  quizScore: number | null;
  quizAnswers: QuizAnswer[] | null;
  createdAt: string;
}
