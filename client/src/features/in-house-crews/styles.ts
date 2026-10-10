import { Link } from "react-router-dom";
import styled from "styled-components";

export const StyledChips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem;
`;

export const StyledChip = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 4.8rem;
  padding: 0 1.6rem;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  border: 0.1rem solid ${({ theme }) => theme.colors.navy[200]};
  background-color: ${({ theme }) => theme.colors.concrete[100]};
  color: ${({ theme }) => theme.colors.navy[700]};
  font-size: 1.5rem;
  font-weight: 700;
  cursor: pointer;

  &:hover {
    border-color: ${({ theme }) => theme.colors.orange[500]};
  }

  &:focus-visible {
    outline: 0.2rem solid ${({ theme }) => theme.colors.navy[700]};
    outline-offset: 0.2rem;
  }
`;

export const StyledActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 1.2rem;
  margin-top: 0.8rem;
`;

export const StyledNote = styled.p`
  margin: 0;
  font-size: 1.4rem;
  font-weight: 500;
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.navy[500]};
`;

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

export const StyledCard = styled.section`
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  padding: 2rem;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  border: 0.1rem solid ${({ theme }) => theme.colors.orange[500]};
  background-color: ${({ theme }) => theme.colors.concrete[100]};
`;

export const StyledCardTitle = styled.h2`
  margin: 0;
  font-size: 1.8rem;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.navy[700]};
`;

export const StyledCardActions = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.2rem;

  @media (min-width: ${({ theme }) => theme.breakpoints.sm}) {
    flex-direction: row;
  }
`;

export const StyledCrewList = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  margin: 0;
  padding: 0;
  list-style: none;
`;

export const StyledCrewRow = styled.li`
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  padding: 1.6rem;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  border: 0.1rem solid ${({ theme }) => theme.colors.navy[100]};
`;

export const StyledCrewName = styled.span<{ $archived: boolean }>`
  font-size: 1.6rem;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.navy[700]};
  opacity: ${({ $archived }) => ($archived ? 0.6 : 1)};
`;

export const StyledCrewActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 1.2rem;
`;

export const StyledInHouseBadge = styled.span`
  display: inline-block;
  flex-shrink: 0;
  padding: 0.4rem 0.9rem;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  font-size: 1.2rem;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.green[700]};
  background-color: ${({ theme }) => theme.colors.concrete[200]};
  border: 0.1rem solid ${({ theme }) => theme.colors.navy[200]};
`;

export const StyledFieldset = styled.fieldset`
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  margin: 0;
  padding: 0;
  border: 0;
  min-width: 0;
`;

export const StyledLegend = styled.legend`
  padding: 0;
  margin-bottom: 0.8rem;
  font-size: 1.4rem;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.navy[600]};
`;

export const StyledChecklist = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
`;

export const StyledSection = styled.section`
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
`;

export const StyledSectionTitle = styled.h3`
  margin: 0;
  font-size: 1.6rem;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.navy[700]};
`;

export const StyledMemberName = styled.span`
  font-size: 1.5rem;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.navy[700]};
`;

export const StyledMemberMeta = styled.span`
  overflow-wrap: anywhere;
  font-size: 1.3rem;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.navy[500]};
`;
