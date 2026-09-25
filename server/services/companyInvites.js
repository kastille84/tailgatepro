const { v4: uuidv4 } = require("uuid");
const { supabase } = require("../utility/supabaseClient");
const { AppError } = require("../utility/AppError");
const { generateInviteToken, getInviteExpiry } = require("../utility/inviteToken");
const seatsService = require("./seats");

const INVITE_COLUMNS = "id, company_id, email, role, token, expires_at";

const toInvite = (row) => ({
  id: row.id,
  companyId: row.company_id,
  email: row.email,
  role: row.role,
  token: row.token,
  expiresAt: row.expires_at,
});

// Creates (or, for a repeat invite to the same email, replaces) the one
// pending invite row for a company+email pair. The UNIQUE(company_id, email)
// constraint plus this upsert is the entire "re-invite regenerates the
// token" mechanism — no separate duplicate-row cleanup exists anywhere else.
const createInvite = async (companyId, email, role) => {
  await seatsService.assertSeatAvailable({ companyId, role, email, includePending: true });

  const { data, error } = await supabase
    .from("company_invites")
    .upsert(
      {
        id: uuidv4(),
        company_id: companyId,
        email,
        role,
        token: generateInviteToken(),
        expires_at: getInviteExpiry().toISOString(),
      },
      { onConflict: "company_id,email" },
    )
    .select(INVITE_COLUMNS)
    .single();

  if (error) {
    throw new AppError("Could not create the invite", 502, { cause: error });
  }
  return toInvite(data);
};

// Shared lookup: an invite is only "active" if the token exists AND hasn't
// expired. Both the public preview and the acceptance path funnel through
// this single check, so "not found" and "expired" collapse into the same 404
// — minimal disclosure, same reasoning as companies.getByJoinCode.
const getActiveInvite = async (token) => {
  const { data, error } = await supabase
    .from("company_invites")
    .select(`${INVITE_COLUMNS}, companies(name)`)
    .eq("token", token)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new AppError("This invite link is invalid or has expired", 404, { cause: error });
    }
    throw new AppError("Could not look up the invite", 502, { cause: error });
  }
  if (new Date(data.expires_at).getTime() < Date.now()) {
    throw new AppError("This invite link is invalid or has expired", 404);
  }
  return { ...toInvite(data), companyName: data.companies?.name ?? null };
};

// GET /api/companies/invite/:token — public preview, before any account
// exists.
const previewInvite = async (token) => {
  const invite = await getActiveInvite(token);
  return { companyName: invite.companyName, email: invite.email, role: invite.role };
};

// Validates a token+email pair without consuming it. `email` must be the
// token-verified email of the account accepting the invite (req.userEmail,
// never req.body/req.userMetadata) — this is the security check that stops a
// leaked token from being claimed by a different email. Callers that go on
// to create the users row call deleteInvite() themselves, only once their
// own write actually succeeds — see server/services/users.js.
const getInviteForEmail = async (token, email) => {
  const invite = await getActiveInvite(token);
  if (invite.email.toLowerCase() !== String(email ?? "").toLowerCase()) {
    throw new AppError("This invite was sent to a different email address", 403);
  }
  return invite;
};

const deleteInvite = async (id) => {
  const { error } = await supabase.from("company_invites").delete().eq("id", id);
  if (error) {
    throw new AppError("Could not finish accepting the invite", 502, { cause: error });
  }
};

module.exports = { createInvite, previewInvite, getInviteForEmail, deleteInvite };
