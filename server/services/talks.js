const { supabase } = require("../utility/supabaseClient");
const { AppError } = require("../utility/AppError");
const { composeTalkMarkdown } = require("../utility/composeTalkMarkdown");

// The columns every talks query selects, and the snake_case -> camelCase
// mapper applied to each row before it leaves the service. Services never leak
// DB column names to the controller layer.
const TALK_COLUMNS =
  "id, slug, title, trade_tag, trade_tags, content, structured, attribution, is_global, company_id, created_at";

const toTalk = (row) => ({
  id: row.id,
  slug: row.slug,
  title: row.title,
  tradeTag: row.trade_tag,
  tradeTags: row.trade_tags ?? [],
  content: row.content,
  structured: row.structured ?? null,
  attribution: row.attribution ?? null,
  isGlobal: row.is_global,
  companyId: row.company_id,
  createdAt: row.created_at,
});

// Every talk visible to a company: the shared global library plus that
// company's own custom talks. Alphabetical by title — the client does trade
// filtering and search itself over this one list (docs/tasks.md Phase 2b), so
// there is no `?trade=`/`?q=` param here. `companyId` comes from the caller's
// verified `users` row (via loadUserContext), never from request input, so
// the interpolation into the PostgREST `or` filter is not an injection
// vector — same pattern as projects.listForCompany.
const listForCompany = async (companyId) => {
  const { data, error } = await supabase
    .from("toolbox_talks")
    .select(TALK_COLUMNS)
    .or(`is_global.eq.true,company_id.eq.${companyId}`)
    .order("title", { ascending: true });

  if (error) {
    throw new AppError("Could not load toolbox talks", 502, { cause: error });
  }

  return data.map(toTalk);
};

// Scoped the same way as listForCompany: a talk is fetchable by id only if
// it's global or belongs to the caller's own company. A talk belonging to
// another company is indistinguishable from a missing one (404), by design —
// mirrors projects.update's ownership-in-the-query pattern.
const getById = async (id, companyId) => {
  const { data, error } = await supabase
    .from("toolbox_talks")
    .select(TALK_COLUMNS)
    .eq("id", id)
    .or(`is_global.eq.true,company_id.eq.${companyId}`)
    .single();

  if (error) {
    // PGRST116 = no row returned by `.single()` — the id doesn't exist (or
    // isn't visible to this company).
    if (error.code === "PGRST116") {
      throw new AppError("Talk not found", 404, { cause: error });
    }
    throw new AppError("Could not load the talk", 502, { cause: error });
  }

  return toTalk(data);
};

// Creates a company-scoped custom talk. `id` is client-generated (offline-sync
// convention, same as projects.create). `content` is composed from the
// structured fields via the same shared Markdown builder the seed pipeline
// uses, so a custom talk's body renders identically to a harvested one.
// Missing optional fields default the same way scripts/lib/talkRow.js
// `buildRow` does (`[]`/`null`). Custom talks never carry attribution.
const create = async ({
  id,
  companyId,
  title,
  tradeTag,
  summary,
  talkingPoints,
  siteHazardsToCheck,
  discussionQuestions,
  oshaStandards,
  estimatedMinutes,
}) => {
  const structured = {
    summary: summary ?? null,
    talking_points: talkingPoints ?? [],
    site_hazards_to_check: siteHazardsToCheck ?? [],
    discussion_questions: discussionQuestions ?? [],
    osha_standards: oshaStandards ?? [],
    estimated_minutes: estimatedMinutes ?? null,
  };

  const { data, error } = await supabase
    .from("toolbox_talks")
    .insert({
      id,
      slug: null,
      title,
      trade_tag: tradeTag ?? null,
      trade_tags: tradeTag ? [tradeTag] : [],
      content: composeTalkMarkdown({ title, ...structured }),
      structured,
      attribution: null,
      is_global: false,
      company_id: companyId,
    })
    .select(TALK_COLUMNS)
    .single();

  if (error) {
    // 23505 = unique_violation on toolbox_talks.id (pkey) — this id was
    // already used (an offline-sync retry collision).
    if (error.code === "23505") {
      throw new AppError("This talk already exists", 409, { cause: error });
    }
    throw new AppError("Could not create the talk", 502, { cause: error });
  }

  return toTalk(data);
};

// Blocks edit/delete once a talk has been used in a logged safety talk.
// meeting_logs.talk_id is a live FK, not a content snapshot: editing a talk
// after the fact would retroactively rewrite what that past meeting "was
// about", and deleting it would sever the historical record entirely. Shared
// by update() and remove() so the rule (and its wording) lives in one place —
// unlike projects, where only delete needs the meeting_logs guard.
const assertNotLoggedAnywhere = async (id) => {
  const { data: logs, error } = await supabase
    .from("meeting_logs")
    .select("id")
    .eq("talk_id", id)
    .limit(1);

  if (error) {
    throw new AppError("Could not verify this talk isn't in use", 502, {
      cause: error,
    });
  }

  if (logs.length > 0) {
    throw new AppError(
      "This talk has been used in a logged safety talk and can't be edited or deleted.",
      409,
    );
  }
};

// Full-replaces a custom talk's editable fields — scoped to the caller's own
// company and never a global talk (a talk belonging to another company or
// marked is_global is indistinguishable from missing, same as getById).
// `content` is rebuilt from the structured fields via the same shared
// Markdown builder create() uses, so an edited talk's body stays consistent
// with its structured data.
const update = async ({
  id,
  companyId,
  title,
  tradeTag,
  summary,
  talkingPoints,
  siteHazardsToCheck,
  discussionQuestions,
  oshaStandards,
  estimatedMinutes,
}) => {
  await assertNotLoggedAnywhere(id);

  const structured = {
    summary: summary ?? null,
    talking_points: talkingPoints ?? [],
    site_hazards_to_check: siteHazardsToCheck ?? [],
    discussion_questions: discussionQuestions ?? [],
    osha_standards: oshaStandards ?? [],
    estimated_minutes: estimatedMinutes ?? null,
  };

  const { data, error } = await supabase
    .from("toolbox_talks")
    .update({
      title,
      trade_tag: tradeTag ?? null,
      trade_tags: tradeTag ? [tradeTag] : [],
      content: composeTalkMarkdown({ title, ...structured }),
      structured,
    })
    .eq("id", id)
    .eq("company_id", companyId)
    .eq("is_global", false)
    .select(TALK_COLUMNS)
    .single();

  if (error) {
    // PGRST116 = no row returned by `.single()` — the id doesn't exist, isn't
    // owned by this company, or is a global talk.
    if (error.code === "PGRST116") {
      throw new AppError("Talk not found", 404, { cause: error });
    }
    throw new AppError("Could not update the talk", 502, { cause: error });
  }

  return toTalk(data);
};

// Hard-deletes a custom talk the caller's company owns, once it isn't
// referenced by any meeting_logs row. `user_favorites.talk_id` is
// ON DELETE CASCADE, so favorites of this talk are cleaned up automatically —
// no separate handling needed here. Scoped the same way as update.
const remove = async ({ id, companyId }) => {
  await assertNotLoggedAnywhere(id);

  const { data, error } = await supabase
    .from("toolbox_talks")
    .delete()
    .eq("id", id)
    .eq("company_id", companyId)
    .eq("is_global", false)
    .select("id")
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new AppError("Talk not found", 404, { cause: error });
    }
    throw new AppError("Could not delete the talk", 502, { cause: error });
  }

  return { id: data.id };
};

module.exports = { listForCompany, getById, create, update, remove };
