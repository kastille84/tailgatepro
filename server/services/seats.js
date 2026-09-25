const { supabase } = require("../utility/supabaseClient");
const { AppError } = require("../utility/AppError");
const { getLimits, seatRoleFor } = require("../utility/entitlements");
const companiesService = require("./companies");

const countRows = async (query, failureMessage) => {
  const { count, error } = await query;
  if (error) {
    throw new AppError(failureMessage, 502, { cause: error });
  }
  return count ?? 0;
};

// Throws a 403 PLAN_LIMIT when adding one more person at `role` would exceed the
// company's plan seats (Phase 9c). Free counts every member (one person total);
// Pro/Enterprise count foremen only, so admins and safety managers never use a
// seat. `includePending` counts unexpired invites too (at invite time) but not
// the invite being redeemed (at accept time) -- and skips `email`'s own pending
// invite, since re-inviting the same email replaces it rather than adding one.
// `companyId` is always the caller's verified company (loadUserContext).
const assertSeatAvailable = async ({ companyId, role, email, includePending }) => {
  const company = await companiesService.getById(companyId);
  const { foremanSeats } = getLimits(company.companyType, company.tier);
  if (foremanSeats === null) return;

  const seatRole = seatRoleFor(company.companyType, company.tier);
  if (seatRole && role !== seatRole) return;

  let users = supabase
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId);
  if (seatRole) users = users.eq("role", seatRole);
  let used = await countRows(users, "Could not check your plan's seats");

  if (includePending) {
    let invites = supabase
      .from("company_invites")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .gt("expires_at", new Date().toISOString())
      .neq("email", email);
    if (seatRole) invites = invites.eq("role", seatRole);
    used += await countRows(invites, "Could not check your plan's seats");
  }

  if (used >= foremanSeats) {
    throw new AppError("Your plan's user limit is reached. Upgrade to add more people.", 403, {
      data: { code: "PLAN_LIMIT", limit: foremanSeats },
    });
  }
};

module.exports = { assertSeatAvailable };
