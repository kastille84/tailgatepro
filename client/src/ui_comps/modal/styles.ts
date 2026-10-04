import styled, { keyframes } from "styled-components";

export type ModalSize = "sm" | "md" | "lg";

const sizeMaxWidth: Record<ModalSize, string> = {
  sm: "40rem",
  md: "56rem",
  lg: "76rem",
};

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const slideUp = keyframes`
  from { opacity: 0; transform: translateY(1.6rem); }
  to { opacity: 1; transform: translateY(0); }
`;

export const StyledOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 1.6rem;
  background-color: rgba(15, 25, 34, 0.55);
  animation: ${fadeIn} 0.15s ease;

  @media (min-width: ${({ theme }) => theme.breakpoints.sm}) {
    align-items: center;
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

export const StyledPanel = styled.div<{ $size: ModalSize }>`
  width: 100%;
  max-width: ${({ $size }) => sizeMaxWidth[$size]};
  max-height: calc(100dvh - 3.2rem);
  overflow-y: auto;
  background-color: ${({ theme }) => theme.colors.concrete[100]};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  box-shadow: ${({ theme }) => theme.shadows.lg};
  animation: ${slideUp} 0.18s ease;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

export const StyledHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.6rem;
  padding: 2rem 2rem 1.2rem;
`;

export const StyledTitle = styled.h2`
  margin: 0;
  font-size: 2rem;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.navy[700]};
`;

export const StyledClose = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 4.8rem;
  height: 4.8rem;
  margin: -1.2rem -1.2rem -1.2rem 0;
  border: 0;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background-color: transparent;
  color: ${({ theme }) => theme.colors.navy[500]};
  font-size: 2.2rem;
  cursor: pointer;
  transition: background-color 0.15s ease;

  &:hover {
    background-color: ${({ theme }) => theme.colors.concrete[500]};
  }

  &:focus-visible {
    outline: 0.2rem solid ${({ theme }) => theme.colors.navy[700]};
    outline-offset: 0.2rem;
  }
`;

export const StyledBody = styled.div`
  padding: 0 2rem 2rem;
`;
