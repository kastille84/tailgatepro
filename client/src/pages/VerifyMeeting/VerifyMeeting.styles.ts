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
  max-width: 56rem;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 2.4rem;
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

export const StyledCard = styled.section`
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  padding: 2rem;
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  background-color: ${({ theme }) => theme.colors.concrete[100]};
  box-shadow: ${({ theme }) => theme.shadows.sm};
`;

export const StyledCardTitle = styled.h2`
  margin: 0;
  font-size: 2rem;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.navy[700]};
`;

interface StyledVerdictProps {
  $tone: "good" | "bad" | "neutral";
}

export const StyledVerdict = styled.p<StyledVerdictProps>`
  margin: 0;
  display: flex;
  align-items: flex-start;
  gap: 0.8rem;
  font-size: 1.8rem;
  font-weight: 700;
  line-height: 1.4;
  color: ${({ theme, $tone }) =>
    $tone === "good"
      ? theme.colors.green[700]
      : $tone === "bad"
        ? theme.colors.red[600]
        : theme.colors.navy[600]};

  svg {
    flex-shrink: 0;
    margin-top: 0.2rem;
    font-size: 2.4rem;
  }
`;

export const StyledDetail = styled.p`
  margin: 0;
  font-size: 1.5rem;
  line-height: 1.6;
`;

// A visually-hidden native <input type="file"> sits inside this label, so the
// whole block is the tap target (48px+ minimum, glove-friendly) and keyboard
// focus on the input shows up on the label.
export const StyledDropLabel = styled.label`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.8rem;
  min-height: 14rem;
  padding: 2rem;
  border: 0.2rem dashed ${({ theme }) => theme.colors.navy[600]};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  text-align: center;
  font-size: 1.6rem;
  font-weight: 600;
  cursor: pointer;

  &:focus-within {
    outline: 0.3rem solid ${({ theme }) => theme.colors.orange[500]};
    outline-offset: 0.2rem;
  }

  svg {
    font-size: 3.2rem;
  }
`;

export const StyledFileInput = styled.input`
  position: absolute;
  width: 0.1rem;
  height: 0.1rem;
  opacity: 0;
  overflow: hidden;
`;
