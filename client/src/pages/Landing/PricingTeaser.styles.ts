import styled from "styled-components";
import { Link } from "react-router-dom";

/* The teaser reuses Landing's StyledSection / StyledContainer / StyledSectionHead
   scaffolding; only the compact plan grid below is specific to it. */

export const StyledControls = styled.div`
  display: flex;
  justify-content: center;
  margin-bottom: 3.2rem;

  @media (min-width: ${({ theme }) => theme.breakpoints.md}) {
    margin-bottom: 4rem;
  }
`;

export const StyledGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.6rem;
  align-items: stretch;

  @media (min-width: ${({ theme }) => theme.breakpoints.lg}) {
    grid-template-columns: repeat(3, 1fr);
  }
`;

export const StyledCard = styled.article<{ $featured?: boolean }>`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  height: 100%;
  padding: 2.4rem 2rem;
  background-color: ${({ theme }) => theme.colors.concrete[100]};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  border: ${({ theme, $featured }) =>
    $featured
      ? `0.2rem solid ${theme.colors.orange[500]}`
      : `0.1rem solid ${theme.colors.concrete[600]}`};
  box-shadow: ${({ theme, $featured }) =>
    $featured ? theme.shadows.md : theme.shadows.sm};
`;

export const StyledBadge = styled.span`
  position: absolute;
  top: 0;
  left: 50%;
  transform: translate(-50%, -50%);
  padding: 0.4rem 1.2rem;
  border-radius: 999rem;
  background-color: ${({ theme }) => theme.colors.orange[500]};
  color: ${({ theme }) => theme.colors.concrete[100]};
  font-size: 1.05rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  white-space: nowrap;
`;

export const StyledName = styled.h3`
  margin: 0;
  font-size: 1.8rem;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.navy[700]};
`;

export const StyledPriceRow = styled.div`
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.5rem;
`;

export const StyledPrice = styled.span`
  font-size: clamp(2.6rem, 4vw, 3.2rem);
  font-weight: 800;
  line-height: 1;
  color: ${({ theme }) => theme.colors.navy[700]};
`;

export const StyledCadence = styled.span`
  font-size: 1.4rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.navy[400]};
`;

export const StyledTarget = styled.p`
  margin: 0;
  font-size: 1.35rem;
  font-weight: 500;
  line-height: 1.5;
  color: ${({ theme }) => theme.colors.navy[400]};
`;

export const StyledFeatures = styled.ul`
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  margin: 0.4rem 0 0;
  padding: 0;
`;

export const StyledFeatureItem = styled.li`
  display: flex;
  align-items: flex-start;
  gap: 0.9rem;
  font-size: 1.4rem;
  line-height: 1.45;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.navy[600]};

  svg {
    flex-shrink: 0;
    margin-top: 0.15rem;
    font-size: 1.7rem;
    color: ${({ theme }) => theme.colors.green[600]};
  }
`;

export const StyledMore = styled.div`
  display: flex;
  justify-content: center;
  margin-top: 3.2rem;
`;

export const StyledMoreLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  min-height: 4.8rem;
  padding: 0 0.4rem;
  font-size: 1.5rem;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.orange[600]};
  text-decoration: none;

  svg {
    font-size: 1.6rem;
    transition: transform 0.15s ease;
  }

  &:hover {
    text-decoration: underline;
  }

  &:hover svg {
    transform: translateX(0.3rem);
  }

  &:focus-visible {
    outline: 0.2rem solid ${({ theme }) => theme.colors.orange[500]};
    outline-offset: 0.2rem;
  }
`;
