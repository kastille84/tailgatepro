import styled from "styled-components";

export const StyledWrapper = styled.label<{ $disabled?: boolean }>`
  display: flex;
  align-items: center;
  gap: 1.2rem;
  /* keep the whole row a comfortable gloved-tap target */
  min-height: 4.8rem;
  padding: 0.6rem 0;
  cursor: ${({ $disabled }) => ($disabled ? "not-allowed" : "pointer")};
  opacity: ${({ $disabled }) => ($disabled ? 0.6 : 1)};
`;

export const StyledCheckbox = styled.input<{ $hasError?: boolean }>`
  flex-shrink: 0;
  width: 2.4rem;
  height: 2.4rem;
  margin-top: 0.2rem;
  accent-color: ${({ theme }) => theme.colors.orange[500]};
  border: 0.1rem solid
    ${({ theme, $hasError }) =>
      $hasError ? theme.colors.red[500] : theme.colors.navy[200]};
  cursor: inherit;

  &:focus-visible {
    outline: 0.2rem solid ${({ theme }) => theme.colors.navy[700]};
    outline-offset: 0.2rem;
  }
`;

export const StyledLabelText = styled.span`
  /* 16px to match inputs and avoid iOS zoom parity issues */
  font-size: 1.6rem;
  font-weight: 600;
  line-height: 1.4;
  color: ${({ theme }) => theme.colors.navy[600]};
`;
