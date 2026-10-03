// Pure, I/O-free: the wall clock of an IANA time zone at a UTC instant, used
// to decide "is it Monday 7:00 AM at this job site right now" for the SMS
// nudge (docs/sms-nudges-design.md). Returns null for an unknown zone instead
// of throwing, so one bad `jobsites.timezone` can't abort a whole tick.
const formatters = new Map();

const formatterFor = (timeZone) => {
  if (!formatters.has(timeZone)) {
    formatters.set(
      timeZone,
      new Intl.DateTimeFormat("en-US", {
        timeZone,
        hourCycle: "h23",
        weekday: "short",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "numeric",
      }),
    );
  }
  return formatters.get(timeZone);
};

// { date: 'YYYY-MM-DD', weekday: 'Mon'..'Sun', hour: 0-23 } or null.
const localParts = (now, timeZone) => {
  let parts;
  try {
    parts = formatterFor(timeZone).formatToParts(now);
  } catch (error) {
    return null;
  }
  const byType = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return {
    date: `${byType.year}-${byType.month}-${byType.day}`,
    weekday: byType.weekday,
    hour: Number(byType.hour),
  };
};

// True for a non-empty IANA zone name the runtime recognises.
const isValidTimeZone = (value) =>
  typeof value === "string" && value.length > 0 && value.length <= 64 && localParts(new Date(), value) !== null;

module.exports = { localParts, isValidTimeZone };
