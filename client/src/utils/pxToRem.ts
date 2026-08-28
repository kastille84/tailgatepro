/**
 * Convert a px value to rem string using a 10px base (1rem = 10px).
 * Example: pxToRem(16) -> '1.6rem'
 */
export const pxToRem = (px: number | string, base = 10): string => {
  const value = typeof px === "string" ? parseFloat(px.replace("px", "")) : px;
  return `${value / base}rem`;
};

export default pxToRem;
