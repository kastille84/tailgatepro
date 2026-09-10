import type { ReactNode } from "react";

import { Button } from "../button";
import { Modal } from "../modal";
import { StyledConfirmActions, StyledConfirmBody } from "./styles";

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  /** Body copy — the consequence of confirming, spelled out. */
  children: ReactNode;
  /** Label for the confirming button (e.g. "Delete project"). */
  confirmLabel: string;
  /** `danger` for destructive, irreversible actions. */
  confirmVariant?: "primary" | "danger";
  isBusy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/** A minimal confirm-before-acting dialog built on the `Modal` primitive: a
 *  short body explaining the consequence, plus Cancel / confirm buttons. Use it
 *  ahead of any irreversible action; reversible ones don't need one. */
export const ConfirmDialog = ({
  isOpen,
  title,
  children,
  confirmLabel,
  confirmVariant = "primary",
  isBusy = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) => (
  <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
    <StyledConfirmBody>{children}</StyledConfirmBody>
    <StyledConfirmActions>
      <Button type="button" variant="outline" size="md" onClick={onClose}>
        Cancel
      </Button>
      <Button
        type="button"
        variant={confirmVariant}
        size="md"
        loading={isBusy}
        onClick={onConfirm}
      >
        {confirmLabel}
      </Button>
    </StyledConfirmActions>
  </Modal>
);
