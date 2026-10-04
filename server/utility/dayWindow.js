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

const formatters = new Map();

// Cached Intl formatter for an IANA zone; throws AppError 400 for an unknown one.
const zoneFormatter = (timeZone) => {
  if (!formatters.has(timeZone)) {
    try {
      formatters.set(
        timeZone,
        new Intl.DateTimeFormat("en-US", {
          timeZone,
          hourCycle: "h23",
          year: "numeric",
          month: "numeric",
          day: "numeric",
          hour: "numeric",
          minute: "numeric",
          second: "numeric",
        }),
      );
    } catch (error) {
      throw new AppError("timeZone must be a valid IANA time zone", 400, { cause: error });
    }
  }
  return formatters.get(timeZone);
};

// The zone's wall clock at UTC instant `ms`, read back as if it were UTC.
const wallClockAsUtcMs = (ms, timeZone) => {
  const parts = {};
  zoneFormatter(timeZone)
    .formatToParts(new Date(ms))
    .forEach(({ type, value }) => {
      parts[type] = Number(value);
    });
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
};

// Zone offset from UTC in ms (positive = east of UTC) at UTC instant `ms`.
const zoneOffsetMs = (ms, timeZone) => {
  const wholeSecondMs = Math.floor(ms / 1000) * 1000;
  return wallClockAsUtcMs(wholeSecondMs, timeZone) - wholeSecondMs;
};

// The first UTC instant at which the zone's wall clock reads at or after
// 00:00 on the calendar day whose UTC midnight is `dayUtcMs`. That is the true
// local midnight, which lands an hour off a flat 24h on DST days. Trying the
// offsets on either side of the day and keeping the earliest valid instant also
// covers zones whose DST jump skips or repeats midnight itself.
const zonedMidnightMs = (dayUtcMs, timeZone) => {
  const candidates = [
    dayUtcMs - zoneOffsetMs(dayUtcMs - DAY_MS, timeZone),
    dayUtcMs - zoneOffsetMs(dayUtcMs + DAY_MS, timeZone),
  ];
  return Math.min(...candidates.filter((ms) => wallClockAsUtcMs(ms, timeZone) >= dayUtcMs));
};

// Validates the client's local date + offset (+ optional IANA zone) and returns
// the calendar day's UTC-midnight anchor and a function that maps any calendar
// day (as a UTC-midnight anchor) to that day's local midnight in UTC. With
// `timeZone` it is DST-exact; without, it falls back to the flat `tzOffset`.
const localMidnightMs = ({ date, tzOffset, timeZone }) => {
  const match = DATE_PATTERN.exec(date ?? "");
  if (!match) {
    throw new AppError("date must be in YYYY-MM-DD format", 400);
  }
  if (!Number.isInteger(tzOffset) || Math.abs(tzOffset) > MAX_TZ_OFFSET_MINUTES) {
    throw new AppError("tzOffset must be minutes between -840 and 840", 400);
  }
  if (timeZone) zoneFormatter(timeZone);

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

  const toLocalMidnight = timeZone
    ? (dayUtcMs) => zonedMidnightMs(dayUtcMs, timeZone)
    : (dayUtcMs) => dayUtcMs + tzOffset * 60 * 1000;

  return { midnightUtcMs, toLocalMidnight };
};

// Half-open UTC range of the local calendar day `date` (+ `dayOffset` whole
// calendar days), end being the next local midnight -- 23h or 25h on a DST day.
const dayWindow = ({ date, tzOffset, timeZone }, dayOffset = 0) => {
  const { midnightUtcMs, toLocalMidnight } = localMidnightMs({ date, tzOffset, timeZone });
  const dayMs = midnightUtcMs + dayOffset * DAY_MS;
  return {
    start: new Date(toLocalMidnight(dayMs)).toISOString(),
    end: new Date(toLocalMidnight(dayMs + DAY_MS)).toISOString(),
  };
};

// The Monday-to-Sunday local calendar week containing `date` (+ `weekOffset`
// whole weeks), as the same half-open UTC range (meeting cadence "weekly",
// docs/gc-dashboard-design.md). The weekday comes from the calendar date itself
// (`getUTCDay` on the UTC midnight of that date), and both edges are real local
// midnights, so a DST-spanning week is 167h or 169h.
const weekWindow = ({ date, tzOffset, timeZone }, weekOffset = 0) => {
  const { midnightUtcMs, toLocalMidnight } = localMidnightMs({ date, tzOffset, timeZone });
  const daysSinceMonday = (new Date(midnightUtcMs).getUTCDay() + 6) % 7;
  const weekStartUtcMs = midnightUtcMs + (weekOffset * 7 - daysSinceMonday) * DAY_MS;
  return {
    start: new Date(toLocalMidnight(weekStartUtcMs)).toISOString(),
    end: new Date(toLocalMidnight(weekStartUtcMs + 7 * DAY_MS)).toISOString(),
  };
};

module.exports = { dayWindow, weekWindow };
