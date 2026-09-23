// Pure, I/O-free: groups a GC's linked projects into "jobsites" by name
// (docs/gc-dashboard-design.md "Jobsite grouping"). Deliberately fuzzy — there
// is no GC-owned canonical jobsite yet, so this is a display convenience, not
// a real entity. "Riverside Tower" and "Riverside Twr" stay two jobsites; a
// future GC-owned jobsite model is the fix for that, not this function.

// Trim, collapse internal whitespace, lowercase.
const normalizeJobsiteName = (name) =>
  (name ?? "").trim().replace(/\s+/g, " ").toLowerCase();

// `projects` must already be ordered oldest-first (e.g. `created_at` asc) so
// each group's display name is deterministically its earliest row's original
// spelling. Returns groups sorted by that display name.
const groupProjectsIntoJobsites = (projects) => {
  const groups = new Map();

  for (const project of projects) {
    const key = normalizeJobsiteName(project.name);
    const group = groups.get(key);
    if (group) {
      group.projects.push(project);
    } else {
      groups.set(key, { name: project.name, projects: [project] });
    }
  }

  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
};

module.exports = { normalizeJobsiteName, groupProjectsIntoJobsites };
