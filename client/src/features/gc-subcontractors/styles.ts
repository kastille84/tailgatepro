import styled from "styled-components";
import { Link } from "react-router-dom";

export const StyledScorecardList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
`;

export const StyledScorecardRow = styled(Link)`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1.2rem 1.6rem;
  width: 100%;
  padding: 1.6rem;
  border: 0.1rem solid ${({ theme }) => theme.colors.navy[100]};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background-color: ${({ theme }) => theme.colors.concrete[100]};
  min-height: 4.8rem;
  text-decoration: none;

  &:hover,
  &:focus-visible {
    border-color: ${({ theme }) => theme.colors.orange[400]};
  }
`;

export const StyledCompanyName = styled.span`
  font-size: 1.5rem;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.navy[700]};
`;

/** A compliance score's tier -- "good" reads like `computeCompliance`'s own
 *  "logged" green, "poor" like its "missing" red; "fair" (mid-range) is the
 *  one status this pill needs that the two-value logged/missing pill never
 *  did. Thresholds match the design doc's scoring model discussion: 90%+ is
 *  the bar a GC would call "on track," under 70% is worth a closer look. */
export const StyledScoreBadge = styled.span<{ $tier: "good" | "fair" | "poor" }>`
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  flex-shrink: 0;
  padding: 0.4rem 0.9rem;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  font-size: 1.2rem;
  font-weight: 700;
  color: ${({ theme, $tier }) =>
    $tier === "good"
      ? theme.colors.green[700]
      : $tier === "fair"
        ? theme.colors.orange[700]
        : theme.colors.red[600]};
  background-color: ${({ theme, $tier }) =>
    $tier === "good"
      ? theme.colors.green[100]
      : $tier === "fair"
        ? theme.colors.orange[100]
        : theme.colors.red[100]};
`;

export const StyledLargeScoreBadge = styled(StyledScoreBadge)`
  padding: 0.8rem 1.6rem;
  font-size: 2rem;
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

/** Upgrade prompt shown to a non-Portfolio GC in place of real data -- the
 *  page and nav link stay visible as a selling point (same convention the
 *  Defense Bundle button and MeetingHistory's history-window banner use);
 *  only the data itself is withheld. */
export const StyledUpgradeBanner = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  padding: 1.6rem 2rem;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background-color: ${({ theme }) => theme.colors.concrete[100]};
`;

export const StyledUpgradeTitle = styled.p`
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.navy[700]};
`;

export const StyledUpgradeBody = styled.p`
  margin: 0;
  font-size: 1.4rem;
  font-weight: 500;
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.navy[500]};

  a {
    display: inline-flex;
    align-items: center;
    min-height: 4.8rem;
    color: ${({ theme }) => theme.colors.orange[600]};
    font-weight: 700;
  }
`;

export const StyledBackLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  min-height: 4.8rem;
  margin-bottom: 0.8rem;
  font-size: 1.4rem;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.orange[600]};
  text-decoration: underline;
`;

export const StyledDetailHeader = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1.2rem;
  margin-bottom: 2.4rem;
`;

export const StyledBreakdownList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
`;

export const StyledBreakdownRow = styled.li`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem 1.6rem;
  padding: 1.6rem;
  border: 0.1rem solid ${({ theme }) => theme.colors.navy[100]};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background-color: ${({ theme }) => theme.colors.concrete[100]};
`;

export const StyledJobsiteMeta = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
`;

export const StyledJobsiteName = styled.span`
  font-size: 1.5rem;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.navy[700]};
  overflow-wrap: anywhere;
`;

export const StyledJobsiteDays = styled.span`
  font-size: 1.3rem;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.navy[400]};
`;
