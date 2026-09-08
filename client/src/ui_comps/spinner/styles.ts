import styled, { css, keyframes } from "styled-components";

export type SpinnerSize = "sm" | "md" | "lg";

const sizeStyles: Record<SpinnerSize, ReturnType<typeof css>> = {
  sm: css`
    width: 1.6rem;
    height: 1.6rem;
    border-width: 0.2rem;
  `,
  md: css`
    width: 2.4rem;
    height: 2.4rem;
    border-width: 0.3rem;
  `,
  lg: css`
    width: 4rem;
    height: 4rem;
    border-width: 0.4rem;
  `,
};

const spin = keyframes`
  to {
    transform: rotate(360deg);
  }
`;

export const StyledSpinner = styled.span<{ $size: SpinnerSize }>`
  display: inline-block;
  border-style: solid;
  border-radius: 50%;
  border-color: ${({ theme }) => theme.colors.concrete[600]};
  border-top-color: ${({ theme }) => theme.colors.orange[500]};
  animation: ${spin} 0.7s linear infinite;

  ${({ $size }) => sizeStyles[$size]}

  @media (prefers-reduced-motion: reduce) {
    animation-duration: 2s;
  }
`;

export const StyledCenter = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2.4rem;
`;
