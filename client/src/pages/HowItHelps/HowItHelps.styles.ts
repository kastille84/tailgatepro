import styled, { css, keyframes } from "styled-components";

import type { RecordStrength } from "./HowItHelpsContent";

/* Shared section scaffold (StyledSection, StyledContainer, section heads, cards)
   comes from Landing.styles. Only what is specific to this page lives here. */

const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(1.2rem); }
  to { opacity: 1; transform: translateY(0); }
`;

/* ---------- hero ---------- */

export const StyledHeroToggle = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1.2rem;
  margin-top: 0.8rem;
`;

export const StyledToggleHint = styled.p`
  margin: 0;
  font-size: 1.4rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.navy[200]};
`;

/* ---------- audience panel ---------- */

export const StyledPanel = styled.div`
  display: grid;
  gap: 3.2rem;

  @media (prefers-reduced-motion: no-preference) {
    animation: ${fadeUp} 0.35s ease-out;
  }
`;

export const StyledPanelHead = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  max-width: 72rem;
`;

export const StyledPanelEyebrow = styled.p`
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 1.4rem;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.orange[700]};
`;

export const StyledPanelTitle = styled.h2`
  margin: 0;
  font-size: clamp(2.8rem, 5vw, 4rem);
  line-height: 1.1;
  font-weight: 800;
  letter-spacing: -0.01em;
  color: ${({ theme }) => theme.colors.navy[700]};
`;

export const StyledPanelLede = styled.p`
  margin: 0;
  font-size: clamp(1.6rem, 2vw, 1.9rem);
  line-height: 1.6;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.navy[500]};
`;

export const StyledFear = styled.aside`
  display: grid;
  gap: 0.8rem;
  padding: 2.4rem;
  border-left: 0.8rem solid ${({ theme }) => theme.colors.orange[500]};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  background: linear-gradient(
    160deg,
    ${({ theme }) => theme.colors.navy[500]} 0%,
    ${({ theme }) => theme.colors.navy[700]} 100%
  );
  color: ${({ theme }) => theme.colors.concrete[100]};
  box-shadow: ${({ theme }) => theme.shadows.md};

  @media (min-width: ${({ theme }) => theme.breakpoints.md}) {
    padding: 3.2rem 4rem;
  }
`;

export const StyledFearLabel = styled.p`
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 1.3rem;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.orange[400]};
`;

export const StyledFearQuote = styled.p`
  margin: 0;
  font-size: clamp(2.4rem, 4.5vw, 3.6rem);
  line-height: 1.12;
  font-weight: 800;
  letter-spacing: -0.01em;
`;

export const StyledFearBody = styled.p`
  margin: 0;
  max-width: 64ch;
  font-size: 1.6rem;
  line-height: 1.6;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.navy[200]};
`;

export const StyledPitchLayout = styled.div`
  display: grid;
  gap: 3.2rem;

  @media (min-width: ${({ theme }) => theme.breakpoints.lg}) {
    grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
    gap: 5.6rem;
    align-items: start;
  }
`;

export const StyledVisuals = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2.4rem;

  @media (min-width: ${({ theme }) => theme.breakpoints.lg}) {
    position: sticky;
    top: 10rem;
  }
`;

export const StyledPitchList = styled.ol`
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 1.6rem;
  counter-reset: pitch;
`;

export const StyledPitch = styled.li`
  counter-increment: pitch;
  display: grid;
  grid-template-columns: 4.8rem minmax(0, 1fr);
  gap: 1.6rem;
  padding: 2rem;
  background-color: ${({ theme }) => theme.colors.concrete[100]};
  border: 0.1rem solid ${({ theme }) => theme.colors.concrete[600]};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  box-shadow: ${({ theme }) => theme.shadows.sm};

  &::before {
    content: counter(pitch);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 4.8rem;
    height: 4.8rem;
    border-radius: ${({ theme }) => theme.borderRadius.md};
    background-color: ${({ theme }) => theme.colors.orange[500]};
    color: ${({ theme }) => theme.colors.concrete[100]};
    font-size: 2.2rem;
    font-weight: 800;
  }

  @media (min-width: ${({ theme }) => theme.breakpoints.md}) {
    padding: 2.4rem;
  }
`;

export const StyledPitchBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
`;

export const StyledPitchTitle = styled.h3`
  margin: 0;
  font-size: 2rem;
  line-height: 1.25;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.navy[700]};
`;

export const StyledPitchText = styled.p`
  margin: 0;
  font-size: 1.6rem;
  line-height: 1.55;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.navy[500]};
`;

/* ---------- timeline ---------- */

export const StyledTimeline = styled.ol`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2rem;
`;

export const StyledStep = styled.li`
  display: grid;
  gap: 1.6rem;
  padding: 2.4rem;
  background-color: ${({ theme }) => theme.colors.concrete[100]};
  border: 0.1rem solid ${({ theme }) => theme.colors.concrete[600]};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  box-shadow: ${({ theme }) => theme.shadows.sm};

  @media (min-width: ${({ theme }) => theme.breakpoints.md}) {
    grid-template-columns: 16rem minmax(0, 1fr) minmax(0, 0.9fr);
    gap: 3.2rem;
    padding: 3.2rem;
  }
`;

export const StyledStepWhen = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
`;

export const StyledStepNumber = styled.span`
  font-size: 1.3rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.navy[400]};
`;

export const StyledStepTime = styled.span`
  font-size: 2.2rem;
  line-height: 1.15;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.orange[700]};
`;

export const StyledStepWhat = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
`;

const strengthTone: Record<RecordStrength, ReturnType<typeof css>> = {
  supporting: css`
    border-left-color: ${({ theme }) => theme.colors.navy[400]};
  `,
  strong: css`
    border-left-color: ${({ theme }) => theme.colors.green[500]};
  `,
  strongest: css`
    border-left-color: ${({ theme }) => theme.colors.green[700]};
    background-color: ${({ theme }) => theme.colors.green[0]};
  `,
};

export const StyledStepMatters = styled.div<{ $strength: RecordStrength }>`
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  padding: 1.6rem;
  border-left: 0.6rem solid transparent;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background-color: ${({ theme }) => theme.colors.concrete[200]};
  ${({ $strength }) => strengthTone[$strength]}
`;

export const StyledStrengthTag = styled.span`
  font-size: 1.3rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.navy[700]};
`;

/* ---------- limits ---------- */

export const StyledLimits = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 1.2rem;

  @media (min-width: ${({ theme }) => theme.breakpoints.md}) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1.6rem 3.2rem;
  }
`;

export const StyledLimitItem = styled.li`
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  font-size: 1.55rem;
  line-height: 1.5;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.navy[600]};

  svg {
    flex-shrink: 0;
    margin-top: 0.2rem;
    font-size: 1.8rem;
    color: ${({ theme }) => theme.colors.navy[400]};
  }
`;

export const StyledDisclaimer = styled.p`
  margin: 2.4rem 0 0;
  font-size: 1.4rem;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.navy[400]};
`;

/* ---------- closing CTA ---------- */

export const StyledCtaLinks = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.2rem;

  @media (min-width: ${({ theme }) => theme.breakpoints.sm}) {
    flex-direction: row;
    justify-content: center;
  }
`;
