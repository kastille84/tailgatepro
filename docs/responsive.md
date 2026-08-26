# Mobile-First & Responsiveness Standards

## Core Principle: Mobile-First Architecture

- **Default to Mobile:** All base CSS rules must target mobile devices first. Do not wrap mobile layouts in media queries.
- **Scale Upwards:** Use **`min-width`** queries exclusively to scale layouts up for tablet and desktop viewports.
- **Zero Max-Width Queries:** Avoid `max-width` media queries unless building an explicit structural exclusion zone (e.g., mobile-only elements).

## Breakpoint Definitions

Our standardized viewports are configured as absolute `min-width` anchors:

- **Mobile (Base):** Up to `767px` (Captured by root/default styling)
- **Tablet:** `768px` (Sm/Md tablets, foldables, large portrait viewports)
- **Desktop:** `1024px` (Laptops, standard monitors)
- **Widescreen:** `1440px` (Large desktop monitors, ultra-wides)

## Implementation (styled-components)

- **Theme References:** Always source breakpoint widths from `props.theme.breakpoints`. Never hardcode raw pixel strings into media blocks.
- **Fluid Layouts:** Prioritize Flexbox, CSS Grid, and fluid units (`vh`, `vw`, `rem`, `clamp()`) over strict pixel dimensions.
- **Touch-Target Safe:** Interactive mobile elements must maintain a minimum touch target size of **48px x 48px** with adequate padding.

## Code Examples

### 1. Standard Mobile-First Component Stack

```tsx
import styled from "styled-components";

export const StyledCard = styled.div`
  /* 📱 MOBILE (Base Styles) */
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.md};
  width: 100%;

  /* 📑 TABLET (768px+) */
  @media (${({ theme }) => theme.breakpoints.tablet}) {
    flex-direction: row;
    gap: ${({ theme }) => theme.spacing.md};
  }

  /* 💻 DESKTOP (1024px+) */
  @media (${({ theme }) => theme.breakpoints.desktop}) {
    padding: ${({ theme }) => theme.spacing.lg};
    max-width: 1200px;
    margin: 0 auto;
  }
`;
```

### 2. Mobile-Only Exclusion (The Exception Rule)

If a component must _only_ exist on mobile and completely vanish on tablet, isolate it explicitly using a `max-width` token to prevent leakages:

```tsx
export const MobileOnlyBanner = styled.div`
  display: block;

  @media (min-width: 768px) {
    display: none;
  }
`;
```

## Responsive Checklist for Code Reviews

- Does the code use `min-width` instead of `max-width`?
- Do text inputs automatically scale or use `16px` font size on mobile to prevent iOS auto-zoom?
- Is text wrap and overflow truncation gracefully managed on small `320px` viewports?
- Are layout grids changing columns reactively (e.g., `grid-template-columns: 1fr;` switching to `repeat(3, 1fr)`)?
