import styled from "styled-components";

export const StyledGcLayout = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 4rem;
  align-items: center;

  @media (min-width: ${({ theme }) => theme.breakpoints.lg}) {
    grid-template-columns: 1.1fr 0.9fr;
  }
`;

export const StyledGcMedia = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2rem;
  align-items: center;
`;

export const StyledGcAside = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2.4rem;
`;

export const StyledGcList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
`;

export const StyledGcItem = styled.li`
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
    color: ${({ theme }) => theme.colors.green[600]};
  }
`;

/* Ported from Pricing.styles.ts — consolidate into a shared Callout later. */
export const StyledCallout = styled.div`
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
    padding: 3.6rem 3.2rem;
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
