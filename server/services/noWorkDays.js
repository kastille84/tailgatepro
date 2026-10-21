// "Mark day off" (Phase 14, docs/no-work-days-design.md). A foreman marks a
// weekday their crew isn't working; the day then leaves the sub's expected
// periods on the GC dashboard and scorecard. Every write is scoped by the
// caller's verified `companyId` (loadUserContext), and `jobsite_id` /
// `company_id` are derived from the caller's own project, never from the body.
const { supabase } = require("../utility/supabaseClient");
const { AppError } = require("../utility/AppError");
const { fetchAllPages } = require("../utility/fetchAllPages");
const { isWeekend, shiftDate } = require("../utility/workweek");

const NO_WORK_DAY_COLUMNS = "id, jobsite_id, company_id, off_date, reason, created_by, created_at";

// A mark may sit this far back / ahead of the server's UTC date, plus a day of
// slack each way so a foreman's local "today" is never out of range in any
// time zone.
const DAYS_BACK = 7;
const DAYS_AHEAD = 14;
const ZONE_SLACK_DAYS = 1;

const toNoWorkDay = (row) => ({
  id: row.id,
  jobsiteId: row.jobsite_id,
  companyId: row.company_id,
  offDate: row.off_date,
  reason: row.reason,
  createdBy: row.created_by,
  createdAt: row.created_at,
});

const utcToday = () => new Date().toISOString().slice(0, 10);

// The earliest / latest calendar date a mark can be created, removed or listed.
const rangeBounds = () => {
  const today = utcToday();
  return {
    earliest: shiftDate(today, -(DAYS_BACK + ZONE_SLACK_DAYS)),
    latest: shiftDate(today, DAYS_AHEAD + ZONE_SLACK_DAYS),
  };
};

const isInRange = (offDate) => {
  const { earliest, latest } = rangeBounds();
  return offDate >= earliest && offDate <= latest;
};

// The caller's own project -> the (jobsite, company) the mark belongs to. A
// project the caller doesn't own is a 404 (existence is never leaked); one
// that isn't linked to any GC has no dashboard to affect, so it is a 409.
const resolveOwnProject = async (projectId, companyId) => {
  const { data, error } = await supabase
    .from("projects")
    .select("id, jobsite_id")
    .eq("id", projectId)
    .eq("owner_company_id", companyId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new AppError("Project not found", 404, { cause: error });
    }
    throw new AppError("Could not verify the project", 502, { cause: error });
  }

  if (!data.jobsite_id) {
    throw new AppError("This project isn't linked to a job site, so there is nothing to mark", 409);
  }

  return { jobsiteId: data.jobsite_id };
};

const getByTriple = async ({ jobsiteId, companyId, offDate }) => {
  const { data, error } = await supabase
    .from("no_work_days")
    .select(NO_WORK_DAY_COLUMNS)
    .eq("jobsite_id", jobsiteId)
    .eq("company_id", companyId)
    .eq("off_date", offDate)
    .single();

  if (error) {
    throw new AppError("Could not mark the day off", 502, { cause: error });
  }

  return toNoWorkDay(data);
};

// Marks a weekday off. Idempotent: a retry, or a second foreman marking the
// same (jobsite, company, date), returns the existing row. A weekend or
// out-of-range date is a no-op `{ ignored: true }` rather than an error: the
// offline outbox retries a rejected row forever with the same payload, so a
// semantic rejection would strand it (the `heldAt` stance, utility/heldAt.js).
// Returns `{ noWorkDay, created }` or `{ ignored: true }`.
const create = async ({ id, companyId, userId, projectId, offDate, reason }) => {
  const { jobsiteId } = await resolveOwnProject(projectId, companyId);

  if (isWeekend(offDate) || !isInRange(offDate)) return { ignored: true };

  const { data, error } = await supabase
    .from("no_work_days")
    .upsert(
      {
        id,
        jobsite_id: jobsiteId,
        company_id: companyId,
        off_date: offDate,
        reason,
        created_by: userId,
      },
      { onConflict: "jobsite_id,company_id,off_date", ignoreDuplicates: true },
    )
    .select(NO_WORK_DAY_COLUMNS);

  if (error) {
    // 23505 = unique_violation on the primary key: this id already belongs to a
    // different mark.
    if (error.code === "23505") {
      throw new AppError("This day-off id is already in use", 409, { cause: error });
    }
    throw new AppError("Could not mark the day off", 502, { cause: error });
  }

  // Duplicate (jobsite, company, date): the write was skipped, so go get it.
  if (data.length === 0) {
    return {
      noWorkDay: await getByTriple({ jobsiteId, companyId, offDate }),
      created: false,
    };
  }

  return { noWorkDay: toNoWorkDay(data[0]), created: true };
};

// Removes a mark the caller's company owns. Idempotent: an id that is already
// gone succeeds, so an offline replay never strands. A mark whose date is
// outside the editable range is a 409 -- history is not rewritable.
const remove = async ({ id, companyId }) => {
  const { data: existing, error: lookupError } = await supabase
    .from("no_work_days")
    .select("id, off_date")
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (lookupError) {
    throw new AppError("Could not remove the day off", 502, { cause: lookupError });
  }

  if (!existing) return { id };

  if (!isInRange(existing.off_date)) {
    throw new AppError("This day off is too old to change", 409);
  }

  const { error } = await supabase
    .from("no_work_days")
    .delete()
    .eq("id", id)
    .eq("company_id", companyId);

  if (error) {
    throw new AppError("Could not remove the day off", 502, { cause: error });
  }

  return { id };
};

// The caller's marks for one of its own projects' (jobsite, company), from
// DAYS_BACK days ago onward, soonest first. Feeds the sheet's "already marked"
// list and its Remove action.
const listForProject = async ({ projectId, companyId }) => {
  const { jobsiteId } = await resolveOwnProject(projectId, companyId);

  const { data, error } = await supabase
    .from("no_work_days")
    .select(NO_WORK_DAY_COLUMNS)
    .eq("jobsite_id", jobsiteId)
    .eq("company_id", companyId)
    .gte("off_date", shiftDate(utcToday(), -(DAYS_BACK + ZONE_SLACK_DAYS)))
    .order("off_date", { ascending: true });

  if (error) {
    throw new AppError("Could not load days off", 502, { cause: error });
  }

  return data.map(toNoWorkDay);
};

// GC-side read for gcDashboard / scorecards: every mark on these jobsites with
// `from <= off_date <= to` (YYYY-MM-DD). Callers have already authorized the
// jobsite ids (they come from the GC's own roster). Paged so a large portfolio
// can't hit PostgREST's 1,000-row cap and silently drop marks.
const listForJobsites = async ({ jobsiteIds, from, to }) => {
  if (jobsiteIds.length === 0) return [];

  const rows = await fetchAllPages(
    (start, end) =>
      supabase
        .from("no_work_days")
        .select("jobsite_id, company_id, off_date, reason")
        .in("jobsite_id", jobsiteIds)
        .gte("off_date", from)
        .lte("off_date", to)
        .order("off_date", { ascending: true })
        .order("id", { ascending: true })
        .range(start, end),
    { errorMessage: "Could not load days off" },
  );

  return rows.map((row) => ({
    jobsiteId: row.jobsite_id,
    companyId: row.company_id,
    offDate: row.off_date,
    reason: row.reason,
  }));
};

module.exports = { create, remove, listForProject, listForJobsites };
