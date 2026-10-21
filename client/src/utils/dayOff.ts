// Calendar-date helpers for "Mark day off" (docs/no-work-days-design.md). A day
// off is a plain local calendar date (`YYYY-MM-DD`), never a timestamp, so all
// arithmetic here is done on UTC midnights to stay clear of DST and time zones.

/** How far back / ahead a day off may be marked. The server enforces the same
 *  range (with a day of slack for time zones); this keeps the picker inside it. */
export const DAYS_BACK = 7;
export const DAYS_AHEAD = 14;

const pad = (value: number): string => String(value).padStart(2, "0");

/** The device's local calendar date as `YYYY-MM-DD`. */
export const toLocalDateString = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const utcMidnight = (date: string): Date => new Date(`${date}T00:00:00.000Z`);

export const addDays = (date: string, days: number): string => {
  const shifted = utcMidnight(date);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
};

/** Saturdays and Sundays are never required, so they can't be marked off. */
export const isWeekendDate = (date: string): boolean => {
  const day = utcMidnight(date).getUTCDay();
  return day === 0 || day === 6;
};

/** The earliest and latest date the picker allows, given today's local date. */
export const dayOffRange = (today: string): { min: string; max: string } => ({
  min: addDays(today, -DAYS_BACK),
  max: addDays(today, DAYS_AHEAD),
});

/** "Thu, Nov 26" — the date as written on the confirm button and the list. */
export const formatDayOff = (date: string): string =>
  utcMidnight(date).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
