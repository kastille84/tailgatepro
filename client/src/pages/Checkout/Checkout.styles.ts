import { Link } from "react-router-dom";
import styled from "styled-components";

import { pageContentGrow } from "../../styles/layout";
import { PageShell } from "../../ui_comps/page-shell";

export const StyledPage = PageShell;

export const StyledMain = styled.main`
  ${pageContentGrow}
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4.8rem 1.6rem;
  background-color: ${({ theme }) => theme.colors.concrete[200]};
  color: ${({ theme }) => theme.colors.navy[600]};
`;

export const StyledCard = styled.div`
  width: 100%;
  max-width: 48rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.6rem;
  padding: 3.2rem 2.4rem;
  text-align: center;
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  background-color: ${({ theme }) => theme.colors.concrete[100]};
  box-shadow: ${({ theme }) => theme.shadows.md};
`;

export const StyledHeading = styled.h1`
  margin: 0;
  font-size: 2.4rem;
  line-height: 1.2;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.navy[700]};
`;

export const StyledText = styled.p`
  margin: 0;
  font-size: 1.6rem;
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.navy[500]};
`;

export const StyledError = styled.p`
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.red[600]};
`;

export const StyledActions = styled.div`
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 1.2rem;
  width: 100%;

  @media (min-width: ${({ theme }) => theme.breakpoints.md}) {
    flex-direction: row;
    justify-content: center;
  }
`;

export const StyledBackLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 4.8rem;
  padding: 0 2rem;
  font-size: 1.5rem;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.navy[600]};
`;
