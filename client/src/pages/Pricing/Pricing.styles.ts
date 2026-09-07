import styled from "styled-components";
import { PageShell } from "../../ui_comps/page-shell";

/* ---------- page + section scaffolding ---------- */

export const StyledPage = PageShell;

export const StyledSection = styled.section`
  padding: 5.6rem 1.6rem;
  background-color: ${({ theme }) => theme.colors.concrete[200]};
  color: ${({ theme }) => theme.colors.navy[600]};

  @media (min-width: ${({ theme }) => theme.breakpoints.md}) {
    padding: 8rem 2.4rem;
  }

  @media (min-width: ${({ theme }) => theme.breakpoints.lg}) {
    padding: 9.6rem 3.2rem;
  }
`;

export const StyledContainer = styled.div`
  width: 100%;
  max-width: 120rem;
  margin: 0 auto;
`;

/* ---------- hero ---------- */

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

  @media (min-width: ${({ theme }) => theme.breakpoints.lg}) {
    padding: 8rem 3.2rem 8.8rem;
  }
`;

export const StyledHeroInner = styled.div`
  max-width: 76rem;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 2rem;
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
  font-size: clamp(3rem, 5.5vw, 4.6rem);
  line-height: 1.1;
  font-weight: 800;
  letter-spacing: -0.01em;

  span {
    color: ${({ theme }) => theme.colors.orange[400]};
  }
`;

export const StyledLede = styled.p`
  margin: 0;
  font-size: clamp(1.5rem, 2vw, 1.8rem);
  line-height: 1.6;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.navy[200]};
`;

/* ---------- audience + billing controls ---------- */

export const StyledControls = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 1.6rem 2.4rem;
  margin-bottom: 4rem;

  @media (min-width: ${({ theme }) => theme.breakpoints.md}) {
    margin-bottom: 5.6rem;
  }
`;

export const StyledSaveHint = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 0.4rem 1rem;
  border-radius: 999rem;
  background-color: ${({ theme }) => theme.colors.green[50]};
  color: ${({ theme }) => theme.colors.green[800]};
  font-size: 1.2rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;

export const StyledSelectedNote = styled.p`
  margin: 0;
  font-size: 1.4rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.navy[200]};

  strong {
    color: ${({ theme }) => theme.colors.orange[400]};
    font-weight: 800;
  }
`;

/* ---------- plan cards ---------- */

export const StyledPlanGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 2.4rem;
  align-items: stretch;

  @media (min-width: ${({ theme }) => theme.breakpoints.lg}) {
    grid-template-columns: repeat(3, 1fr);
    gap: 2rem;
  }
`;

export const StyledPlanCard = styled.article<{ $featured?: boolean }>`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 1.6rem;
  height: 100%;
  padding: 3.2rem 2.4rem;
  background-color: ${({ theme }) => theme.colors.concrete[100]};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  border: ${({ theme, $featured }) =>
    $featured
      ? `0.2rem solid ${theme.colors.orange[500]}`
      : `0.1rem solid ${theme.colors.concrete[600]}`};
  box-shadow: ${({ theme, $featured }) =>
    $featured ? theme.shadows.lg : theme.shadows.sm};

  @media (min-width: ${({ theme }) => theme.breakpoints.lg}) {
    transform: ${({ $featured }) =>
      $featured ? "translateY(-1.2rem)" : "none"};
  }
`;

export const StyledBadge = styled.span`
  position: absolute;
  top: 0;
  left: 50%;
  transform: translate(-50%, -50%);
  padding: 0.5rem 1.4rem;
  border-radius: 999rem;
  background-color: ${({ theme }) => theme.colors.orange[500]};
  color: ${({ theme }) => theme.colors.concrete[100]};
  font-size: 1.1rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  white-space: nowrap;
`;

export const StyledPlanName = styled.h2`
  margin: 0;
  font-size: 2rem;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.navy[700]};
`;

export const StyledPlanTarget = styled.p`
  margin: 0;
  font-size: 1.4rem;
  font-weight: 500;
  line-height: 1.5;
  color: ${({ theme }) => theme.colors.navy[400]};
`;

export const StyledPriceRow = styled.div`
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.6rem;
  padding-top: 0.4rem;
`;

export const StyledPrice = styled.span`
  font-size: clamp(3.2rem, 5vw, 4rem);
  font-weight: 800;
  line-height: 1;
  color: ${({ theme }) => theme.colors.navy[700]};
`;

export const StyledPriceCadence = styled.span`
  font-size: 1.5rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.navy[400]};
`;

export const StyledPriceSub = styled.p`
  margin: 0;
  font-size: 1.3rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.green[700]};
  min-height: 1.6rem;
`;

export const StyledFeatureList = styled.ul`
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
  margin: 0.4rem 0 0;
  padding: 0;
`;

export const StyledFeatureItem = styled.li`
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  font-size: 1.45rem;
  line-height: 1.5;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.navy[600]};

  svg {
    flex-shrink: 0;
    margin-top: 0.2rem;
    font-size: 1.8rem;
    color: ${({ theme }) => theme.colors.green[600]};
  }
`;

export const StyledPlanCta = styled.a<{ $featured?: boolean }>`
  margin-top: auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 4.8rem;
  padding: 0 2rem;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  border: 0.2rem solid
    ${({ theme, $featured }) =>
      $featured ? theme.colors.orange[500] : theme.colors.navy[200]};
  background-color: ${({ theme, $featured }) =>
    $featured ? theme.colors.orange[500] : "transparent"};
  color: ${({ theme, $featured }) =>
    $featured ? theme.colors.concrete[100] : theme.colors.navy[700]};
  font-size: 1.5rem;
  font-weight: 700;
  text-decoration: none;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease;

  &:hover {
    background-color: ${({ theme, $featured }) =>
      $featured ? theme.colors.orange[600] : theme.colors.concrete[200]};
    border-color: ${({ theme, $featured }) =>
      $featured ? theme.colors.orange[600] : theme.colors.navy[400]};
  }

  &:focus-visible {
    outline: 0.2rem solid ${({ theme }) => theme.colors.orange[500]};
    outline-offset: 0.2rem;
  }
`;

/* ---------- zero seat-tax callout ---------- */

export const StyledCallout = styled.div`
  max-width: 88rem;
  margin: 4.8rem auto 0;
  display: grid;
  gap: 1.2rem;
  padding: 3.2rem 2.4rem;
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  background: linear-gradient(
    160deg,
    ${({ theme }) => theme.colors.navy[500]} 0%,
    ${({ theme }) => theme.colors.navy[700]} 100%
  );
  color: ${({ theme }) => theme.colors.concrete[100]};

  @media (min-width: ${({ theme }) => theme.breakpoints.md}) {
    padding: 4rem 3.6rem;
  }
`;

export const StyledCalloutTitle = styled.h3`
  margin: 0;
  font-size: 1.9rem;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.orange[400]};
`;

export const StyledCalloutText = styled.p`
  margin: 0;
  font-size: 1.55rem;
  line-height: 1.65;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.navy[200]};

  strong {
    color: ${({ theme }) => theme.colors.concrete[100]};
    font-weight: 700;
  }
`;

/* ---------- section heading ---------- */

export const StyledSectionHead = styled.div`
  text-align: center;
  max-width: 60rem;
  margin: 0 auto 4rem;
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
`;

export const StyledSectionTitle = styled.h2`
  margin: 0;
  font-size: clamp(2.4rem, 4vw, 3.2rem);
  line-height: 1.15;
  font-weight: 800;
  letter-spacing: -0.01em;
`;

export const StyledSectionLede = styled.p`
  margin: 0;
  font-size: clamp(1.5rem, 2vw, 1.7rem);
  line-height: 1.6;
  font-weight: 500;
  opacity: 0.85;
`;

/* ---------- FAQ ---------- */

export const StyledFaq = styled.div`
  max-width: 80rem;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
`;

export const StyledFaqItem = styled.details`
  border: 0.1rem solid ${({ theme }) => theme.colors.concrete[600]};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background-color: ${({ theme }) => theme.colors.concrete[100]};
  padding: 1.6rem 2rem;
`;

export const StyledFaqQuestion = styled.summary`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.2rem;
  cursor: pointer;
  list-style: none;
  font-size: 1.6rem;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.navy[700]};

  &::-webkit-details-marker {
    display: none;
  }

  &::after {
    content: "+";
    color: ${({ theme }) => theme.colors.orange[500]};
    font-size: 2.2rem;
    line-height: 1;
    font-weight: 700;
  }

  details[open] > &::after {
    content: "\\2212";
  }
`;

export const StyledFaqAnswer = styled.p`
  margin: 1.2rem 0 0;
  font-size: 1.5rem;
  line-height: 1.65;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.navy[500]};
`;

/* ---------- closing waitlist CTA ---------- */

export const StyledCtaSection = styled.section`
  scroll-margin-top: 8rem;
  padding: 5.6rem 1.6rem;
  background: linear-gradient(
    160deg,
    ${({ theme }) => theme.colors.navy[500]} 0%,
    ${({ theme }) => theme.colors.navy[700]} 100%
  );
  color: ${({ theme }) => theme.colors.concrete[100]};

  @media (min-width: ${({ theme }) => theme.breakpoints.md}) {
    padding: 8rem 2.4rem;
  }
`;

export const StyledCtaInner = styled.div`
  width: 100%;
  max-width: 56rem;
  margin: 0 auto;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 1.6rem;
`;
