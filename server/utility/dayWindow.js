// Pure, I/O-free: turns a client's local calendar date into the half-open UTC
// range `[start, end)` that compliance windows and the GC meetings filter use
// (docs/gc-dashboard-design.md "The 'today' boundary"). The server never
// guesses a timezone — the client sends its local `date` (`YYYY-MM-DD`) and
// `tzOffset` (minutes, same sign as `Date#getTimezoneOffset`: UTC minus
// local, e.g. +300 for US Eastern, -120 for Central Europe).
const { AppError } = require("./AppError");

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_TZ_OFFSET_MINUTES = 14 * 60;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const dayWindow = ({ date, tzOffset }) => {
  const match = DATE_PATTERN.exec(date ?? "");
  if (!match) {
    throw new AppError("date must be in YYYY-MM-DD format", 400);
  }
  if (!Number.isInteger(tzOffset) || Math.abs(tzOffset) > MAX_TZ_OFFSET_MINUTES) {
    throw new AppError("tzOffset must be minutes between -840 and 840", 400);
  }

  const [, yearStr, monthStr, dayStr] = match;
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const midnightUtcMs = Date.UTC(year, month - 1, day);

  // Date.UTC silently rolls an impossible day (e.g. Feb 31) into the next
  // month, so round-trip it to confirm the input was a real calendar date.
  const roundTrip = new Date(midnightUtcMs);
  if (
    roundTrip.getUTCFullYear() !== year ||
    roundTrip.getUTCMonth() !== month - 1 ||
    roundTrip.getUTCDate() !== day
  ) {
    throw new AppError("date must be a real calendar date", 400);
  }

  const startMs = midnightUtcMs + tzOffset * 60 * 1000;
  return {
    start: new Date(startMs).toISOString(),
    end: new Date(startMs + DAY_MS).toISOString(),
  };
};

module.exports = { dayWindow };
