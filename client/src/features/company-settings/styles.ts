import styled from "styled-components";

export const StyledSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.6rem;
`;

export const StyledSectionTitle = styled.h2`
  margin: 0;
  font-size: 1.8rem;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.navy[700]};
`;

export const StyledLogoPreviewFrame = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16rem;
  height: 10rem;
  border: 0.1rem solid ${({ theme }) => theme.colors.navy[100]};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background-color: ${({ theme }) => theme.colors.concrete[100]};
  overflow: hidden;
`;

export const StyledLogoPreviewImage = styled.img`
  display: block;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
`;

export const StyledLogoPreviewEmpty = styled.span`
  padding: 0 1.2rem;
  text-align: center;
  font-size: 1.3rem;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.navy[400]};
`;

export const StyledLogoActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 1.2rem;
`;

export const StyledFileInputLabel = styled.label`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 4.8rem;
  padding: 0 1.6rem;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  border: 0.1rem solid ${({ theme }) => theme.colors.orange[500]};
  background-color: ${({ theme }) => theme.colors.orange[500]};
  color: white;
  font-size: 1.5rem;
  font-weight: 700;
  cursor: pointer;
  width: fit-content;

  &:focus-within {
    outline: 0.2rem solid ${({ theme }) => theme.colors.navy[700]};
    outline-offset: 0.2rem;
  }
`;

// Visually hidden but still focusable/clickable via the associated
// StyledFileInputLabel -- the native file-picker chrome can't be restyled
// directly (same clip-rect pattern as features/meeting-flow's
// StyledFileInput, duplicated here rather than cross-imported to keep
// per-domain feature folders independent).
export const StyledFileInput = styled.input`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
`;

export const StyledSectionHelp = styled.p`
  margin: 0;
  font-size: 1.4rem;
  font-weight: 500;
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.navy[500]};
`;

export const StyledJoinCodeRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1.2rem;
`;

export const StyledJoinCode = styled.output`
  display: inline-flex;
  align-items: center;
  min-height: 4.8rem;
  padding: 0 1.6rem;
  border: 0.1rem solid ${({ theme }) => theme.colors.navy[200]};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background-color: ${({ theme }) => theme.colors.concrete[100]};
  color: ${({ theme }) => theme.colors.navy[700]};
  font-family: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
  font-size: 2.4rem;
  font-weight: 800;
  letter-spacing: 0.2em;
  user-select: all;
`;

export const StyledJoinCodeError = styled.p`
  margin: 0;
  font-size: 1.4rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.red[700]};
`;

export const StyledUpsell = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  padding: 1.6rem 2rem;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background-color: ${({ theme }) => theme.colors.concrete[200]};
`;

export const StyledUpsellTitle = styled.p`
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.navy[700]};
`;

/** Explainer / offline copy inside the "Invite a teammate" form — same role
 *  as features/projects' StyledLinkNote. */
export const StyledInviteNote = styled.p`
  margin: 0;
  font-size: 1.4rem;
  font-weight: 500;
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.navy[500]};
`;

export const StyledInviteFields = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.6rem;

  @media (min-width: ${({ theme }) => theme.breakpoints.sm}) {
    flex-direction: row;
    align-items: flex-start;

    > * {
      flex: 1;
    }
  }
`;

export const StyledUpsellBody = styled.p`
  margin: 0;
  font-size: 1.4rem;
  font-weight: 500;
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.navy[500]};

  a {
    color: ${({ theme }) => theme.colors.orange[600]};
    font-weight: 700;
  }
`;
