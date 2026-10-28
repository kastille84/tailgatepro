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

// Opens the public /verify/:id page, where a PDF (e.g. one forwarded by email)
// can be checked against the original. 48px min tap height per field UX.
export const StyledCheckFileLink = styled.a`
  display: inline-flex;
  align-items: center;
  min-height: 4.8rem;
  font-size: 1.3rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.navy[600]};
  text-decoration: underline;
`;
