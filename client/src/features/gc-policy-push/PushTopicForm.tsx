import { useState } from "react";

import { useGcPolicyPushTalks } from "../../hooks/useGcPolicyPushTalks";
import { usePushPolicyTopic } from "../../hooks/usePushPolicyTopic";
import { Button } from "../../ui_comps/button";
import { ConfirmDialog } from "../../ui_comps/confirm-dialog";
import { FormField } from "../../ui_comps/form";
import { Select } from "../../ui_comps/select";
import { StyledFormRow } from "./styles";

/** Lets a manager (admin/safety_manager — enforced server-side too) pick a
 *  global talk and push it as the company's current required topic across
 *  every active jobsite (Phase 9e, docs/policy-push-design.md). A broad,
 *  company-wide action, so it's confirmed before firing, same precedent as
 *  an archive/delete flow. */
export const PushTopicForm = () => {
  const [selectedTalkId, setSelectedTalkId] = useState("");
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const { talks, isLoading } = useGcPolicyPushTalks(true);
  const { pushTopic, isPushing } = usePushPolicyTopic();

  const selectedTalk = talks.find((talk) => talk.id === selectedTalkId);

  const handleConfirm = async () => {
    await pushTopic(selectedTalkId);
    setIsConfirmOpen(false);
    setSelectedTalkId("");
  };

  return (
    <>
      <StyledFormRow>
        <FormField id="policy-push-talk" label="Topic to push">
          <Select
            value={selectedTalkId}
            onChange={(event) => setSelectedTalkId(event.target.value)}
            placeholder={isLoading ? "Loading talks…" : "Choose a talk"}
            disabled={isLoading}
            options={talks.map((talk) => ({ value: talk.id, label: talk.title }))}
          />
        </FormField>
        <Button
          type="button"
          disabled={!selectedTalkId}
          onClick={() => setIsConfirmOpen(true)}
        >
          Push to all active sites
        </Button>
      </StyledFormRow>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        title="Push required topic?"
        confirmLabel="Push topic"
        isBusy={isPushing}
        onConfirm={handleConfirm}
        onClose={() => setIsConfirmOpen(false)}
      >
        <strong>{selectedTalk?.title}</strong> will become the required topic across every
        active job site on your portfolio, replacing any topic currently pushed. Every
        subcontractor's foreman will see it nudged in their talk picker, but can still log
        a different talk.
      </ConfirmDialog>
    </>
  );
};
