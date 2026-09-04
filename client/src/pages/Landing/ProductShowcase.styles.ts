import styled from "styled-components";

export const StyledShowcase = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 2.4rem;
  align-items: start;
  justify-items: center;

  @media (min-width: ${({ theme }) => theme.breakpoints.sm}) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (min-width: ${({ theme }) => theme.breakpoints.lg}) {
    grid-template-columns: repeat(4, 1fr);
  }
`;

export const StyledShowcaseItem = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.2rem;
`;

export const StyledCaption = styled.p`
  margin: 0;
  text-align: center;
  font-size: 1.4rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.concrete[400]};
`;
