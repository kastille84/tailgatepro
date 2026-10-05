import styled from "styled-components";
import { pageContentGrow } from "../../styles/layout";
import { PageShell } from "../../ui_comps/page-shell";

export const StyledPage = PageShell;

export const StyledHero = styled.header`
  padding: 4.8rem 1.6rem 4rem;
  text-align: center;
  background: linear-gradient(
    160deg,
    ${({ theme }) => theme.colors.navy[500]} 0%,
    ${({ theme }) => theme.colors.navy[700]} 100%
  );
  color: ${({ theme }) => theme.colors.concrete[100]};

  @media (min-width: ${({ theme }) => theme.breakpoints.md}) {
    padding: 6.4rem 2.4rem 5.6rem;
  }
`;

export const StyledEyebrow = styled.p`
  margin: 0 0 1.2rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 1.3rem;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.orange[400]};
`;

export const StyledHeadline = styled.h1`
  margin: 0;
  font-size: clamp(2.6rem, 5vw, 3.6rem);
  line-height: 1.1;
  font-weight: 800;
  letter-spacing: -0.01em;
`;

export const StyledUpdated = styled.p`
  margin: 1.2rem 0 0;
  font-size: 1.4rem;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.navy[200]};
`;

export const StyledContent = styled.article`
  ${pageContentGrow}
  width: 100%;
  max-width: 78rem;
  margin: 0 auto;
  padding: 3.2rem 1.6rem 4.8rem;
  color: ${({ theme }) => theme.colors.navy[700]};
  font-size: 1.6rem;
  line-height: 1.7;

  @media (min-width: ${({ theme }) => theme.breakpoints.md}) {
    padding: 4.8rem 2.4rem 6.4rem;
  }

  p,
  ul {
    margin: 0 0 1.6rem;
  }

  ul {
    padding-left: 2.4rem;
  }

  li {
    margin-bottom: 0.8rem;
  }

  a {
    color: ${({ theme }) => theme.colors.navy[500]};
    font-weight: 600;
  }
`;

export const StyledSection = styled.section`
  margin-bottom: 3.2rem;
`;

export const StyledSectionHeading = styled.h2`
  margin: 0 0 1.2rem;
  font-size: 2.2rem;
  line-height: 1.25;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.navy[800]};
`;
