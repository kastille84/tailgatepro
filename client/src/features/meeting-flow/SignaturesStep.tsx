import { useRef, useState } from "react";

import { Button } from "../../ui_comps/button";
import { FormField, TextInput } from "../../ui_comps/form";
import { SignaturePad } from "../../ui_comps/signature-pad";
import type { SignaturePadHandle } from "../../ui_comps/signature-pad";
import type { Talk } from "../../interfaces/talk";
import type { DraftSigner } from "../../interfaces/meetingDraft";
import { Quiz } from "./Quiz";
import type { QuizAnswerSelection } from "./Quiz";
import {
  StyledAddFlowWrapper,
  StyledSignerBadge,
  StyledSignerCard,
  StyledSignerName,
  StyledSignersEmpty,
  StyledSignersHeader,
  StyledSignersList,
  StyledStageActions,
} from "./styles";

type AddStage = "name" | "quiz" | "sign";

interface SignaturesStepProps {
  talk: Talk;
  signers: DraftSigner[];
  onAddSigner: (signer: DraftSigner) => void;
  onRemoveSigner: (localId: string) => void;
  onContinue: () => void;
}

/**
 * Step 4 of the meeting wizard: collect each crew member's quiz answers and
 * signature, one at a time. This is one repeating sub-flow rather than two
 * sequential wizard steps because `signatures.quiz_score`/`quiz_answers` are
 * recorded per signature, not per meeting (docs/meeting-flow-design.md) --
 * each worker takes the quiz (when the talk has one) immediately before
 * signing. Continue is disabled until at least one signer is collected,
 * mirroring the server's "complete requires >=1 signature" rule even though
 * this wizard never calls complete() itself (docs/tasks.md Phase 4g/4h).
 */
export const SignaturesStep = ({
  talk,
  signers,
  onAddSigner,
  onRemoveSigner,
  onContinue,
}: SignaturesStepProps) => {
  const [isAdding, setIsAdding] = useState(false);
  const [stage, setStage] = useState<AddStage>("name");
  const [workerName, setWorkerName] = useState("");
  const [quizAnswers, setQuizAnswers] = useState<QuizAnswerSelection[] | null>(
    null,
  );
  const [hasStroke, setHasStroke] = useState(false);
  const sigRef = useRef<SignaturePadHandle>(null);

  const startAdding = () => {
    setWorkerName("");
    setQuizAnswers(null);
    setHasStroke(false);
    setStage("name");
    setIsAdding(true);
  };

  const cancelAdding = () => setIsAdding(false);

  const handleNameContinue = () => {
    setStage(talk.quiz ? "quiz" : "sign");
  };

  const handleQuizContinue = (answers: QuizAnswerSelection[]) => {
    setQuizAnswers(answers);
    setStage("sign");
  };

  const handleSaveSignature = async () => {
    const blob = await sigRef.current!.exportBlob();
    onAddSigner({
      localId: crypto.randomUUID(),
      workerName: workerName.trim(),
      quizAnswers,
      signatureBlob: blob,
    });
    setIsAdding(false);
  };

  if (isAdding) {
    return (
      <StyledAddFlowWrapper>
        {stage === "name" && (
          <>
            <FormField id="signer-name" label="Worker's name">
              <TextInput
                value={workerName}
                onChange={(event) => setWorkerName(event.target.value)}
                placeholder="Full name"
                autoFocus
              />
            </FormField>
            <StyledStageActions>
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={cancelAdding}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="md"
                onClick={handleNameContinue}
                disabled={!workerName.trim()}
              >
                Continue
              </Button>
            </StyledStageActions>
          </>
        )}

        {stage === "quiz" && talk.quiz && (
          <Quiz questions={talk.quiz} onContinue={handleQuizContinue} />
        )}

        {stage === "sign" && (
          <>
            <SignaturePad
              ref={sigRef}
              onEnd={(isEmpty) => setHasStroke(!isEmpty)}
              aria-label={`${workerName.trim()}'s signature`}
            />
            <StyledStageActions>
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={cancelAdding}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="md"
                onClick={handleSaveSignature}
                disabled={!hasStroke}
              >
                Save signature
              </Button>
            </StyledStageActions>
          </>
        )}
      </StyledAddFlowWrapper>
    );
  }

  return (
    <>
      <StyledSignersHeader>
        {signers.length === 0
          ? "No signatures collected yet."
          : `${signers.length} signature${signers.length === 1 ? "" : "s"} collected.`}
      </StyledSignersHeader>

      {signers.length === 0 ? (
        <StyledSignersEmpty>
          Add each crew member who attended before continuing.
        </StyledSignersEmpty>
      ) : (
        <StyledSignersList>
          {signers.map((signer) => (
            <StyledSignerCard key={signer.localId}>
              <StyledSignerName>{signer.workerName}</StyledSignerName>
              <StyledSignerBadge>
                {signer.quizAnswers
                  ? `Quiz: ${signer.quizAnswers.length} answered`
                  : "No quiz"}
              </StyledSignerBadge>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onRemoveSigner(signer.localId)}
                aria-label={`Remove ${signer.workerName}`}
              >
                Remove
              </Button>
            </StyledSignerCard>
          ))}
        </StyledSignersList>
      )}

      <StyledStageActions>
        <Button
          type="button"
          variant="outline"
          size="md"
          onClick={startAdding}
        >
          Add worker
        </Button>
        <Button
          type="button"
          size="md"
          onClick={onContinue}
          disabled={signers.length === 0}
        >
          Continue
        </Button>
      </StyledStageActions>
    </>
  );
};
