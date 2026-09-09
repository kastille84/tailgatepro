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
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.6rem;
  padding: 2.4rem;
`;

export const StyledMessage = styled.span`
  display: block;
  text-align: center;
  font-size: 1.5rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.navy[400]};
`;

const fadeIn = keyframes`
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
`;

export const StyledFullScreen = styled.div`
  position: fixed;
  inset: 0;
  /* above the navbar and modal overlay, which sit at z-index 1000 */
  z-index: 1100;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.6rem;
  padding: 2.4rem;
  /* near-opaque light scrim: high contrast for bright job-site sun */
  background-color: rgba(255, 255, 255, 0.9);
  animation: ${fadeIn} 0.15s ease;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;
