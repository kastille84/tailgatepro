import styled from "styled-components";
import { Link } from "react-router-dom";

// The list/card/badge/actions look is shared with features/projects so a GC's
// job site cards match a sub's project cards. Re-exported rather than
// duplicated; only roster-specific pieces are defined here.
export {
  StyledActions,
  StyledArchivedBadge,
  StyledCard,
  StyledCardActions,
  StyledCardMain,
  StyledEmpty,
  StyledList,
  StyledMeta,
  StyledName,
  StyledOriginBadge,
  StyledStatusBadge,
} from "../projects/styles";

/** Inline upgrade prompt shown when the server refuses an action with PLAN_LIMIT. */
export const StyledUpgradePrompt = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  padding: 1.6rem 2rem;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  border: 0.1rem solid ${({ theme }) => theme.colors.orange[500]};
  background-color: ${({ theme }) => theme.colors.concrete[200]};
`;

export const StyledUpgradeText = styled.p`
  margin: 0;
  font-size: 1.4rem;
  font-weight: 600;
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.navy[700]};
`;

export const StyledUpgradeLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  min-height: 4.8rem;
  width: fit-content;
  font-size: 1.5rem;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.orange[600]};
`;

/** Explainer / offline copy inside the roster modal and manager. */
export const StyledNote = styled.p`
  margin: 0;
  font-size: 1.4rem;
  font-weight: 500;
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.navy[500]};
`;

export const StyledRosterSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.6rem;
`;

export const StyledRosterList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
`;

export const StyledRosterRow = styled.li`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1.2rem;
  padding: 1.2rem 1.6rem;
  border: 0.1rem solid ${({ theme }) => theme.colors.navy[100]};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background-color: ${({ theme }) => theme.colors.concrete[100]};
`;

export const StyledRosterMain = styled.div`
  flex: 1 1 16rem;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
`;

export const StyledRosterStatus = styled.span<{ $accepted: boolean }>`
  flex-shrink: 0;
  padding: 0.4rem 0.9rem;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  font-size: 1.2rem;
  font-weight: 700;
  color: ${({ theme, $accepted }) =>
    $accepted ? theme.colors.green[700] : theme.colors.navy[700]};
  background-color: ${({ theme, $accepted }) =>
    $accepted ? theme.colors.green[100] : theme.colors.orange[100]};
`;

export const StyledToolbar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.6rem;
  margin-bottom: 2.4rem;
`;
