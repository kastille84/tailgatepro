import { HiArrowPath } from "react-icons/hi2";

import { StyledButton, StyledIcon, StyledSpinner } from "./styles";
import type { ButtonVariant, ButtonSize } from "./styles";
import type { ComponentPropsWithoutRef, ReactNode, Ref } from "react";

interface ButtonProps extends ComponentPropsWithoutRef<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  ref?: Ref<HTMLButtonElement>;
}

export const Button = ({
  variant = "primary",
  size = "md",
  fullWidth = false,
  loading = false,
  leftIcon,
  rightIcon,
  type = "button",
  disabled,
  children,
  ref,
  ...props
}: ButtonProps) => (
  <StyledButton
    ref={ref}
    type={type}
    $variant={variant}
    $size={size}
    $fullWidth={fullWidth}
    disabled={disabled || loading}
    aria-busy={loading || undefined}
    {...props}
  >
    {loading && (
      <StyledSpinner aria-hidden="true">
        <HiArrowPath />
      </StyledSpinner>
    )}
    {!loading && leftIcon && <StyledIcon aria-hidden="true">{leftIcon}</StyledIcon>}
    {children}
    {!loading && rightIcon && <StyledIcon aria-hidden="true">{rightIcon}</StyledIcon>}
  </StyledButton>
);
