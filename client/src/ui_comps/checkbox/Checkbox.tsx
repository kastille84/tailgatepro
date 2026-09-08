import type { ComponentPropsWithoutRef, ReactNode, Ref } from "react";

import { StyledCheckbox, StyledLabelText, StyledWrapper } from "./styles";

interface CheckboxProps
  extends Omit<ComponentPropsWithoutRef<"input">, "type"> {
  /** Visible label sitting beside the box. */
  label: ReactNode;
  hasError?: boolean;
  ref?: Ref<HTMLInputElement>;
}

/**
 * A labelled checkbox with a full-row tap target. All remaining props (the
 * `name` / `onChange` / `onBlur` / `ref` from react-hook-form's `register`,
 * plus `aria-*`) are forwarded to the underlying `<input type="checkbox">`.
 */
export const Checkbox = ({
  label,
  hasError = false,
  disabled,
  className,
  ref,
  ...props
}: CheckboxProps) => (
  <StyledWrapper $disabled={disabled} className={className}>
    <StyledCheckbox
      ref={ref}
      type="checkbox"
      $hasError={hasError}
      aria-invalid={hasError || undefined}
      disabled={disabled}
      {...props}
    />
    <StyledLabelText>{label}</StyledLabelText>
  </StyledWrapper>
);
