import styled from "styled-components";

import { pageContentGrow } from "../../styles/layout";
import { PageShell } from "../../ui_comps/page-shell";

export const StyledPage = PageShell;

export const StyledSection = styled.section`
  ${pageContentGrow}
  padding: 5.6rem 1.6rem;
  background-color: ${({ theme }) => theme.colors.concrete[200]};
  color: ${({ theme }) => theme.colors.navy[600]};
`;

export const StyledContainer = styled.div`
  width: 100%;
  max-width: 48rem;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1.6rem;
`;

export const StyledTitle = styled.h1`
  margin: 0;
  font-size: 2.8rem;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.navy[700]};
`;

export const StyledLede = styled.p`
  margin: 0;
  font-size: 1.6rem;
  line-height: 1.6;
  font-weight: 500;
`;
