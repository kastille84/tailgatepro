import styled from "styled-components";

import { pageContentGrow } from "../../styles/layout";
import { PageShell } from "../../ui_comps/page-shell";

export const StyledPage = PageShell;

export const StyledSection = styled.section`
  ${pageContentGrow}
  padding: 4.8rem 1.6rem 5.6rem;
  background-color: ${({ theme }) => theme.colors.concrete[200]};
  color: ${({ theme }) => theme.colors.navy[600]};
`;

export const StyledContainer = styled.div`
  width: 100%;
  max-width: 72rem;
  margin: 0 auto;
`;

export const StyledHeadline = styled.h1`
  margin: 0;
  font-size: clamp(2.4rem, 4vw, 3.2rem);
  line-height: 1.1;
  font-weight: 800;
  letter-spacing: -0.01em;
  color: ${({ theme }) => theme.colors.navy[700]};
`;

export const StyledError = styled.p`
  margin: 0;
  padding: 2.4rem 1.6rem;
  text-align: center;
  font-size: 1.5rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.red[600]};
`;

export const StyledStatus = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 40vh;
  padding: 4.8rem 1.6rem;
  font-size: 1.5rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.navy[400]};
`;

export const StyledOfflineNote = styled.p`
  margin: 0 0 2.4rem;
  padding: 1.2rem 1.6rem;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background-color: ${({ theme }) => theme.colors.concrete[100]};
  font-size: 1.4rem;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.navy[500]};
`;
