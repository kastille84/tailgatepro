import type { ComponentPropsWithoutRef } from "react";

import { StyledCenter, StyledSpinner } from "./styles";
import type { SpinnerSize } from "./styles";

interface SpinnerProps extends ComponentPropsWithoutRef<"span"> {
  size?: SpinnerSize;
  /** Accessible status text announced to screen readers. */
  label?: string;
  /** Wrap the spinner in a centered, padded block. */
  center?: boolean;
}

/** A rotating ring for indeterminate loading states. */
export const Spinner = ({
  size = "md",
  label = "Loading…",
  center = false,
  ...props
}: SpinnerProps) => {
  const spinner = (
    <StyledSpinner
      $size={size}
      role="status"
      aria-live="polite"
      aria-label={label}
      {...props}
    />
  );

  return center ? <StyledCenter>{spinner}</StyledCenter> : spinner;
};
