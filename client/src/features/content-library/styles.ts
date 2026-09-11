import styled from "styled-components";

export const StyledList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
`;

export const StyledCard = styled.li`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1.2rem;
  padding: 1.6rem;
  border: 0.1rem solid ${({ theme }) => theme.colors.navy[100]};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background-color: ${({ theme }) => theme.colors.concrete[100]};

  @media (min-width: ${({ theme }) => theme.breakpoints.sm}) {
    flex-direction: row;
    align-items: center;
    gap: 1.6rem;
  }
`;

export const StyledCardMain = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
`;

export const StyledName = styled.h3`
  margin: 0;
  font-size: 1.6rem;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.navy[700]};
  overflow-wrap: anywhere;
`;

export const StyledMeta = styled.p`
  margin: 0;
  font-size: 1.3rem;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.navy[400]};
  overflow-wrap: anywhere;
`;

export const StyledTradeBadge = styled.span`
  flex-shrink: 0;
  padding: 0.4rem 0.9rem;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  font-size: 1.2rem;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.orange[700]};
  background-color: ${({ theme }) => theme.colors.orange[100]};
`;

export const StyledEmpty = styled.p`
  margin: 0;
  padding: 3.2rem 1.6rem;
  text-align: center;
  font-size: 1.5rem;
  font-weight: 500;
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.navy[400]};
`;

export const StyledBadgeRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem;
  margin-bottom: 1.6rem;
`;

export const StyledSummary = styled.p`
  margin: 0 0 1.6rem;
  font-size: 1.5rem;
  font-weight: 600;
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.navy[600]};
`;

export const StyledSection = styled.section`
  margin-bottom: 1.6rem;

  ul {
    margin: 0.8rem 0 0;
    padding-left: 1.8rem;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  li {
    font-size: 1.4rem;
    line-height: 1.6;
    color: ${({ theme }) => theme.colors.navy[600]};
  }
`;

export const StyledSectionTitle = styled.h4`
  margin: 0;
  font-size: 1.3rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: ${({ theme }) => theme.colors.navy[400]};
`;

export const StyledOshaLine = styled.p`
  margin: 0 0 1.6rem;
  font-size: 1.3rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.navy[500]};
`;

/** CPWR licensing condition: copyright + no-endorsement notice must travel
 *  with the content wherever a talk's body is shown. See
 *  docs/content-attribution.md. */
export const StyledAttribution = styled.p`
  margin: 1.6rem 0 0;
  padding-top: 1.6rem;
  border-top: 0.1rem solid ${({ theme }) => theme.colors.navy[100]};
  font-size: 1.2rem;
  line-height: 1.5;
  color: ${({ theme }) => theme.colors.navy[400]};
`;

export const StyledButtonContainer = styled.div`
  display: flex;
  justify-content: flex-end;
  align-items: flex-end;
  width: 100%;

  @media (min-width: ${({ theme }) => theme.breakpoints.sm}) {
    width: inherit;
    margin-top: 0;
  }
`;
