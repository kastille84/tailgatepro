/** Matches the Supabase `user_role` enum exactly. `superintendent` is GC
 *  Portfolio only (Phase 9d-2, docs/gc-roles-design.md) — the server 403s
 *  PLAN_LIMIT inviting one on any other plan. */
export type InviteRole = "admin" | "safety_manager" | "foreman" | "superintendent";

/** GET /api/companies/invite/:token's public preview shape — shown on the
 *  accept-invite page before the invitee has any account. */
export interface InvitePreview {
  companyName: string | null;
  email: string;
  role: InviteRole;
}

/** POST /api/companies/invite's request body. */
export interface InviteTeammateInput {
  email: string;
  role: InviteRole;
}

/** POST /api/companies/invite's response — deliberately excludes the token
 *  itself, which only ever leaves the server via the invite email. */
export interface InviteTeammateResult {
  email: string;
  role: InviteRole;
}
