// Pure, I/O-free: builds a series of consecutive single-calendar-day windows
// ending on the client's local "today" (Phase 9e, docs/sub-scorecard-design.md
// "Scoring model"). Reuses dayWindow's date/tzOffset validation and its
// single-day anchor math rather than duplicating either, then walks backward
// in whole 24h increments -- safe once "today" is anchored to a specific UTC
// instant, since a calendar day is always exactly 24h in that arithmetic
// (the client-local wall-clock DST question dayWindow already resolved once,
// at the anchor).
const { dayWindow } = require("./dayWindow");

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

module.exports = { rollingDayWindows };
