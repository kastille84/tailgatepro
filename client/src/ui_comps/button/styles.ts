import styled, { css, keyframes } from "styled-components";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "success"
  | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "xlg";

interface StyledButtonProps {
  $variant: ButtonVariant;
  $size: ButtonSize;
  $fullWidth?: boolean;
}

/* Every size keeps a >= 4.8rem (48px) min-height so gloved taps on a job site
   always land. Smaller sizes only trim padding and text, never the hit area. */
const sizeStyles: Record<ButtonSize, ReturnType<typeof css>> = {
  sm: css`
    min-height: 4.8rem;
    padding: 0 1.4rem;
    font-size: 1.4rem;
  `,
  md: css`
    min-height: 4.8rem;
    padding: 0 1.8rem;
    font-size: 1.5rem;
  `,
  lg: css`
    min-height: 5.6rem;
    padding: 0 2.4rem;
    font-size: 1.6rem;
  `,
  xlg: css`
    min-height: 6.4rem;
    padding: 0 3rem;
    font-size: 1.8rem;
  `,
};

const variantStyles: Record<ButtonVariant, ReturnType<typeof css>> = {
  primary: css`
    background-color: ${({ theme }) => theme.colors.orange[500]};
    border-color: ${({ theme }) => theme.colors.orange[500]};
    color: ${({ theme }) => theme.colors.concrete[100]};

    &:hover:not(:disabled) {
      background-color: ${({ theme }) => theme.colors.orange[600]};
      border-color: ${({ theme }) => theme.colors.orange[600]};
    }

    &:active:not(:disabled) {
      background-color: ${({ theme }) => theme.colors.orange[700]};
      border-color: ${({ theme }) => theme.colors.orange[700]};
    }

    &:focus-visible {
      box-shadow: 0 0 0 0.3rem ${({ theme }) => theme.colors.orange[200]};
    }
  `,
  secondary: css`
    background-color: ${({ theme }) => theme.colors.navy[500]};
    border-color: ${({ theme }) => theme.colors.navy[500]};
    color: ${({ theme }) => theme.colors.concrete[100]};

    &:hover:not(:disabled) {
      background-color: ${({ theme }) => theme.colors.navy[600]};
      border-color: ${({ theme }) => theme.colors.navy[600]};
    }

    &:active:not(:disabled) {
      background-color: ${({ theme }) => theme.colors.navy[700]};
      border-color: ${({ theme }) => theme.colors.navy[700]};
    }

    &:focus-visible {
      box-shadow: 0 0 0 0.3rem ${({ theme }) => theme.colors.navy[200]};
    }
  `,
  outline: css`
    background-color: transparent;
    border-color: ${({ theme }) => theme.colors.orange[500]};
    color: ${({ theme }) => theme.colors.orange[600]};

    &:hover:not(:disabled) {
      background-color: ${({ theme }) => theme.colors.orange[100]};
    }

    &:active:not(:disabled) {
      background-color: ${({ theme }) => theme.colors.orange[200]};
    }

    &:focus-visible {
      box-shadow: 0 0 0 0.3rem ${({ theme }) => theme.colors.orange[200]};
    }
  `,
  success: css`
    background-color: ${({ theme }) => theme.colors.green[600]};
    border-color: ${({ theme }) => theme.colors.green[600]};
    color: ${({ theme }) => theme.colors.concrete[100]};

    &:hover:not(:disabled) {
      background-color: ${({ theme }) => theme.colors.green[700]};
      border-color: ${({ theme }) => theme.colors.green[700]};
    }

    &:active:not(:disabled) {
      background-color: ${({ theme }) => theme.colors.green[800]};
      border-color: ${({ theme }) => theme.colors.green[800]};
    }

    &:focus-visible {
      box-shadow: 0 0 0 0.3rem ${({ theme }) => theme.colors.green[100]};
    }
  `,
  danger: css`
    background-color: ${({ theme }) => theme.colors.red[500]};
    border-color: ${({ theme }) => theme.colors.red[500]};
    color: ${({ theme }) => theme.colors.concrete[100]};

    &:hover:not(:disabled) {
      background-color: ${({ theme }) => theme.colors.red[600]};
      border-color: ${({ theme }) => theme.colors.red[600]};
    }

    &:active:not(:disabled) {
      background-color: ${({ theme }) => theme.colors.red[700]};
      border-color: ${({ theme }) => theme.colors.red[700]};
    }

    &:focus-visible {
      box-shadow: 0 0 0 0.3rem ${({ theme }) => theme.colors.red[200]};
    }
  `,
};

export const StyledButton = styled.button<StyledButtonProps>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.8rem;
  width: ${({ $fullWidth }) => ($fullWidth ? "100%" : "auto")};
  font-family: inherit;
  font-weight: 700;
  line-height: 1.2;
  white-space: nowrap;
  border: 0.2rem solid transparent;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  cursor: pointer;
  text-decoration: none;
  user-select: none;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease,
    box-shadow 0.15s ease,
    transform 0.15s ease;

  ${({ $size }) => sizeStyles[$size]}
  ${({ $variant }) => variantStyles[$variant]}

  &:focus-visible {
    outline: none;
  }

  &:active:not(:disabled) {
    transform: translateY(0.1rem);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
`;

const spin = keyframes`
  to {
    transform: rotate(360deg);
  }
`;

export const StyledIcon = styled.span`
  display: inline-flex;
  align-items: center;
  /* scales with the button's font-size */
  font-size: 1.2em;
`;

export const StyledSpinner = styled(StyledIcon)`
  animation: ${spin} 0.7s linear infinite;
`;
