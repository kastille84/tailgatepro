import styled from "styled-components";

export const StyledCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  padding: 2rem;
  margin-bottom: 2.4rem;
  border: 0.1rem solid ${({ theme }) => theme.colors.navy[100]};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background-color: ${({ theme }) => theme.colors.concrete[100]};
`;

export const StyledCardTitle = styled.h2`
  margin: 0;
  font-size: 1.3rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: ${({ theme }) => theme.colors.navy[400]};
`;

export const StyledTopicTitle = styled.p`
  margin: 0;
  font-size: 1.8rem;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.navy[700]};
  overflow-wrap: anywhere;
`;

export const StyledTopicMeta = styled.p`
  margin: 0;
  font-size: 1.3rem;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.navy[400]};
`;

export const StyledNoPush = styled.p`
  margin: 0;
  font-size: 1.4rem;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.navy[400]};
`;

export const StyledFormRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 1.2rem;

  > *:first-child {
    flex: 1 1 24rem;
  }
`;

export const StyledActionsRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 1.2rem;
`;

export const StyledStatusPill = styled.span<{ $status: "logged" | "missing" }>`
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  flex-shrink: 0;
  padding: 0.4rem 0.9rem;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  font-size: 1.2rem;
  font-weight: 700;
  color: ${({ theme, $status }) =>
    $status === "logged" ? theme.colors.green[700] : theme.colors.red[600]};
  background-color: ${({ theme, $status }) =>
    $status === "logged" ? theme.colors.green[100] : theme.colors.red[100]};
`;

export const StyledJobsiteBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  margin-bottom: 1.6rem;

  &:last-child {
    margin-bottom: 0;
  }
`;

export const StyledJobsiteName = styled.h3`
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.navy[700]};
`;

export const StyledSubList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
`;

export const StyledSubRow = styled.li`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem 1.6rem;
  padding: 1.2rem 1.6rem;
  border: 0.1rem solid ${({ theme }) => theme.colors.navy[100]};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background-color: ${({ theme }) => theme.colors.concrete[100]};
`;

export const StyledSubName = styled.span`
  font-size: 1.4rem;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.navy[700]};
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
 *  page and nav link stay visible for every GC as a selling point (same
 *  convention `gc-subcontractors` and the Defense Bundle button use). */
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
