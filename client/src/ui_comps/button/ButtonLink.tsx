import { Link } from "react-router-dom";

import { StyledButton } from "./styles";
import type { ButtonVariant, ButtonSize } from "./styles";
import type { ComponentPropsWithoutRef } from "react";

interface ButtonLinkProps
  extends Omit<ComponentPropsWithoutRef<"a">, "href"> {
  /** Router path. Omit and pass `href` for an in-page anchor or external URL. */
  to?: string;
  href?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

/** A link that looks like a Button — one tab stop, no <button> nested in <a>. */
export const ButtonLink = ({
  to,
  href,
  variant = "primary",
  size = "md",
  fullWidth = false,
  children,
  ...props
}: ButtonLinkProps) => (
  <StyledButton
    as={to ? Link : "a"}
    {...(to ? { to } : { href })}
    $variant={variant}
    $size={size}
    $fullWidth={fullWidth}
    {...props}
  >
    {children}
  </StyledButton>
);
