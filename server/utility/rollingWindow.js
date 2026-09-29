// Pure, I/O-free: builds a series of consecutive single-calendar-day windows
// ending on the client's local "today" (Phase 9e, docs/sub-scorecard-design.md
// "Scoring model"). Reuses dayWindow's date/tzOffset/timeZone validation and
// walks back by whole *calendar* days/weeks (never a flat 24h), so with a
// `timeZone` a range crossing a DST transition keeps contiguous, real-midnight
// windows (one of them 23h or 25h). Without `timeZone` it is the flat-offset
// fallback, where every day is 24h.
const { dayWindow, weekWindow } = require("./dayWindow");

// `days` consecutive half-open day windows, oldest first, the last one being
// today's own dayWindow({ date, tzOffset }).
const rollingDayWindows = ({ date, tzOffset, timeZone, days }) => {
  const windows = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    windows.push(dayWindow({ date, tzOffset, timeZone }, -i));
  }
  return windows;
};

// The windows a scorecard scores against, one per period, oldest first. Daily
// is `rollingDayWindows`. Weekly is every Mon-Sun week overlapping the same
// `days`-day range (the oldest may start before the range does), ending on the
// week containing "today" -- the same span of history, counted in weeks.
const rollingPeriodWindows = ({ date, tzOffset, timeZone, days, cadence }) => {
  const dayWindows = rollingDayWindows({ date, tzOffset, timeZone, days });
  if (cadence !== "weekly") return dayWindows;

  const rangeStartMs = new Date(dayWindows[0].start).getTime();
  const windows = [weekWindow({ date, tzOffset, timeZone })];
  while (new Date(windows[0].start).getTime() > rangeStartMs) {
    windows.unshift(weekWindow({ date, tzOffset, timeZone }, -windows.length));
  }
  return windows;
};

module.exports = { rollingDayWindows, rollingPeriodWindows };
