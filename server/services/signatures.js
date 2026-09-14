const { supabase } = require("../utility/supabaseClient");
const { AppError } = require("../utility/AppError");
const meetingLogsService = require("./meetingLogs");

const SIGNATURE_COLUMNS =
  "id, meeting_id, worker_name, signature_path, quiz_passed, quiz_score, quiz_answers, created_at";

const toSignature = (row) => ({
  id: row.id,
  meetingId: row.meeting_id,
  workerName: row.worker_name,
  signaturePath: row.signature_path,
  quizPassed: row.quiz_passed,
  quizScore: row.quiz_score,
  quizAnswers: row.quiz_answers ?? null,
  createdAt: row.created_at,
});

// Scores a worker's submitted answers against the talk's authoritative quiz —
// never the reverse. Docs/meeting-flow-design.md: the client computes
// pass/fail immediately for UX feedback, but this is the only score that
// actually lands on the record. A talk with no quiz yet, or a meeting whose
// talk was detached (meeting_logs.talk_id is ON DELETE SET NULL), yields
// null/null/null rather than a hard failure — the quiz gate is a talk
// property, not a hard requirement of every signature.
const scoreQuiz = (quiz, submittedAnswers) => {
  if (!Array.isArray(quiz) || quiz.length === 0) {
    return { quizAnswers: null, quizScore: null, quizPassed: null };
  }

  const answers = quiz.map((question, questionIndex) => {
    const submitted = (submittedAnswers ?? []).find(
      (answer) => answer.questionIndex === questionIndex,
    );
    const selectedIndex = submitted?.selectedIndex ?? null;
    return {
      questionIndex,
      selectedIndex,
      correct: selectedIndex === question.correctIndex,
    };
  });

  const quizScore = answers.filter((answer) => answer.correct).length;
  return { quizAnswers: answers, quizScore, quizPassed: quizScore === quiz.length };
};

// Creates a signature against a meeting the caller's company owns and that
// isn't completed yet (assertNotCompleted covers both the ownership check and
// the immutability guard, and hands back the meeting's talkId for scoring).
//
// `signature_path` is set to its deterministic Storage path
// (signatures/{meetingId}/{id}.png — see docs/meeting-flow-design.md) at
// row-creation time, before the actual blob exists: the path only depends on
// ids the caller already has, not on the file's bytes, so the row can be
// created first and the blob uploaded to that same path afterward via
// `PUT /api/signatures/:id/blob` (Phase 4d). This is also the order the
// offline queue needs — a blob-upload row has to key against an id that
// already exists server-side.
const create = async ({ id, companyId, meetingId, workerName, quizAnswers }) => {
  const { talkId } = await meetingLogsService.assertNotCompleted(meetingId, companyId);

  let quiz = null;
  if (talkId) {
    const { data: talkRow, error: talkError } = await supabase
      .from("toolbox_talks")
      .select("quiz")
      .eq("id", talkId)
      .single();

    if (talkError && talkError.code !== "PGRST116") {
      throw new AppError("Could not load the talk's quiz", 502, {
        cause: talkError,
      });
    }
    quiz = talkRow?.quiz ?? null;
  }

  const scored = scoreQuiz(quiz, quizAnswers);

  const { data, error } = await supabase
    .from("signatures")
    .insert({
      id,
      meeting_id: meetingId,
      worker_name: workerName,
      signature_path: `signatures/${meetingId}/${id}.png`,
      quiz_passed: scored.quizPassed,
      quiz_score: scored.quizScore,
      quiz_answers: scored.quizAnswers,
    })
    .select(SIGNATURE_COLUMNS)
    .single();

  if (error) {
    // 23505 = unique_violation on signatures.id (pkey) — this id was already
    // used (an offline-sync retry collision).
    if (error.code === "23505") {
      throw new AppError("This signature already exists", 409, { cause: error });
    }
    throw new AppError("Could not create the signature", 502, { cause: error });
  }

  return toSignature(data);
};

// Lists a meeting's signatures — scoped by first confirming the meeting
// belongs to the caller's company (getById 404s otherwise, same as every
// other company-scoped lookup in this codebase).
const listForMeeting = async (meetingId, companyId) => {
  await meetingLogsService.getById(meetingId, companyId);

  const { data, error } = await supabase
    .from("signatures")
    .select(SIGNATURE_COLUMNS)
    .eq("meeting_id", meetingId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new AppError("Could not load signatures", 502, { cause: error });
  }

  return data.map(toSignature);
};

module.exports = { create, listForMeeting };
