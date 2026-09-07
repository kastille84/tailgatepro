import styled from "styled-components";
import { Link } from "react-router-dom";
import { pageContentGrow } from "../../styles/layout";
import { PageShell } from "../../ui_comps/page-shell";

export const StyledPage = PageShell;

export const StyledHero = styled.section`
  ${pageContentGrow}
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
  max-width: 44rem;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 2rem;
  text-align: left;
`;

export const StyledEyebrow = styled.p`
  margin: 0;
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 1.3rem;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.orange[400]};
`;

export const StyledHeadline = styled.h1`
  margin: 0;
  text-align: center;
  font-size: clamp(2.6rem, 5vw, 3.6rem);
  line-height: 1.1;
  font-weight: 800;
  letter-spacing: -0.01em;
`;

export const StyledLede = styled.p`
  margin: 0;
  text-align: center;
  font-size: 1.6rem;
  line-height: 1.6;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.navy[200]};
`;

export const StyledLinkRow = styled.div`
  display: flex;
  justify-content: center;
  font-size: 1.4rem;
  font-weight: 600;
`;

export const StyledLink = styled(Link)`
  color: ${({ theme }) => theme.colors.orange[400]};
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;

export const StyledSuccess = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 1.2rem;
  padding: 2rem;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background-color: rgba(255, 255, 255, 0.08);
  color: ${({ theme }) => theme.colors.concrete[100]};
  font-size: 1.5rem;
  line-height: 1.5;
  font-weight: 500;

  svg {
    flex-shrink: 0;
    margin-top: 0.1rem;
    font-size: 2.2rem;
    color: ${({ theme }) => theme.colors.green[500]};
  }
`;
