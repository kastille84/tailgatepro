import styled, { css } from "styled-components";
import { PageShell } from "../../ui_comps/page-shell";

/* ---------- page + section layout ----------
   Shared section scaffold (StyledSection + $tone, StyledContainer,
   StyledSectionHead/Title/Lede) is imported by every Landing sub-section
   (HowItWorks, ProductShowcase, GcSection, ComparisonTable, LandingFaq) and by
   PricingTeaser. Follow-up: promote Section($tone) / Container / SectionHead /
   Callout / FaqAccordion into ui_comps/ and refactor Landing + Pricing onto them. */

export const StyledPage = PageShell;

type SectionTone = "dark" | "light" | "muted";

const sectionTone: Record<SectionTone, ReturnType<typeof css>> = {
  dark: css`
    background: linear-gradient(
      160deg,
      ${({ theme }) => theme.colors.navy[500]} 0%,
      ${({ theme }) => theme.colors.navy[700]} 100%
    );
    color: ${({ theme }) => theme.colors.concrete[100]};
  `,
  light: css`
    background-color: ${({ theme }) => theme.colors.concrete[100]};
    color: ${({ theme }) => theme.colors.navy[600]};
  `,
  muted: css`
    background-color: ${({ theme }) => theme.colors.concrete[200]};
    color: ${({ theme }) => theme.colors.navy[600]};
  `,
};

export const StyledSection = styled.section<{ $tone: SectionTone }>`
  padding: 5.6rem 1.6rem;
  ${({ $tone }) => sectionTone[$tone]}

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
  padding: 4rem 1.6rem 5.6rem;
  background: linear-gradient(
    160deg,
    ${({ theme }) => theme.colors.navy[500]} 0%,
    ${({ theme }) => theme.colors.navy[700]} 100%
  );
  color: ${({ theme }) => theme.colors.concrete[100]};

  @media (min-width: ${({ theme }) => theme.breakpoints.md}) {
    padding: 6.4rem 2.4rem 8rem;
  }

  @media (min-width: ${({ theme }) => theme.breakpoints.lg}) {
    padding: 8rem 3.2rem 9.6rem;
  }
`;

export const StyledHeroInner = styled.div`
  width: 100%;
  max-width: 120rem;
  margin: 0 auto;
  display: grid;
  gap: 4rem;
  align-items: center;

  @media (min-width: ${({ theme }) => theme.breakpoints.lg}) {
    grid-template-columns: 1.05fr 0.95fr;
    gap: 6.4rem;
  }
`;

export const StyledHeroCopy = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2rem;

  @media (min-width: ${({ theme }) => theme.breakpoints.lg}) {
    /* On large screens, render copy after the figure */
    order: 1;
  }
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
  font-size: clamp(3.2rem, 6vw, 5.4rem);
  line-height: 1.08;
  font-weight: 800;
  letter-spacing: -0.01em;

  span {
    color: ${({ theme }) => theme.colors.orange[400]};
  }
`;

export const StyledLede = styled.p`
  margin: 0;
  max-width: 54ch;
  font-size: clamp(1.6rem, 2.2vw, 1.9rem);
  line-height: 1.6;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.navy[200]};
`;

export const StyledFormWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  margin-top: 0.8rem;
`;

export const StyledFootnote = styled.p`
  margin: 0;
  font-size: 1.3rem;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.navy[200]};
`;

export const StyledHeroFigure = styled.figure`
  margin: 0;
  width: 100%;

  @media (min-width: ${({ theme }) => theme.breakpoints.lg}) {
    /* On large screens, render figure before the copy */
    order: 2;
  }
`;

export const StyledHeroImage = styled.img`
  display: block;
  width: 100%;
  height: 100%;
  max-height: 44rem;
  object-fit: cover;
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  box-shadow: ${({ theme }) => theme.shadows.lg};

  @media (min-width: ${({ theme }) => theme.breakpoints.lg}) {
    max-height: none;
    /* aspect-ratio: 4 / 5; */
  }
`;

/* ---------- section heading + cards ---------- */

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
  font-size: clamp(2.6rem, 4.5vw, 3.6rem);
  line-height: 1.15;
  font-weight: 800;
  letter-spacing: -0.01em;
`;

export const StyledSectionLede = styled.p`
  margin: 0;
  font-size: clamp(1.5rem, 2vw, 1.8rem);
  line-height: 1.6;
  font-weight: 500;
  opacity: 0.85;
`;

export const StyledCardGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 2rem;

  @media (min-width: ${({ theme }) => theme.breakpoints.sm}) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (min-width: ${({ theme }) => theme.breakpoints.lg}) {
    grid-template-columns: repeat(4, 1fr);
  }
`;

export const StyledCard = styled.article`
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  padding: 2.4rem;
  background-color: ${({ theme }) => theme.colors.concrete[100]};
  border: 0.1rem solid ${({ theme }) => theme.colors.concrete[600]};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  box-shadow: ${({ theme }) => theme.shadows.sm};
`;

export const StyledCardIcon = styled.span`
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

export const StyledCardTitle = styled.h3`
  margin: 0;
  font-size: 1.8rem;
  line-height: 1.3;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.navy[700]};
`;

export const StyledCardText = styled.p`
  margin: 0;
  font-size: 1.5rem;
  line-height: 1.55;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.navy[500]};
`;

/* ---------- closing CTA + footer ---------- */

export const StyledCtaInner = styled.div`
  width: 100%;
  max-width: 56rem;
  margin: 0 auto;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 1.6rem;
`;

export const StyledCtaMedia = styled.div`
  margin-bottom: 0.8rem;
`;

export const StyledFooter = styled.footer`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.8rem;
  padding: 3.2rem 1.6rem;
  background-color: ${({ theme }) => theme.colors.navy[800]};
  color: ${({ theme }) => theme.colors.navy[200]};
  text-align: center;
`;

export const StyledFooterMark = styled.p`
  margin: 0;
  font-size: 1.6rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: ${({ theme }) => theme.colors.concrete[100]};

  span {
    color: ${({ theme }) => theme.colors.orange[500]};
  }
`;

export const StyledFooterText = styled.p`
  margin: 0;
  font-size: 1.3rem;
  font-weight: 500;
`;

/* ---------- waitlist success state ---------- */

export const StyledSuccess = styled.div<{ $onDark?: boolean }>`
  display: flex;
  align-items: flex-start;
  gap: 1.2rem;
  padding: 2rem;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background-color: ${({ theme, $onDark }) =>
    $onDark ? "rgba(255, 255, 255, 0.08)" : theme.colors.green[0]};
  color: ${({ theme, $onDark }) =>
    $onDark ? theme.colors.concrete[100] : theme.colors.navy[700]};
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

/* ---------- closing-CTA reassurance list ---------- */

export const StyledReassureList = styled.ul`
  list-style: none;
  margin: 1.6rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.8rem;
`;

export const StyledReassureItem = styled.li`
  display: flex;
  align-items: center;
  gap: 0.8rem;
  font-size: 1.4rem;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.navy[200]};

  svg {
    flex-shrink: 0;
    font-size: 1.6rem;
    color: ${({ theme }) => theme.colors.green[500]};
  }
`;

/* ---------- shared marketing photo ---------- */

export const StyledMediaImg = styled.img<{ $ratio?: string }>`
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: ${({ $ratio }) => $ratio ?? "4 / 3"};
  object-fit: cover;
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  box-shadow: ${({ theme }) => theme.shadows.lg};
`;
