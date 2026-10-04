const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** True for a `YYYY-MM` string with a real month (01-12). */
export const isValidMonth = (month: string | null): month is string =>
  month !== null && MONTH_PATTERN.test(month);

/** "September 2026" for `2026-09`, in the viewer's locale. */
export const formatMonth = (month: string) => {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(year, monthNumber - 1, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
};

/** The `[from, to)` ISO bounds of a `YYYY-MM` month at *local* midnight, so a
 *  meeting held late on the 30th still lands in that month for the viewer. */
export const monthRange = (month: string) => {
  const [year, monthNumber] = month.split("-").map(Number);
  return {
    from: new Date(year, monthNumber - 1, 1).toISOString(),
    to: new Date(year, monthNumber, 1).toISOString(),
  };
};
