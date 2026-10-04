import styled from "styled-components";

export const StyledSealRow = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.6rem;
`;

export const StyledSealPill = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.2rem 0.8rem;
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  background-color: ${({ theme }) => theme.colors.concrete[200]};
  color: ${({ theme }) => theme.colors.navy[600]};
  font-size: 1.2rem;
  font-weight: 700;

  svg {
    font-size: 1.4em;
  }
`;

export const StyledTamperedNote = styled.p`
  margin: 0;
  max-width: 24rem;
  text-align: right;
  font-size: 1.2rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.red[600]};
`;
