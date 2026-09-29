// Pure, I/O-free: builds a series of consecutive single-calendar-day windows
// ending on the client's local "today" (Phase 9e, docs/sub-scorecard-design.md
// "Scoring model"). Reuses dayWindow's date/tzOffset validation and its
// single-day anchor math rather than duplicating either, then walks backward
// in whole 24h increments -- safe once "today" is anchored to a specific UTC
// instant, since a calendar day is always exactly 24h in that arithmetic
// (the client-local wall-clock DST question dayWindow already resolved once,
// at the anchor).
const { dayWindow, weekWindow } = require("./dayWindow");

const DAY_MS = 24 * 60 * 60 * 1000;

// `days` consecutive half-open day windows, oldest first, the last one being
// today's own dayWindow({ date, tzOffset }).
const rollingDayWindows = ({ date, tzOffset, days }) => {
  const today = dayWindow({ date, tzOffset });
  const todayStartMs = new Date(today.start).getTime();

  const windows = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const startMs = todayStartMs - i * DAY_MS;
    windows.push({
      start: new Date(startMs).toISOString(),
      end: new Date(startMs + DAY_MS).toISOString(),
    });
  }
  return windows;
};

// The windows a scorecard scores against, one per period, oldest first. Daily
// is `rollingDayWindows`. Weekly is every Mon-Sun week overlapping the same
// `days`-day range (the oldest may start before the range does), ending on the
// week containing "today" -- the same span of history, counted in weeks.
const rollingPeriodWindows = ({ date, tzOffset, days, cadence }) => {
  const dayWindows = rollingDayWindows({ date, tzOffset, days });
  if (cadence !== "weekly") return dayWindows;

  const rangeStartMs = new Date(dayWindows[0].start).getTime();
  const current = weekWindow({ date, tzOffset });
  const windows = [current];
  let startMs = new Date(current.start).getTime();
  while (startMs > rangeStartMs) {
    startMs -= 7 * DAY_MS;
    windows.unshift({
      start: new Date(startMs).toISOString(),
      end: new Date(startMs + 7 * DAY_MS).toISOString(),
    });
  }
  return windows;
};

module.exports = { rollingDayWindows, rollingPeriodWindows };
