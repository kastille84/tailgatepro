import styled from "styled-components";

export const StyledStepsMedia = styled.div`
  max-width: 72rem;
  margin: 0 auto 3.2rem;

  @media (min-width: ${({ theme }) => theme.breakpoints.md}) {
    margin-bottom: 4rem;
  }
`;

export const StyledSteps = styled.ol`
  list-style: none;
  margin: 0 auto;
  padding: 0;
  max-width: 96rem;
  display: grid;
  grid-template-columns: 1fr;
  gap: 2rem;

  @media (min-width: ${({ theme }) => theme.breakpoints.md}) {
    grid-template-columns: repeat(3, 1fr);
  }
`;

export const StyledStep = styled.li`
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  padding: 2.4rem;
  background-color: ${({ theme }) => theme.colors.concrete[100]};
  border: 0.1rem solid ${({ theme }) => theme.colors.concrete[600]};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  box-shadow: ${({ theme }) => theme.shadows.sm};
`;

export const StyledStepTop = styled.div`
  display: flex;
  align-items: center;
  gap: 1.2rem;
`;

export const StyledStepNumber = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 4rem;
  height: 4rem;
  border-radius: 999rem;
  background-color: ${({ theme }) => theme.colors.orange[100]};
  color: ${({ theme }) => theme.colors.orange[700]};
  font-size: 1.8rem;
  font-weight: 800;
`;

export const StyledStepIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 4.8rem;
  height: 4.8rem;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background-color: ${({ theme }) => theme.colors.orange[100]};
  color: ${({ theme }) => theme.colors.orange[600]};
  font-size: 2.6rem;
`;

export const StyledStepTitle = styled.h3`
  margin: 0;
  font-size: 1.8rem;
  line-height: 1.3;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.navy[700]};
`;

export const StyledStepText = styled.p`
  margin: 0;
  font-size: 1.5rem;
  line-height: 1.55;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.navy[500]};
`;

export const StyledStepsFootnote = styled.p`
  max-width: 60rem;
  margin: 3.2rem auto 0;
  text-align: center;
  font-size: 1.5rem;
  line-height: 1.6;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.navy[600]};
`;
