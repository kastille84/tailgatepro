import styled from "styled-components";

// Mirrors ui_comps/form/Input.tsx's border/focus/error treatment so the
// editor reads as one more form control, not a foreign widget. No
// placeholder text: ProseMirror renders an "empty" paragraph with a trailing
// <br>, so a plain CSS :empty::before doesn't match it without pulling in
// the separate @tiptap/extension-placeholder package — FormField's `hint`
// prop carries the "press Enter for a new line" guidance instead.
export const StyledEditorWrapper = styled.div<{ $hasError?: boolean }>`
  width: 100%;
  min-height: 4.8rem;
  padding: 0.6rem 1.4rem;
  border: 0.1rem solid
    ${({ theme, $hasError }) =>
      $hasError ? theme.colors.red[500] : theme.colors.navy[200]};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background-color: ${({ theme }) => theme.colors.concrete[100]};
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;

  &:focus-within {
    border-color: ${({ theme, $hasError }) =>
      $hasError ? theme.colors.red[500] : theme.colors.green[500]};
    box-shadow: 0 0 0 0.3rem
      ${({ $hasError }) =>
        $hasError ? "rgba(211, 47, 47, 0.15)" : "rgba(85, 161, 102, 0.15)"};
  }

  .ProseMirror {
    outline: none;
    font-size: 1.6rem;
    line-height: 1.5;
    color: ${({ theme }) => theme.colors.navy[700]};

    ul {
      margin: 0;
      padding-left: 2rem;
    }

    li {
      margin: 0.4rem 0;
    }

    p {
      margin: 0;
    }
  }
`;
