import React, { useState } from "react";
import { HiEye, HiEyeSlash } from "react-icons/hi2";

import {
  StyledPasswordInput,
  StyledToggleButton,
  StyledWrapper,
} from "./styles";

interface PasswordInputProps extends React.ComponentPropsWithoutRef<"input"> {
  hasError?: boolean;
  ref?: React.Ref<HTMLInputElement>;
  /** Reveal the password as plain text on first render. */
  defaultVisible?: boolean;
  /** Render the show/hide eye button. */
  showToggle?: boolean;
}

/**
 * A password field with an optional eye toggle. All remaining props (including
 * the `id` / `hasError` / `aria-*` that `FormField` injects and the
 * `name` / `onChange` / `onBlur` / `ref` from react-hook-form's `register`)
 * are forwarded to the underlying `<input>`.
 */
export const PasswordInput = ({
  hasError = false,
  ref,
  defaultVisible = false,
  showToggle = true,
  ...props
}: PasswordInputProps) => {
  const [visible, setVisible] = useState(defaultVisible);

  return (
    <StyledWrapper>
      <StyledPasswordInput
        ref={ref}
        type={visible ? "text" : "password"}
        hasError={hasError}
        $hasToggle={showToggle}
        {...props}
      />
      {showToggle && (
        <StyledToggleButton
          type="button"
          onClick={() => setVisible((prev) => !prev)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
        >
          {visible ? (
            <HiEyeSlash aria-hidden="true" />
          ) : (
            <HiEye aria-hidden="true" />
          )}
        </StyledToggleButton>
      )}
    </StyledWrapper>
  );
};
