// One-shot backfill for Phase 8d-g (docs/tasks.md): turns existing Phase 6
// join-code links (projects.gc_company_id set, jobsite_id null) into real
// `jobsites` rows plus an accepted `jobsite_subcontractors` member per sub
// company, then points each project at its jobsite. Grouping matches the GC
// dashboard's (normalizeJobsiteName), so GET /api/gc/overview is unchanged.
// projects.gc_company_id is never modified.
//
// Idempotent: projects that already have a jobsite_id are skipped, existing
// GC jobsites with the same normalized name are reused, existing memberships
// are never duplicated — re-running reports 0 changes. Writes go jobsites →
// members → projects, so a partial failure just re-plans the remainder.
//
// Dry-run by default; nothing is written without --apply. Never sends email.
//
// Usage (from repo root):  node scripts/backfill-jobsites.js [--apply]
// Requires the root .env with SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY and the
// jobsites / jobsite_subcontractors / projects.jobsite_id DDL already applied.

require("dotenv").config();

const { supabase } = require("../server/utility/supabaseClient");
const { getAdminEmail } = require("../server/services/users");
const { planBackfill } = require("./lib/backfillPlan");

const CHUNK = 500;

const must = ({ data, error }, what) => {
  if (error) throw new Error(`${what}: ${error.message}`, { cause: error });
  return data;
};

const chunks = (rows) => {
  const out = [];
  for (let i = 0; i < rows.length; i += CHUNK) out.push(rows.slice(i, i + CHUNK));
  return out;
};

const insertAll = async (table, rows) => {
  for (const chunk of chunks(rows)) {
    must(await supabase.from(table).insert(chunk), `insert into ${table}`);
  }
};

const main = async () => {
  const apply = process.argv.includes("--apply");

  const projects = must(
    await supabase
      .from("projects")
      .select("id, owner_company_id, gc_company_id, jobsite_id, name, created_at")
      .not("gc_company_id", "is", null)
      .is("jobsite_id", null)
      .order("created_at", { ascending: true }),
    "load linked projects",
  );
  const existingJobsites = must(
    await supabase.from("jobsites").select("id, gc_company_id, name, created_at").order("created_at", { ascending: true }),
    "load jobsites",
  );
  const existingSubRows = must(
    await supabase.from("jobsite_subcontractors").select("jobsite_id, sub_company_id, invited_email"),
    "load jobsite members",
  );

  const subCompanyIds = [...new Set(projects.map((p) => p.owner_company_id))];
  const adminEmailByCompany = new Map();
  for (const companyId of subCompanyIds) {
    adminEmailByCompany.set(companyId, await getAdminEmail(companyId));
  }

  const { jobsitesToInsert, subRowsToInsert, projectUpdates } = planBackfill({
    projects,
    existingJobsites,
    existingSubRows,
    adminEmailByCompany,
  });

  console.log(
    `${apply ? "Applying" : "Dry run (pass --apply to write)"}: ` +
      `${jobsitesToInsert.length} jobsites, ${subRowsToInsert.length} members, ` +
      `${projectUpdates.length} projects to link`,
  );
  if (!apply) return;

  await insertAll("jobsites", jobsitesToInsert);
  await insertAll("jobsite_subcontractors", subRowsToInsert);

  // One UPDATE per jobsite (all its projects share the same value).
  const idsByJobsite = new Map();
  for (const { id, jobsite_id } of projectUpdates) {
    idsByJobsite.set(jobsite_id, [...(idsByJobsite.get(jobsite_id) ?? []), id]);
  }
  for (const [jobsiteId, ids] of idsByJobsite) {
    for (const chunk of chunks(ids)) {
      must(
        await supabase.from("projects").update({ jobsite_id: jobsiteId }).in("id", chunk),
        "link projects to jobsite",
      );
    }
  }

  console.log("Done.");
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
