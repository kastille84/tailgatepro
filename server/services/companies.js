const { supabase } = require("../utility/supabaseClient");
const { AppError } = require("../utility/AppError");
const { generateJoinCode, normalizeJoinCode } = require("../utility/joinCode");
const { resolveEffectiveTier } = require("./sponsorship");

// The columns every companies query selects, and the snake_case -> camelCase
// mapper applied to each row before it leaves the service. Services never
// leak DB column names to the controller layer.
const COMPANY_COLUMNS =
  "id, name, company_type, tier, logo_path, required_talk_id, required_talk_pushed_at, required_talk_pushed_by";

// getById also needs the parent GC's tier to derive an in-house crew's plan
// (Phase 13c). Kept out of COMPANY_COLUMNS so the write paths that share it
// don't select a self-embed.
const COMPANY_WITH_PARENT_COLUMNS = `${COMPANY_COLUMNS}, parent_gc_company_id, parent:parent_gc_company_id(tier)`;

const toCompany = (row) => ({
  id: row.id,
  name: row.name,
  companyType: row.company_type,
  tier: row.tier,
  logoPath: row.logo_path,
  // Phase 9e (docs/policy-push-design.md): the GC's current top-down policy
  // push. requiredTalkId is null when no push is currently active.
  requiredTalkId: row.required_talk_id,
  requiredTalkPushedAt: row.required_talk_pushed_at,
  requiredTalkPushedBy: row.required_talk_pushed_by,
});

// A single company by id — unlike projects.getById/talks.getById, this isn't
// scoped against a second "caller's own company" id: the id passed in here
// is always the caller's own verified companyId from loadUserContext
// (trusted, never a route param), so there's no other party to scope
// against. `tier` is the *effective* tier (a Free sub on a Site Pro jobsite
// resolves as Pro, Phase 9d), which is what every limit/gate reads.
const getById = async (id) => {
  const { data, error } = await supabase
    .from("companies")
    .select(COMPANY_WITH_PARENT_COLUMNS)
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new AppError("Company not found", 404, { cause: error });
    }
    throw new AppError("Could not load the company", 502, { cause: error });
  }

  const company = toCompany(data);
  return {
    ...company,
    tier: await resolveEffectiveTier({
      companyId: company.id,
      companyType: company.companyType,
      tier: company.tier,
      parentTier: data.parent?.tier ?? null,
    }),
  };
};

// This service's first write operation. Sets (or clears) the caller's own
// company's logo Storage path after a successful upload — companyId is
// always the caller's own verified id (loadUserContext), same trust
// boundary as getById above.
const updateLogo = async (companyId, logoPath) => {
  const { data, error } = await supabase
    .from("companies")
    .update({ logo_path: logoPath })
    .eq("id", companyId)
    .select(COMPANY_COLUMNS)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new AppError("Company not found", 404, { cause: error });
    }
    throw new AppError("Could not save the company logo", 502, { cause: error });
  }

  return toCompany(data);
};

// A generated code can collide with another company's (UNIQUE -> 23505). With
// ~8.5e11 possible codes that's vanishingly rare, so a handful of retries is
// plenty; running out means something else is wrong, not bad luck.
const JOIN_CODE_MAX_ATTEMPTS = 5;

const readJoinCode = async (companyId) => {
  const { data, error } = await supabase
    .from("companies")
    .select("join_code")
    .eq("id", companyId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new AppError("Company not found", 404, { cause: error });
    }
    throw new AppError("Could not load the join code", 502, { cause: error });
  }

  return data.join_code;
};

// The GC's own join code, created lazily on first ask (companies.join_code is
// NULL until then). companyId is the caller's own verified id (loadUserContext)
// and the route is GC-only; check_join_code_gc_only backstops the latter. The
// `.is("join_code", null)` guard makes the write race-safe without a
// transaction: if two requests both see NULL, only one update matches, and the
// loser re-reads the winner's code instead of overwriting it.
const getOrCreateJoinCode = async (companyId) => {
  const existing = await readJoinCode(companyId);
  if (existing) return existing;

  for (let attempt = 0; attempt < JOIN_CODE_MAX_ATTEMPTS; attempt += 1) {
    const { data, error } = await supabase
      .from("companies")
      .update({ join_code: generateJoinCode() })
      .eq("id", companyId)
      .is("join_code", null)
      .select("join_code");

    if (error) {
      if (error.code === "23505") continue;
      throw new AppError("Could not create the join code", 502, {
        cause: error,
      });
    }
    if (data.length === 0) return readJoinCode(companyId);
    return data[0].join_code;
  }

  throw new AppError("Could not create a join code, please try again", 502);
};

// Resolves a join code a subcontractor typed in to the GC company it belongs
// to. Returns only { id, name } — enough to link a project and label it, and
// nothing about the GC beyond what the code-holder is meant to learn.
const getByJoinCode = async (joinCode) => {
  const { data, error } = await supabase
    .from("companies")
    .select("id, name")
    .eq("join_code", normalizeJoinCode(joinCode))
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new AppError("Join code not found", 404, { cause: error });
    }
    throw new AppError("Could not look up the join code", 502, {
      cause: error,
    });
  }

  return { id: data.id, name: data.name };
};

// Sets (or replaces) the caller's own company's current top-down policy push
// (Phase 9e, docs/policy-push-design.md). Replacing an existing push is just
// a second call — no special-casing needed. `companyId` is always the
// caller's own verified company (loadUserContext), same trust boundary as
// getById/updateLogo above.
const setRequiredTopic = async (companyId, { talkId, pushedByUserId }) => {
  const { data, error } = await supabase
    .from("companies")
    .update({
      required_talk_id: talkId,
      required_talk_pushed_at: new Date().toISOString(),
      required_talk_pushed_by: pushedByUserId,
    })
    .eq("id", companyId)
    .select(COMPANY_COLUMNS)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new AppError("Company not found", 404, { cause: error });
    }
    throw new AppError("Could not push the required topic", 502, { cause: error });
  }

  return toCompany(data);
};

// Clears the caller's own company's current policy push. Clearing when
// nothing is currently pushed is a no-op (idempotent), not an error.
const clearRequiredTopic = async (companyId) => {
  const { data, error } = await supabase
    .from("companies")
    .update({
      required_talk_id: null,
      required_talk_pushed_at: null,
      required_talk_pushed_by: null,
    })
    .eq("id", companyId)
    .select(COMPANY_COLUMNS)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new AppError("Company not found", 404, { cause: error });
    }
    throw new AppError("Could not clear the required topic", 502, { cause: error });
  }

  return toCompany(data);
};

// The columns an in-house crew (Phase 13, docs/in-house-subs-design.md) exposes.
// Deliberately narrower than COMPANY_COLUMNS: a crew's tier and billing
// columns are never shown, since its plan is derived from its GC's.
const CREW_COLUMNS = "id, name, archived_at, created_at";

const toCrew = (row) => ({
  id: row.id,
  name: row.name,
  archivedAt: row.archived_at,
  createdAt: row.created_at,
});

// An in-house crew the caller's GC owns. Ownership is the single-column
// `parent_gc_company_id` check in the query itself, so another GC's crew (or
// an ordinary company) is indistinguishable from a missing row: 404.
// `gcCompanyId` is always the caller's verified company, never request input.
const getOwnedCrew = async (crewId, gcCompanyId) => {
  const { data, error } = await supabase
    .from("companies")
    .select(CREW_COLUMNS)
    .eq("id", crewId)
    .eq("parent_gc_company_id", gcCompanyId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new AppError("Crew not found", 404, { cause: error });
    }
    throw new AppError("Could not load the crew", 502, { cause: error });
  }

  return toCrew(data);
};

module.exports = {
  CREW_COLUMNS,
  toCrew,
  getById,
  getOwnedCrew,
  updateLogo,
  getOrCreateJoinCode,
  getByJoinCode,
  setRequiredTopic,
  clearRequiredTopic,
};
