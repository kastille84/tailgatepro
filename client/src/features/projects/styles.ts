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

/** Status/linked badges. */
export const StyledCardActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1.2rem;
`;

/** Disclosure button that shows/hides the card's action panel. Full width on
 *  mobile (48px target); shrinks to content from tablet up. */
export const StyledActionsToggle = styled.button`
  flex: 1 1 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.2rem;
  min-height: 4.8rem;
  padding: 0 1.6rem;
  font-size: 1.6rem;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.navy[700]};
  background-color: transparent;
  border: 0.1rem solid ${({ theme }) => theme.colors.navy[200]};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  cursor: pointer;

  @media (min-width: ${({ theme }) => theme.breakpoints.sm}) {
    flex: 0 0 auto;
  }
`;

export const StyledChevron = styled.span<{ $open: boolean }>`
  width: 0.9rem;
  height: 0.9rem;
  border-right: 0.2rem solid currentColor;
  border-bottom: 0.2rem solid currentColor;
  transform: ${({ $open }) => ($open ? "rotate(-135deg)" : "rotate(45deg)")};
`;

/** The collapsible buttons: stacked on mobile, one row from tablet up. */
export const StyledActionsPanel = styled.div`
  flex: 1 1 100%;
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.2rem;

  @media (min-width: ${({ theme }) => theme.breakpoints.sm}) {
    grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  }
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
    $status === "active" ? theme.colors.green[700] : theme.colors.navy[600]};
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

export const StyledOriginBadge = styled.span`
  display: inline-block;
  flex-shrink: 0;
  align-self: flex-start;
  padding: 0.4rem 0.9rem;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  font-size: 1.2rem;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.green[700]};
  background-color: ${({ theme }) => theme.colors.concrete[200]};
  border: 0.1rem solid ${({ theme }) => theme.colors.navy[200]};
  margin-bottom: 0.8rem;
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

/** "Check with your GC first" heads-up at the top of the new-project form. */
export const StyledGcCheckNote = styled.p`
  margin: 0 0 1.6rem;
  padding: 1.2rem 1.6rem;
  font-size: 1.4rem;
  font-weight: 500;
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.navy[600]};
  background: ${({ theme }) => theme.colors.orange[100]};
  border: 0.1rem solid ${({ theme }) => theme.colors.orange[200]};
  border-radius: ${({ theme }) => theme.borderRadius.md};
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

/** Full-width row along the bottom of a project card for the sub's own
 *  meeting-cadence control (only on a card linked to a GC job site). */
export const StyledCadenceRow = styled.div`
  flex: 1 1 100%;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.8rem 1.6rem;
  padding-top: 1.2rem;
  border-top: 0.1rem solid ${({ theme }) => theme.colors.navy[100]};
`;

export const StyledCadenceText = styled.div`
  flex: 1 1 16rem;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
`;

export const StyledCadenceLabel = styled.span`
  font-size: 1.4rem;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.navy[700]};
`;
