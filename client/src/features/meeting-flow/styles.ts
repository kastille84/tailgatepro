import styled from "styled-components";

export const StyledWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2rem;
`;

export const StyledQuestion = styled.fieldset`
  margin: 0;
  padding: 0;
  border: none;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
`;

export const StyledQuestionText = styled.legend`
  padding: 0;
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.5;
  color: ${({ theme }) => theme.colors.navy[700]};
`;

export const StyledResult = styled.p<{ $passed: boolean }>`
  margin: 0;
  padding: 1.2rem 1.4rem;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  font-size: 1.4rem;
  font-weight: 600;
  line-height: 1.5;
  color: ${({ theme, $passed }) =>
    $passed ? theme.colors.green[700] : theme.colors.navy[700]};
  background-color: ${({ theme, $passed }) =>
    $passed ? theme.colors.green[50] : theme.colors.concrete[200]};
`;

export const StyledActions = styled.div`
  display: flex;
  justify-content: flex-end;
`;

export const StyledPhotoWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.6rem;
`;

export const StyledComplianceNotice = styled.p`
  margin: 0;
  padding: 1.2rem 1.4rem;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  background-color: ${({ theme }) => theme.colors.concrete[200]};
  font-size: 1.3rem;
  font-weight: 500;
  line-height: 1.5;
  color: ${({ theme }) => theme.colors.navy[600]};
`;

export const StyledPreviewFrame = styled.div`
  width: 100%;
  max-width: 32rem;
  border: 0.1rem solid ${({ theme }) => theme.colors.navy[100]};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  overflow: hidden;
  background-color: ${({ theme }) => theme.colors.concrete[100]};
`;

export const StyledPreviewImage = styled.img`
  display: block;
  width: 100%;
  height: auto;
`;

export const StyledVideo = styled.video`
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 4 / 3;
  background-color: black;
`;

// An off-screen scratch buffer used only to snapshot a video frame -- never
// visible, but must be a real DOM node to expose a 2D rendering context.
export const StyledCameraCanvas = styled.canvas`
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
// directly, so the label carries the button look instead. Fallback-only:
// PhotoCapture reaches for this input only when a live in-browser camera
// isn't available (unsupported browser, insecure context, permission
// denied, no camera device).
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

export const StyledPhotoActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 1.2rem;
`;

// -- MeetingWizard (step shell) ---------------------------------------------

export const StyledWizardWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.6rem;
`;

export const StyledStepHeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.2rem;
`;

export const StyledStepEyebrow = styled.p`
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 1.2rem;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.orange[600]};
`;

export const StyledStepTitle = styled.h2`
  margin: 0;
  font-size: 2rem;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.navy[700]};
`;

export const StyledStepHint = styled.p`
  margin: 0;
  font-size: 1.4rem;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.navy[400]};
`;

export const StyledWizardError = styled.p`
  margin: 0;
  padding: 1.2rem 1.4rem;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  background-color: ${({ theme }) => theme.colors.red[100]};
  color: ${({ theme }) => theme.colors.red[700]};
  font-size: 1.4rem;
  font-weight: 600;
`;

export const StyledSummaryLine = styled.p`
  margin: 0;
  font-size: 1.4rem;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.navy[500]};
`;

// -- ProjectPicker ------------------------------------------------------------

export const StyledPickerList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
`;

export const StyledPickerCard = styled.li`
  display: flex;
  align-items: center;
  gap: 1.6rem;
  padding: 1.6rem;
  border: 0.1rem solid ${({ theme }) => theme.colors.navy[100]};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background-color: ${({ theme }) => theme.colors.concrete[100]};
`;

export const StyledPickerCardMain = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
`;

export const StyledPickerName = styled.h3`
  margin: 0;
  font-size: 1.6rem;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.navy[700]};
  overflow-wrap: anywhere;
`;

export const StyledPickerMeta = styled.p`
  margin: 0;
  font-size: 1.3rem;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.navy[400]};
`;

export const StyledPickerEmpty = styled.p`
  margin: 0;
  padding: 3.2rem 1.6rem;
  text-align: center;
  font-size: 1.5rem;
  font-weight: 500;
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.navy[400]};
`;

// -- TalkPresenter ------------------------------------------------------------

export const StyledPresenterWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.6rem;
`;

export const StyledPresenterSummary = styled.p`
  margin: 0;
  font-size: 1.5rem;
  font-weight: 500;
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.navy[600]};
`;

export const StyledPresenterSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.6rem;

  ul {
    margin: 0;
    padding-left: 1.8rem;
  }
`;

export const StyledPresenterSectionTitle = styled.h3`
  margin: 0;
  font-size: 1.4rem;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.navy[700]};
`;

export const StyledPresenterOshaLine = styled.p`
  margin: 0;
  font-size: 1.3rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.navy[500]};
`;

export const StyledPresenterAttribution = styled.p`
  margin: 0;
  font-size: 1.2rem;
  font-weight: 500;
  font-style: italic;
  color: ${({ theme }) => theme.colors.navy[400]};
`;

export const StyledAudioRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 1.2rem;
`;

export const StyledAudioNote = styled.p`
  margin: 0;
  font-size: 1.3rem;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.navy[400]};
`;

export const StyledPresenterActions = styled.div`
  display: flex;
  justify-content: flex-end;
`;

// -- SignaturesStep ------------------------------------------------------------

export const StyledSignersHeader = styled.p`
  margin: 0;
  font-size: 1.4rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.navy[600]};
`;

export const StyledSignersEmpty = styled.p`
  margin: 0;
  padding: 2.4rem 1.6rem;
  text-align: center;
  font-size: 1.4rem;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.navy[400]};
`;

export const StyledSignersList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
`;

export const StyledSignerCard = styled.li`
  display: flex;
  align-items: center;
  gap: 1.2rem;
  padding: 1.2rem 1.6rem;
  border: 0.1rem solid ${({ theme }) => theme.colors.navy[100]};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background-color: ${({ theme }) => theme.colors.concrete[100]};
`;

export const StyledSignerName = styled.span`
  flex: 1;
  min-width: 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.navy[700]};
  overflow-wrap: anywhere;
`;

export const StyledSignerBadge = styled.span`
  flex-shrink: 0;
  padding: 0.4rem 0.9rem;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  font-size: 1.2rem;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.navy[600]};
  background-color: ${({ theme }) => theme.colors.concrete[400]};
`;

export const StyledAddFlowWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.6rem;
`;

export const StyledStageActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 1.2rem;
  margin-top: 0.8rem;
`;
