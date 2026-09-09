import { useEffect } from "react";
import type { ComponentPropsWithoutRef } from "react";
import { createPortal } from "react-dom";

import {
  StyledCenter,
  StyledFullScreen,
  StyledMessage,
  StyledSpinner,
} from "./styles";
import type { SpinnerSize } from "./styles";

interface SpinnerProps extends ComponentPropsWithoutRef<"span"> {
  size?: SpinnerSize;
  /** Accessible status text announced to screen readers. */
  label?: string;
  /** Wrap the spinner in a centered, padded block. */
  center?: boolean;
  /** Cover the viewport with a light scrim and center the spinner. */
  fullScreen?: boolean;
  /** Optional caption rendered beneath the spinner. */
  message?: string;
}

/** A rotating ring for indeterminate loading states. */
export const Spinner = ({
  size,
  label = "Loading…",
  center = false,
  fullScreen = false,
  message,
  ...props
}: SpinnerProps) => {
  useEffect(() => {
    if (!fullScreen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [fullScreen]);

  const resolvedSize = size ?? (fullScreen ? "lg" : "md");

  const spinner = (
    <StyledSpinner
      $size={resolvedSize}
      role="status"
      aria-live="polite"
      aria-label={message ?? label}
      {...props}
    />
  );

  const caption = message ? <StyledMessage>{message}</StyledMessage> : null;

  if (fullScreen) {
    return createPortal(
      <StyledFullScreen>
        {spinner}
        {caption}
      </StyledFullScreen>,
      document.body,
    );
  }

  if (center || message) {
    return (
      <StyledCenter>
        {spinner}
        {caption}
      </StyledCenter>
    );
  }

  return spinner;
};
