import styled from "styled-components";

export const StyledStatRow = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.2rem;
  margin-bottom: 2.4rem;

  @media (min-width: ${({ theme }) => theme.breakpoints.xs}) {
    grid-template-columns: repeat(3, 1fr);
  }
`;

export const StyledStatTile = styled.div`
  padding: 1.6rem;
  border: 0.1rem solid ${({ theme }) => theme.colors.navy[100]};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background-color: ${({ theme }) => theme.colors.concrete[100]};
  text-align: center;

  strong {
    display: block;
    font-size: 2.4rem;
    font-weight: 800;
    color: ${({ theme }) => theme.colors.navy[700]};
  }

  span {
    font-size: 1.3rem;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.navy[400]};
  }
`;

export const StyledJobsiteSection = styled.section`
  margin-bottom: 2.4rem;
`;

export const StyledJobsiteLabel = styled.p`
  margin: 0 0 0.2rem;
  font-size: 1.2rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: ${({ theme }) => theme.colors.orange[400]};
`;

export const StyledJobsiteHeading = styled.h3`
  margin: 0 0 0.8rem;
  font-size: 1.8rem;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.navy[700]};
`;

export const StyledSubList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
`;

export const StyledSubRow = styled.button`
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
  font: inherit;
  text-align: left;
  cursor: pointer;
  min-height: 4.8rem;

  &:hover,
  &:focus-visible {
    border-color: ${({ theme }) => theme.colors.orange[400]};
  }
`;

export const StyledSubName = styled.span`
  font-size: 1.5rem;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.navy[700]};
`;

export const StyledSubMeta = styled.span`
  font-size: 1.3rem;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.navy[400]};
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

export const StyledMeetingList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
`;

export const StyledMeetingRow = styled.li`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem 1.6rem;
  padding: 1.2rem;
  border: 0.1rem solid ${({ theme }) => theme.colors.navy[100]};
  border-radius: ${({ theme }) => theme.borderRadius.md};
`;

export const StyledMeetingMeta = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
`;

export const StyledMeetingTitle = styled.span`
  font-size: 1.4rem;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.navy[700]};
  overflow-wrap: anywhere;
`;

export const StyledMeetingDate = styled.span`
  font-size: 1.2rem;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.navy[400]};
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

export const StyledOfflineNote = styled.p`
  margin: 0 0 1.6rem;
  font-size: 1.4rem;
  font-weight: 500;
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.navy[500]};
`;

export const StyledError = styled.p`
  margin: 0;
  padding: 2.4rem 1.6rem;
  text-align: center;
  font-size: 1.5rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.red[600]};
`;
