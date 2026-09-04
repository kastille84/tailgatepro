import styled from "styled-components";

export const StyledGroup = styled.div`
  display: inline-flex;
  gap: 0.4rem;
  padding: 0.4rem;
  background-color: ${({ theme }) => theme.colors.concrete[500]};
  border: 0.1rem solid ${({ theme }) => theme.colors.concrete[600]};
  border-radius: ${({ theme }) => theme.borderRadius.md};
`;

export const StyledOption = styled.button<{ $active: boolean }>`
  min-height: 4.8rem;
  padding: 0 1.8rem;
  border: 0;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  font-family: inherit;
  font-size: 1.4rem;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  transition:
    background-color 0.15s ease,
    color 0.15s ease,
    box-shadow 0.15s ease;

  background-color: ${({ theme, $active }) =>
    $active ? theme.colors.concrete[100] : "transparent"};
  color: ${({ theme, $active }) =>
    $active ? theme.colors.navy[700] : theme.colors.navy[400]};
  box-shadow: ${({ theme, $active }) => ($active ? theme.shadows.sm : "none")};

  &:hover {
    color: ${({ theme }) => theme.colors.navy[700]};
  }

  &:focus-visible {
    outline: 0.2rem solid ${({ theme }) => theme.colors.orange[500]};
    outline-offset: 0.2rem;
  }
`;
