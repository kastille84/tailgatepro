import { useState } from "react";

import { Button } from "../../ui_comps/button";
import { RadioGroup } from "../../ui_comps/radio";
import type { TalkQuizQuestion } from "../../interfaces/talk";
import {
  StyledActions,
  StyledQuestion,
  StyledQuestionText,
  StyledResult,
  StyledWrapper,
} from "./styles";

/** One worker's answer to one quiz question, in the exact shape
 *  `apiSignatures.ts`'s `CreateSignatureInput.quizAnswers` expects — the 4g
 *  wizard can pass `onContinue`'s argument straight through to
 *  `useCreateSignature` with no reshaping. */
export interface QuizAnswerSelection {
  questionIndex: number;
  selectedIndex: number;
}

interface QuizProps {
  questions: TalkQuizQuestion[];
  /** Fires once, when every question has an answer and the worker taps
   *  Continue. */
  onContinue: (answers: QuizAnswerSelection[]) => void;
}

/**
 * Renders a talk's 3-question comprehension quiz (docs/tasks.md Phase 4f,
 * PRD §4.4). Purely presentational, same 4f/4g boundary as `SignaturePad`:
 * this component only hands back the worker's selections via `onContinue`.
 * It does not call `useCreateSignature` itself -- wiring the answers into
 * the signature create call is the 4g wizard's job.
 *
 * The pass/fail summary shown here is UX-only feedback so a worker can see
 * how they did before moving on -- `POST /api/meetings/:meetingId/signatures`
 * always recomputes `quiz_score`/`quiz_passed` itself from
 * `toolbox_talks.quiz` and never trusts a client-reported result (see
 * docs/meeting-flow-design.md). Continue is blocked only by "every question
 * answered", never by the score -- a worker isn't locked out of proceeding
 * for missing a question.
 */
export const Quiz = ({ questions, onContinue }: QuizProps) => {
  const [answers, setAnswers] = useState<(number | null)[]>(() =>
    questions.map(() => null),
  );

  const allAnswered = answers.every((answer) => answer !== null);
  const correctCount = questions.reduce(
    (count, question, index) =>
      count + (answers[index] === question.correctIndex ? 1 : 0),
    0,
  );

  const handleSelect = (questionIndex: number, selectedIndex: number) => {
    setAnswers((current) => {
      const next = [...current];
      next[questionIndex] = selectedIndex;
      return next;
    });
  };

  // Guarded by the Continue button's own `disabled` state -- this only ever
  // runs once every question has an answer.
  const handleContinue = () => {
    onContinue(
      answers.map((selectedIndex, questionIndex) => ({
        questionIndex,
        selectedIndex: selectedIndex as number,
      })),
    );
  };

  return (
    <StyledWrapper>
      {questions.map((question, questionIndex) => (
        <StyledQuestion key={questionIndex}>
          <StyledQuestionText>
            {questionIndex + 1}. {question.question}
          </StyledQuestionText>
          <RadioGroup
            name={`quiz-question-${questionIndex}`}
            ariaLabel={question.question}
            value={
              answers[questionIndex] === null
                ? null
                : String(answers[questionIndex])
            }
            onChange={(value) => handleSelect(questionIndex, Number(value))}
            options={question.choices.map((choice, choiceIndex) => ({
              value: String(choiceIndex),
              label: choice,
            }))}
          />
        </StyledQuestion>
      ))}

      {allAnswered && (
        <StyledResult $passed={correctCount === questions.length}>
          {correctCount === questions.length
            ? `All ${questions.length} correct.`
            : `${correctCount} of ${questions.length} correct. Review the talk with the crew before continuing if needed.`}
        </StyledResult>
      )}

      <StyledActions>
        <Button type="button" onClick={handleContinue} disabled={!allAnswered}>
          Continue
        </Button>
      </StyledActions>
    </StyledWrapper>
  );
};
