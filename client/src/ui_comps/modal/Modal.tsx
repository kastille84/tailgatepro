import { useCallback, useEffect, useId, useRef } from "react";
import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import { createPortal } from "react-dom";
import { HiXMark } from "react-icons/hi2";

import {
  StyledBody,
  StyledClose,
  StyledHeader,
  StyledOverlay,
  StyledPanel,
  StyledTitle,
} from "./styles";
import type { ModalSize } from "./styles";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Accessible dialog title, rendered in the header and wired to aria-labelledby. */
  title: ReactNode;
  children: ReactNode;
  size?: ModalSize;
  /** Set false to require an explicit action to dismiss (Esc / overlay ignored). */
  dismissable?: boolean;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * A portal dialog rendered at `document.body`. Traps focus while open, restores
 * focus to the previously-focused element on close, locks body scroll, and
 * closes on Esc / overlay click unless `dismissable` is false.
 *
 * Hand-rolled on `createPortal` rather than `react-modal` (which ships no
 * types in this project).
 */
export const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
  dismissable = true,
}: ModalProps) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const titleId = useId();

  const requestClose = useCallback(() => {
    if (dismissable) onClose();
  }, [dismissable, onClose]);

  // Remember the trigger, move focus into the dialog, restore focus on close.
  useEffect(() => {
    if (!isOpen) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const firstFocusable = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (firstFocusable ?? panel)?.focus();

    return () => {
      previouslyFocused.current?.focus?.();
    };
  }, [isOpen]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      requestClose();
      return;
    }

    if (event.key !== "Tab") return;

    const panel = panelRef.current;
    if (!panel) return;

    const focusable = Array.from(
      panel.querySelectorAll<HTMLElement>(FOCUSABLE),
    );
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && (active === first || active === panel)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const handleOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) requestClose();
  };

  return createPortal(
    <StyledOverlay
      data-testid="modal-overlay"
      onMouseDown={handleOverlayClick}
      onKeyDown={handleKeyDown}
    >
      <StyledPanel
        ref={panelRef}
        $size={size}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <StyledHeader>
          <StyledTitle id={titleId}>{title}</StyledTitle>
          {dismissable && (
            <StyledClose
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
            >
              <HiXMark aria-hidden="true" />
            </StyledClose>
          )}
        </StyledHeader>
        <StyledBody>{children}</StyledBody>
      </StyledPanel>
    </StyledOverlay>,
    document.body,
  );
};
