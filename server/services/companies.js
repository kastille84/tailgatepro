const { supabase } = require("../utility/supabaseClient");
const { AppError } = require("../utility/AppError");

// The columns every companies query selects, and the snake_case -> camelCase
// mapper applied to each row before it leaves the service. Services never
// leak DB column names to the controller layer.
const COMPANY_COLUMNS = "id, name, company_type, tier";

const toCompany = (row) => ({
  id: row.id,
  name: row.name,
  companyType: row.company_type,
  tier: row.tier,
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

module.exports = { getById };
