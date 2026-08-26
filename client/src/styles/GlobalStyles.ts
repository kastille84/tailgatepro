import { createGlobalStyle } from "styled-components";
/**
- Font sizes (px)
10 / 12 / 14 / 16 / 18 / 20 / 24 / 30 / 36 / 44 / 52 / 62 / 74 / 86 / 98

Font-weights:

Line-heights:

Letter Spacing:

- Spacing system (px)
2 / 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 80 / 96 / 128

 */

const GlobalStyles = createGlobalStyle`
:root {

/* Safety Orange */
  --color-orange-100: #fff0e8;
  --color-orange-200: #ffd9c6;
  --color-orange-400: #ff8c54;
  --color-orange-500: #ff5f15;
  --color-orange-600: #e64a00;
  --color-orange-700: #b33a00;
  --color-orange-800: #802a00;

  /* Navy Steel */
  --color-navy-100: #e8ebed;
  --color-navy-200: #c6cdd4;
  --color-navy-400: #738699;
  --color-navy-500: #1a2a3a;
  --color-navy-600: #14222e;
  --color-navy-700: #0f1922;
  --color-navy-800: #0a1117;

  /* Concrete Light */
  --color-concrete-100: #ffffff;
  --color-concrete-200: #fafafb;
  --color-concrete-400: #f7f8f9;
  --color-concrete-500: #f4f5f7;
  --color-concrete-600: #dadddf;
  --color-concrete-700: #bfc3c8;
  --color-concrete-800: #9fa5ac;

  /* Alert Red */
  --color-red-100: #fbeaea;
  --color-red-200: #f5caca;
  --color-red-400: #e57777;
  --color-red-500: #d32f2f;
  --color-red-600: #b92929;
  --color-red-700: #942121;
  --color-red-800: #6a1818;

  --color-green-0: #eaf3ec;
  --color-green-50: #d5e8d9;
  --color-green-100: #aad0b3;
  --color-green-200: #80b98c;
  --color-green-500: #55a166;
  --color-green-600: #2B8A40;
  --color-green-700: #226e33;
  --color-green-800: #1a5326;
  --color-green-900: #11371a;

  --backdrop-color: rgba(255, 255, 255, 0.1);
  
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04);
  --shadow-md: 0px 0.6rem 2.4rem rgba(0, 0, 0, 0.06);
  --shadow-lg: 0 2.4rem 3.2rem rgba(0, 0, 0, 0.12);

  --border-radius-tiny: 3px;
  --border-radius-sm: 5px;
  --border-radius-md: 7px;
  --border-radius-lg: 9px;
}

*,
*::before,
*::after {
  box-sizing: border-box;
  padding: 0;
  margin: 0;
}

body {
  font-family: "Montserrat", sans-serif;
  color: var(--color-navy-500);
  line-height: 1.5;
  font-optical-sizing: auto;
  font-weight: 600;
  font-style: normal;
}`;

export default GlobalStyles;
