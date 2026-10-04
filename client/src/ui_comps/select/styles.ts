import styled from "styled-components";

export const StyledWrapper = styled.div`
  position: relative;
  width: 100%;
`;

export const StyledSelect = styled.select<{ $hasError?: boolean }>`
  width: 100%;
  /* 16px min to stop iOS auto-zoom; 4.8rem min-height for gloved taps */
  min-height: 4.8rem;
  padding: 1.2rem 4rem 1.2rem 1.4rem;
  border: 0.1rem solid
    ${({ theme, $hasError }) =>
      $hasError ? theme.colors.red[500] : theme.colors.navy[200]};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background-color: ${({ theme }) => theme.colors.concrete[100]};
  color: ${({ theme }) => theme.colors.navy[700]};
  font-family: inherit;
  font-size: 1.6rem;
  line-height: 1.5;
  cursor: pointer;
  appearance: none;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;

  &:focus {
    outline: none;
    border-color: ${({ theme, $hasError }) =>
      $hasError ? theme.colors.red[500] : theme.colors.green[500]};
    box-shadow: 0 0 0 0.3rem
      ${({ $hasError }) =>
        $hasError ? "rgba(211, 47, 47, 0.15)" : "rgba(85, 161, 102, 0.15)"};
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.65;
    background-color: ${({ theme }) => theme.colors.concrete[400]};
  }
`;

export const StyledChevron = styled.span`
  position: absolute;
  top: 50%;
  right: 1.4rem;
  display: flex;
  transform: translateY(-50%);
  pointer-events: none;
  color: ${({ theme }) => theme.colors.navy[400]};
  font-size: 1.8rem;
`;
