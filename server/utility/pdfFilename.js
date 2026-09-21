// Pure, I/O-free filename formatting — no Express, no Supabase. Same category
// as composeTalkMarkdown.js: written once so it can be reused by every
// caller that needs a human-friendly name for a meeting log's generated PDF,
// not just the single-file signed-URL endpoint that uses it today. The
// planned "OSHA Defense Bundle" ZIP export (docs/pricing-and-positioning-strategy_V2.md,
// not built yet) should reuse this for each entry's name rather than
// reinventing naming.

const slugify = (text) =>
  (text ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

// Builds a friendly download filename:
// {company-slug}-{project-slug}-{date}-{shortId}.pdf. The company (the
// reporting subcontractor, not the GC) comes first — a GC managing several
// subs on one site files/sorts OSHA paperwork by contractor first, and it's
// also how multiple PDFs sort alphabetically in one folder or a future ZIP
// bundle. The short id (the meeting log's own id, hyphens stripped, first 8
// chars) guarantees uniqueness even when the same company completes
// multiple talks for the same project on the same day — company + project +
// date alone can still collide.
//
// `meetingDate` is an ISO timestamp for when the meeting was held (the meeting
// log's `heldAt`, not the server-receipt `completedAt` — an offline meeting
// synced the next day must be filed under the day it actually happened). Its
// first 10 characters are the UTC calendar date.
const buildPdfFilename = ({ companyName, projectName, meetingDate, meetingLogId }) => {
  const companySlug = slugify(companyName) || "company";
  const projectSlug = slugify(projectName) || "project";
  const date = meetingDate ? meetingDate.slice(0, 10) : "undated";
  const shortId = meetingLogId.replace(/-/g, "").slice(0, 8);
  return `${companySlug}-${projectSlug}-${date}-${shortId}.pdf`;
};

module.exports = { buildPdfFilename };
