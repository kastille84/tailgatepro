# UI Styling

## Styled-Components

### Core Styling Principles (styled-components)

- **No Inline Styles:** Never use `style={{...}}`. All styling must use `styled-components`.
- **Theming Only:** Never hardcode colors, spacing, or breakpoints. Use `props.theme`.
- **TypeScript Types:** All theme props must be strictly typed using styled-components declarations.

### Component & Styling Structure

- **File Pairing:** Keep styles in the same directory as the component. Use a `.styles.ts` file or define them at the bottom of the component file if short (< 30 lines).
- **Naming Convention:** Prefix styled elements with `Styled` to clearly separate them from standard React components (e.g., `StyledButton` wrapping a functional `Button`).

### CSS & Prop Guidelines

- **Transient Props:** Prefix props used _only_ for styling with a `$` to prevent them from flushing to the DOM (e.g., `<StyledCard $isActive={true} />`).
- **Prop Destructuring:** Always destructure `theme` and custom props inside the template literal for readability.
- **Nesting & Nesting Depth:** Limit CSS nesting to 3 levels deep. Use ampersand (`&`) for pseudo-classes (`&:hover`, `&:focus`).

### Code Examples

#### 1. Declaring a Styled Component with Transient Props

```tsx
import styled from 'styled-components';

interface StyledContainerProps {
  \(variant: 'primary' \vert{} 'secondary';\)isExpanded?: boolean;
}

export const StyledContainer = styled.div<StyledContainerProps>`
  display: flex;
  padding: ${({ theme }) => theme.spacing.md};
  background-color: ${({ theme, $variant }) =>
    $variant === 'primary' ? theme.colors.primary : theme.colors.secondary};

  height: ${({ $isExpanded }) => ($isExpanded ? 'auto' : '150px')};
  transition: height 0.2s ease-in-out;

  &:hover {
    filter: brightness(0.95);
  }

  @media (${({ theme }) => theme.breakpoints.desktop}) {
    padding: ${({ theme }) => theme.spacing.lg};
  }
`;
```

#### 2. Extending Existing Components

```tsx
import styled from "styled-components";
import { StyledButton } from "./Button.styles";

export const StyledIconButton = styled(StyledButton)`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
`;
```

### Theme Reference Structure

Ensure your implementations hook directly into our typed theme interface:

- `theme.colors` (primary, secondary, background, surface, text, error)
- `theme.spacing` (xs: 4px, sm: 8px, md: 16px, lg: 24px, xl: 32px)
- `theme.breakpoints` (mobile, tablet, desktop)
- `theme.typography` (fontSizes, fontWeights)

## Construction Considerations

**Important** when creating pages and ui components, take into account that construction sites need high contrast and bigger clickable areas to click on components as they will most likely be on the job site while interacting with our app using their thick dirty gloves instead of their actual fingers.
