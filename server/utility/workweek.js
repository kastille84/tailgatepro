// Pure, I/O-free: calendar-date helpers for the Mon-Fri working week a daily
// cadence expects (docs/no-work-days-design.md). A "date" is the client's local
// calendar day as `YYYY-MM-DD` -- the weekday comes from the date itself
// (`getUTCDay` on its UTC midnight, the same trick `weekWindow` uses), so the
// server never guesses a timezone. Callers pass dates already validated by
// `dayWindow`.

const utcMidnight = (date) => new Date(`${date}T00:00:00.000Z`);

// 0 = Sunday ... 6 = Saturday.
const dayOfWeek = (date) => utcMidnight(date).getUTCDay();

const isWeekend = (date) => {
  const day = dayOfWeek(date);
  return day === 0 || day === 6;
};

// The calendar date `deltaDays` whole days from `date` (negative = earlier).
const shiftDate = (date, deltaDays) => {
  const shifted = utcMidnight(date);
  shifted.setUTCDate(shifted.getUTCDate() + deltaDays);
  return shifted.toISOString().slice(0, 10);
};

module.exports = { dayOfWeek, isWeekend, shiftDate };
