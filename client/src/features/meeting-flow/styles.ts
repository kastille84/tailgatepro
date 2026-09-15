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
// directly, so the label carries the button look instead.
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
