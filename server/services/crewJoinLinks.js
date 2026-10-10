const { v4: uuidv4 } = require("uuid");
const { supabase } = require("../utility/supabaseClient");
const { AppError } = require("../utility/AppError");
const { generateInviteToken, getInviteExpiry } = require("../utility/inviteToken");
const companiesService = require("./companies");

// Phase 13f-join (docs/in-house-subs-design.md): one open join link per in-house
// crew, so a foreman can join without the GC knowing their email. It loosens the
// email-match check email invites have, so it carries its own limits: a 7-day
// expiry (the invite TTL), a fixed head count, and an off switch (delete the row).
const CREW_JOIN_MAX_USES = 10;
const INVALID_LINK = "This join link is invalid or has expired";

const toLink = (row) => ({
  token: row.token,
  expiresAt: row.expires_at,
  usesLeft: Math.max(row.max_uses - row.uses, 0),
});

const isUsable = (row) =>
  new Date(row.expires_at).getTime() >= Date.now() && row.uses < row.max_uses;

// The crew's current link, or null when none exists or it has run out. GC
// managers only; ownership is checked first so another GC's crew is a 404.
const getForCrew = async (crewId, gcCompanyId) => {
  await companiesService.getOwnedCrew(crewId, gcCompanyId);

  const { data, error } = await supabase
    .from("crew_join_links")
    .select("token, expires_at, max_uses, uses")
    .eq("company_id", crewId)
    .maybeSingle();

  if (error) {
    throw new AppError("Could not load the join link", 502, { cause: error });
  }
  return data && isUsable(data) ? toLink(data) : null;
};

// Creates the crew's link, or replaces it: the UNIQUE(company_id) constraint plus
// this upsert is the whole "one active link" mechanism, and a new token kills the
// old URL. An archived crew cannot take new people.
const createForCrew = async (crewId, gcCompanyId) => {
  const crew = await companiesService.getOwnedCrew(crewId, gcCompanyId);
  if (crew.archivedAt) {
    throw new AppError("This crew is archived. Restore it before making a join link.", 409);
  }

  const { data, error } = await supabase
    .from("crew_join_links")
    .upsert(
      {
        id: uuidv4(),
        company_id: crewId,
        token: generateInviteToken(),
        expires_at: getInviteExpiry().toISOString(),
        max_uses: CREW_JOIN_MAX_USES,
        uses: 0,
      },
      { onConflict: "company_id" },
    )
    .select("token, expires_at, max_uses, uses")
    .single();

  if (error) {
    throw new AppError("Could not create the join link", 502, { cause: error });
  }
  return toLink(data);
};

// The off switch. Idempotent: turning off a crew with no link is not an error.
const removeForCrew = async (crewId, gcCompanyId) => {
  await companiesService.getOwnedCrew(crewId, gcCompanyId);

  const { error } = await supabase.from("crew_join_links").delete().eq("company_id", crewId);
  if (error) {
    throw new AppError("Could not turn off the join link", 502, { cause: error });
  }
};

// Shared lookup for the public preview and for signup. Missing, expired, full,
// archived crew and "no longer a crew" all collapse into one 404: minimal
// disclosure, same as companyInvites.getActiveInvite.
const getActiveByToken = async (token) => {
  const { data, error } = await supabase
    .from("crew_join_links")
    .select(
      "id, company_id, expires_at, max_uses, uses, companies(name, archived_at, parent_gc_company_id, parent:parent_gc_company_id(name))",
    )
    .eq("token", token)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new AppError(INVALID_LINK, 404, { cause: error });
    }
    throw new AppError("Could not look up the join link", 502, { cause: error });
  }

  const crew = data.companies;
  if (!isUsable(data) || !crew || crew.archived_at || !crew.parent_gc_company_id) {
    throw new AppError(INVALID_LINK, 404);
  }

  return {
    id: data.id,
    companyId: data.company_id,
    uses: data.uses,
    crewName: crew.name,
    gcName: crew.parent?.name ?? null,
  };
};

// GET /api/companies/crew-join/:token, public, before any account exists.
const previewByToken = async (token) => {
  const link = await getActiveByToken(token);
  return { crewName: link.crewName, gcName: link.gcName };
};

// Takes one of the link's spots. supabase-js has no atomic increment, so this is
// a compare-and-set on the `uses` value that was just read: if another signup
// took a spot in between, no row matches and the caller is told to retry. That
// keeps the head count honest without a stored procedure.
const claimSlot = async (link) => {
  const { data, error } = await supabase
    .from("crew_join_links")
    .update({ uses: link.uses + 1 })
    .eq("id", link.id)
    .eq("uses", link.uses)
    .select("id");

  if (error) {
    throw new AppError("Could not use the join link", 502, { cause: error });
  }
  if (data.length === 0) {
    throw new AppError("Someone else just joined with this link. Please try again.", 409);
  }
};

// Gives a spot back after a failed signup. Best-effort: if another signup has
// claimed one since, the compare-and-set no-ops and the spot is simply lost.
const releaseSlot = async (link) => {
  const { error } = await supabase
    .from("crew_join_links")
    .update({ uses: link.uses })
    .eq("id", link.id)
    .eq("uses", link.uses + 1);

  if (error) {
    console.error("crewJoinLinks: failed to release a join link spot", error);
  }
};

module.exports = {
  CREW_JOIN_MAX_USES,
  getForCrew,
  createForCrew,
  removeForCrew,
  getActiveByToken,
  previewByToken,
  claimSlot,
  releaseSlot,
};
