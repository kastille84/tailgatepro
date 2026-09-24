// Pure, I/O-free: the name key used to match a project name to a GC's existing
// jobsite when a join-code link find-or-creates one (services/projects.js
// linkGc) and when the 8d-g backfill groups legacy links. Deliberately fuzzy —
// "Riverside Tower" and "Riverside Twr" are different keys; the GC-owned
// jobsite row, not this function, is the source of truth.

// Trim, collapse internal whitespace, lowercase.
const normalizeJobsiteName = (name) =>
  (name ?? "").trim().replace(/\s+/g, " ").toLowerCase();

module.exports = { normalizeJobsiteName };
