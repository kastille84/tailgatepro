import "styled-components";

const theme = {
  colors: {
    orange: {
      100: "var(--color-orange-100)",
      200: "var(--color-orange-200)",
      400: "var(--color-orange-400)",
      500: "var(--color-orange-500)",
      600: "var(--color-orange-600)",
      700: "var(--color-orange-700)",
      800: "var(--color-orange-800)",
    },
    navy: {
      100: "var(--color-navy-100)",
      200: "var(--color-navy-200)",
      400: "var(--color-navy-400)",
      500: "var(--color-navy-500)",
      600: "var(--color-navy-600)",
      700: "var(--color-navy-700)",
      800: "var(--color-navy-800)",
    },
    concrete: {
      100: "var(--color-concrete-100)",
      200: "var(--color-concrete-200)",
      400: "var(--color-concrete-400)",
      500: "var(--color-concrete-500)",
      600: "var(--color-concrete-600)",
      700: "var(--color-concrete-700)",
      800: "var(--color-concrete-800)",
    },
    red: {
      100: "var(--color-red-100)",
      200: "var(--color-red-200)",
      400: "var(--color-red-400)",
      500: "var(--color-red-500)",
      600: "var(--color-red-600)",
      700: "var(--color-red-700)",
      800: "var(--color-red-800)",
    },
    green: {
      0: "var(--color-green-0)",
      50: "var(--color-green-50)",
      100: "var(--color-green-100)",
      200: "var(--color-green-200)",
      500: "var(--color-green-500)",
      600: "var(--color-green-600)",
      700: "var(--color-green-700)",
      800: "var(--color-green-800)",
      900: "var(--color-green-900)",
    },
  },

  backdrop: "var(--backdrop-color)",

  shadows: {
    sm: "var(--shadow-sm)",
    md: "var(--shadow-md)",
    lg: "var(--shadow-lg)",
  },

  borderRadius: {
    tiny: "var(--border-radius-tiny)",
    sm: "var(--border-radius-sm)",
    md: "var(--border-radius-md)",
    lg: "var(--border-radius-lg)",
  },
  breakpoints: {
    xs: '320px',
    sm: '480px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },
} as const;

export type Theme = typeof theme;

declare module "styled-components" {
  export interface DefaultTheme extends Theme {}
}

export default theme;
