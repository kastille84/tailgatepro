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
    $active ? theme.colors.orange[500] : "transparent"};
  color: ${({ theme, $active }) =>
    $active ? theme.colors.concrete[100] : theme.colors.navy[600]};
  box-shadow: ${({ theme, $active }) => ($active ? theme.shadows.md : "none")};

  &:hover {
    background-color: ${({ theme, $active }) =>
      $active ? theme.colors.orange[600] : "transparent"};
    color: ${({ theme, $active }) =>
      $active ? theme.colors.concrete[100] : theme.colors.navy[700]};
  }

  &:focus-visible {
    outline: 0.2rem solid ${({ theme }) => theme.colors.navy[700]};
    outline-offset: 0.2rem;
  }
`;
