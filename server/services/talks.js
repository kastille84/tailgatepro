const { supabase } = require("../utility/supabaseClient");
const { AppError } = require("../utility/AppError");

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

// Every talk in the shared global library. Alphabetical by title — the client
// does trade filtering and search itself over this one list (docs/tasks.md
// Phase 2b), so there is no `?trade=`/`?q=` param here.
const listGlobal = async () => {
  const { data, error } = await supabase
    .from("toolbox_talks")
    .select(TALK_COLUMNS)
    .eq("is_global", true)
    .order("title", { ascending: true });

  if (error) {
    throw new AppError("Could not load toolbox talks", 502, { cause: error });
  }

  return data.map(toTalk);
};

// TODO(2d): once custom (company-scoped) talks exist, scope this lookup to
// `is_global.eq.true,company_id.eq.${companyId}` (the same `.or()` pattern as
// projects.listForCompany) so a talk belonging to another company can't be
// fetched by guessing its id. Every row today is global, so an unscoped lookup
// is safe for now.
const getById = async (id) => {
  const { data, error } = await supabase
    .from("toolbox_talks")
    .select(TALK_COLUMNS)
    .eq("id", id)
    .single();

  if (error) {
    // PGRST116 = no row returned by `.single()` — the id doesn't exist.
    if (error.code === "PGRST116") {
      throw new AppError("Talk not found", 404, { cause: error });
    }
    throw new AppError("Could not load the talk", 502, { cause: error });
  }

  return toTalk(data);
};

module.exports = { listGlobal, getById };
