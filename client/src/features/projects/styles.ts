import styled from "styled-components";

import type { ProjectStatus } from "../../interfaces/project";

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
  flex-wrap: wrap;
  align-items: center;
  gap: 1.2rem 1.6rem;
  padding: 1.6rem;
  border: 0.1rem solid ${({ theme }) => theme.colors.navy[100]};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background-color: ${({ theme }) => theme.colors.concrete[100]};
`;

// 16rem basis: on a narrow screen the name takes the row and the badges/actions
// wrap beneath it; from tablet up everything fits on one row.
export const StyledCardMain = styled.div`
  flex: 1 1 16rem;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
`;

/** Status/linked badges plus the card's action buttons. */
export const StyledCardActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1.2rem;
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
`;

export const StyledStatusBadge = styled.span<{ $status: ProjectStatus }>`
  flex-shrink: 0;
  padding: 0.4rem 0.9rem;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  font-size: 1.2rem;
  font-weight: 700;
  text-transform: capitalize;
  color: ${({ theme, $status }) =>
    $status === "active"
      ? theme.colors.green[700]
      : theme.colors.navy[600]};
  background-color: ${({ theme, $status }) =>
    $status === "active"
      ? theme.colors.green[100]
      : theme.colors.concrete[400]};
`;

export const StyledArchivedBadge = styled.span`
  flex-shrink: 0;
  padding: 0.4rem 0.9rem;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  font-size: 1.2rem;
  font-weight: 700;
  text-transform: capitalize;
  color: ${({ theme }) => theme.colors.navy[500]};
  background-color: ${({ theme }) => theme.colors.concrete[400]};
  border: 0.1rem dashed ${({ theme }) => theme.colors.navy[200]};
`;

export const StyledLinkedBadge = styled.span`
  flex-shrink: 0;
  padding: 0.4rem 0.9rem;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  font-size: 1.2rem;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.navy[700]};
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

export const StyledActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 1.2rem;
  margin-top: 0.8rem;
`;

/** Explainer / offline copy inside the "Link to GC" modal. */
export const StyledLinkNote = styled.p`
  margin: 0;
  font-size: 1.4rem;
  font-weight: 500;
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.navy[500]};
`;

/** "Danger zone" footer inside the edit modal: archive/restore + delete. */
export const StyledDangerZone = styled.div`
  margin-top: 2.4rem;
  padding-top: 1.6rem;
  border-top: 0.1rem solid ${({ theme }) => theme.colors.navy[100]};
  display: flex;
  flex-wrap: wrap;
  gap: 1.2rem;
`;

export const StyledDangerZoneTitle = styled.h4`
  flex-basis: 100%;
  margin: 0;
  font-size: 1.3rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: ${({ theme }) => theme.colors.navy[400]};
`;
