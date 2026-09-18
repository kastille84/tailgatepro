import styled from "styled-components";

export const StyledWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  width: 100%;
`;

// Mirrors ui_comps/form/Input.tsx's border/focus/error treatment so the pad
// reads as one more form control. Fixed height (rather than aspect-ratio)
// keeps a consistent, generous signing area on both a phone held in portrait
// and a tablet -- a signature needs more room than a line of text.
export const StyledCanvasFrame = styled.div<{
  $hasError?: boolean;
  $disabled?: boolean;
}>`
  width: 100%;
  height: 18rem;
  border: 0.1rem solid
    ${({ theme, $hasError }) =>
      $hasError ? theme.colors.red[500] : theme.colors.navy[200]};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background-color: ${({ theme }) => theme.colors.concrete[100]};
  opacity: ${({ $disabled }) => ($disabled ? 0.65 : 1)};
`;

export const StyledCanvas = styled.canvas`
  display: block;
  width: 100%;
  height: 100%;
  cursor: crosshair;
  /* Let signature_pad own touch gestures on the canvas instead of the
     browser trying to scroll/zoom the page while a worker is signing. */
  touch-action: none;
`;

export const StyledActions = styled.div`
  display: flex;
  justify-content: flex-end;
`;
