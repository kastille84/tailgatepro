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
const buildPdfFilename = ({ companyName, projectName, completedAt, meetingLogId }) => {
  const companySlug = slugify(companyName) || "company";
  const projectSlug = slugify(projectName) || "project";
  const date = completedAt ? completedAt.slice(0, 10) : "undated";
  const shortId = meetingLogId.replace(/-/g, "").slice(0, 8);
  return `${companySlug}-${projectSlug}-${date}-${shortId}.pdf`;
};

module.exports = { buildPdfFilename };
