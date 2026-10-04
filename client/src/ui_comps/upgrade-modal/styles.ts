import styled from "styled-components";
import { Link } from "react-router-dom";

export const StyledUpgradeBody = styled.p`
  margin: 0 0 1.6rem;
  font-size: 1.6rem;
  font-weight: 500;
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.navy[600]};
`;

export const StyledUpgradeActions = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.2rem;

  @media (min-width: ${({ theme }) => theme.breakpoints.sm}) {
    flex-direction: row;
    justify-content: flex-end;
  }
`;

export const StyledUpgradeCta = styled(Link)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 4.8rem;
  padding: 0 2rem;
  font-size: 1.6rem;
  font-weight: 700;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  color: ${({ theme }) => theme.colors.navy[800]};
  background: ${({ theme }) => theme.colors.orange[500]};
`;
