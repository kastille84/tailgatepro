import styled from "styled-components";

export const StyledGuide = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.6rem;
`;

export const StyledGuideHead = styled.div`
  display: flex;
  align-items: center;
  gap: 1.2rem;
`;

export const StyledGlyph = styled.span`
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 4rem;
  height: 4rem;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background-color: ${({ theme }) => theme.colors.orange[100]};
  color: ${({ theme }) => theme.colors.orange[600]};

  svg {
    width: 2.2rem;
    height: 2.2rem;
  }
`;

export const StyledHeading = styled.h3`
  margin: 0;
  font-size: 1.7rem;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.navy[700]};
`;

export const StyledSteps = styled.ol`
  margin: 0;
  padding-left: 2.2rem;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  font-size: 1.5rem;
  line-height: 1.5;
  color: ${({ theme }) => theme.colors.navy[600]};
`;

export const StyledNote = styled.p`
  margin: 0;
  font-size: 1.35rem;
  line-height: 1.5;
  color: ${({ theme }) => theme.colors.navy[400]};
`;
