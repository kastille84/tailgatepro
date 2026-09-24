// Pure, I/O-free planner for scripts/backfill-jobsites.js (docs/tasks.md 8d-g).
//
// Turns Phase 6 join-code links (projects.gc_company_id set, jobsite_id null)
// into real `jobsites` + accepted `jobsite_subcontractors` rows. Grouping uses
// the same normalizeJobsiteName key as the GC dashboard so the overview reads
// the same before and after. gc_company_id is never touched — it stays the
// authorization column, so no existing link can be stranded.
//
// Idempotent by construction: a project that already has a jobsite_id is
// skipped, an existing GC jobsite with the same normalized name is reused, and
// an existing (jobsite, sub company) membership is never duplicated.

const crypto = require("crypto");

const { normalizeJobsiteName } = require("../../server/utility/jobsiteGrouping");

// `invited_email` is NOT NULL and UNIQUE per jobsite, but a backfilled member
// was never emailed. Used when the sub has no admin email (pre-8a legacy data)
// or the admin's email is already taken on that jobsite. `.invalid` is a
// reserved TLD, so nothing can ever be delivered to it.
const placeholderEmail = (subCompanyId) =>
  `backfill+${subCompanyId}@backfill.invalid`;

// projects: rows with { id, owner_company_id, gc_company_id, name, created_at },
//   any order (re-sorted oldest-first here); rows that already have a
//   jobsite_id are ignored.
// existingJobsites: [{ id, gc_company_id, name }]
// existingSubRows: [{ jobsite_id, sub_company_id, invited_email }]
// adminEmailByCompany: Map<companyId, string | null>
const planBackfill = ({
  projects,
  existingJobsites = [],
  existingSubRows = [],
  adminEmailByCompany = new Map(),
  newId = () => crypto.randomUUID(),
  now = () => new Date().toISOString(),
}) => {
  const unlinked = projects
    .filter((p) => p.gc_company_id && !p.jobsite_id)
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));

  // (gc company, normalized name) -> jobsite id. Seeded oldest-first so the
  // earliest existing jobsite wins if a GC somehow has two with one name.
  const jobsiteIdByKey = new Map();
  for (const jobsite of existingJobsites) {
    const key = `${jobsite.gc_company_id}|${normalizeJobsiteName(jobsite.name)}`;
    if (!jobsiteIdByKey.has(key)) jobsiteIdByKey.set(key, jobsite.id);
  }

  const memberKeys = new Set(
    existingSubRows
      .filter((row) => row.sub_company_id)
      .map((row) => `${row.jobsite_id}|${row.sub_company_id}`),
  );
  const emailKeys = new Set(
    existingSubRows.map((row) => `${row.jobsite_id}|${row.invited_email}`),
  );

  const jobsitesToInsert = [];
  const subRowsToInsert = [];
  const projectUpdates = [];
  const acceptedAt = now();

  for (const project of unlinked) {
    const key = `${project.gc_company_id}|${normalizeJobsiteName(project.name)}`;

    let jobsiteId = jobsiteIdByKey.get(key);
    if (!jobsiteId) {
      jobsiteId = newId();
      jobsiteIdByKey.set(key, jobsiteId);
      // Oldest-first, so the first project in a group names the jobsite.
      jobsitesToInsert.push({
        id: jobsiteId,
        gc_company_id: project.gc_company_id,
        name: project.name,
      });
    }

    projectUpdates.push({ id: project.id, jobsite_id: jobsiteId });

    const memberKey = `${jobsiteId}|${project.owner_company_id}`;
    if (memberKeys.has(memberKey)) continue;
    memberKeys.add(memberKey);

    const adminEmail = adminEmailByCompany.get(project.owner_company_id);
    const email =
      adminEmail && !emailKeys.has(`${jobsiteId}|${adminEmail}`)
        ? adminEmail
        : placeholderEmail(project.owner_company_id);
    emailKeys.add(`${jobsiteId}|${email}`);

    subRowsToInsert.push({
      id: newId(),
      jobsite_id: jobsiteId,
      sub_company_id: project.owner_company_id,
      invited_email: email,
      token: null,
      expires_at: null,
      accepted_at: acceptedAt,
    });
  }

  return { jobsitesToInsert, subRowsToInsert, projectUpdates };
};

module.exports = { planBackfill, placeholderEmail };
