import styled from "styled-components";

export const StyledPage = styled.main`
  display: flex;
  flex-direction: column;
  width: 100%;
  overflow-x: hidden;
`;

export const StyledHero = styled.section`
  padding: 4.8rem 1.6rem 5.6rem;
  text-align: center;
  background: linear-gradient(
    160deg,
    ${({ theme }) => theme.colors.navy[500]} 0%,
    ${({ theme }) => theme.colors.navy[700]} 100%
  );
  color: ${({ theme }) => theme.colors.concrete[100]};

  @media (min-width: ${({ theme }) => theme.breakpoints.md}) {
    padding: 6.4rem 2.4rem 7.2rem;
  }
`;

export const StyledHeroInner = styled.div`
  max-width: 60rem;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.6rem;
`;

export const StyledEyebrow = styled.p`
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 1.3rem;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.orange[400]};
`;

export const StyledHeadline = styled.h1`
  margin: 0;
  font-size: clamp(2.8rem, 5vw, 3.8rem);
  line-height: 1.1;
  font-weight: 800;
  letter-spacing: -0.01em;
`;

export const StyledLede = styled.p`
  margin: 0;
  font-size: 1.6rem;
  line-height: 1.6;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.navy[200]};

  strong {
    color: ${({ theme }) => theme.colors.concrete[100]};
  }
`;

export const StyledSection = styled.section`
  padding: 5.6rem 1.6rem;
  background-color: ${({ theme }) => theme.colors.concrete[200]};
  color: ${({ theme }) => theme.colors.navy[600]};
`;

export const StyledContainer = styled.div`
  width: 100%;
  max-width: 80rem;
  margin: 0 auto;
  text-align: center;
`;

export const StyledPlaceholder = styled.p`
  margin: 0;
  font-size: 1.6rem;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.navy[400]};
`;

export const StyledStatus = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 40vh;
  padding: 4.8rem 1.6rem;
  font-size: 1.5rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.navy[400]};
`;
