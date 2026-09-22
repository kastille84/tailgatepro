const { supabase } = require("../utility/supabaseClient");
const { AppError } = require("../utility/AppError");
const { generateJoinCode, normalizeJoinCode } = require("../utility/joinCode");

// The columns every companies query selects, and the snake_case -> camelCase
// mapper applied to each row before it leaves the service. Services never
// leak DB column names to the controller layer.
const COMPANY_COLUMNS = "id, name, company_type, tier, logo_path";

const toCompany = (row) => ({
  id: row.id,
  name: row.name,
  companyType: row.company_type,
  tier: row.tier,
  logoPath: row.logo_path,
});

// A single company by id — unlike projects.getById/talks.getById, this isn't
// scoped against a second "caller's own company" id: the id passed in here
// is always the caller's own verified companyId from loadUserContext
// (trusted, never a route param), so there's no other party to scope
// against.
const getById = async (id) => {
  const { data, error } = await supabase
    .from("companies")
    .select(COMPANY_COLUMNS)
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new AppError("Company not found", 404, { cause: error });
    }
    throw new AppError("Could not load the company", 502, { cause: error });
  }

  return toCompany(data);
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

module.exports = { getById, updateLogo, getOrCreateJoinCode, getByJoinCode };
