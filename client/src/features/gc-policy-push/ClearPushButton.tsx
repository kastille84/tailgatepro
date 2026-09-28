import { useState } from "react";

import { useClearPolicyPush } from "../../hooks/useClearPolicyPush";
import { Button } from "../../ui_comps/button";
import { ConfirmDialog } from "../../ui_comps/confirm-dialog";

/** Clears the company's current required topic (Phase 9e,
 *  docs/policy-push-design.md). Only rendered when a push is active — see
 *  `GcPolicyPush.tsx`. */
export const ClearPushButton = () => {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const { clearPush, isClearing } = useClearPolicyPush();

  const handleConfirm = async () => {
    await clearPush();
    setIsConfirmOpen(false);
  };

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setIsConfirmOpen(true)}>
        Clear required topic
      </Button>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        title="Clear required topic?"
        confirmLabel="Clear topic"
        confirmVariant="danger"
        isBusy={isClearing}
        onConfirm={handleConfirm}
        onClose={() => setIsConfirmOpen(false)}
      >
        No topic will be required across your active sites until you push a new one.
      </ConfirmDialog>
    </>
  );
};
