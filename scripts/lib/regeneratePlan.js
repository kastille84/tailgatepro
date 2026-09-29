// Pure, I/O-free helpers for scripts/regenerate-pdfs.js (docs/tasks.md 11e).

const USAGE =
  "Usage: node scripts/regenerate-pdfs.js [--apply] [--id <uuid>] [--company <uuid>] [--since <ISO date>] [--limit <n>]";

const VALUE_FLAGS = { "--id": "id", "--company": "company", "--since": "since", "--limit": "limit" };

// Returns { apply, id, company, since, limit } (unset filters are null).
// Throws on an unknown flag, a missing value, or an invalid --since/--limit.
const parseArgs = (argv) => {
  const options = { apply: false, id: null, company: null, since: null, limit: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--apply") {
      options.apply = true;
    } else if (VALUE_FLAGS[arg]) {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new Error(`${arg} needs a value. ${USAGE}`);
      }
      options[VALUE_FLAGS[arg]] = value;
      i += 1;
    } else {
      throw new Error(`Unknown argument "${arg}". ${USAGE}`);
    }
  }
  if (options.since !== null && Number.isNaN(new Date(options.since).getTime())) {
    throw new Error(`--since must be an ISO date. ${USAGE}`);
  }
  if (options.limit !== null) {
    const limit = Number(options.limit);
    if (!Number.isInteger(limit) || limit < 1) {
      throw new Error(`--limit must be a positive integer. ${USAGE}`);
    }
    options.limit = limit;
  }
  return options;
};

// Only completed meetings that already have a PDF are regenerated — a
// PDF-pending meeting is enqueue()'s job, not a "regeneration". Oldest first,
// filtered and capped per the parsed options.
const selectMeetings = (rows, { id, company, since, limit }) => {
  const sinceMs = since ? new Date(since).getTime() : null;
  const selected = rows
    .filter((row) => row.completed_at && row.final_pdf_url)
    .filter((row) => (id ? row.id === id : true))
    .filter((row) => (company ? row.company_id === company : true))
    .filter((row) => (sinceMs === null ? true : new Date(row.completed_at).getTime() >= sinceMs))
    .sort((a, b) => new Date(a.completed_at) - new Date(b.completed_at));
  return limit ? selected.slice(0, limit) : selected;
};

module.exports = { parseArgs, selectMeetings };
