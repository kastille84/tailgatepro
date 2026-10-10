/** One of a GC's in-house crews (Phase 13): a child subcontractor company.
 *  Mirrors `toCrew` in server/services/companies.js. */
export interface InHouseCrew {
  id: string;
  name: string;
  /** Set once the GC archives the crew; null while it is active. */
  archivedAt: string | null;
  createdAt: string;
}

/** PATCH /api/companies/in-house/:id body — both fields optional. */
export interface InHouseCrewPatch {
  name?: string;
  archived?: boolean;
}

/** Roles a GC manager can invite into a crew (no superintendent). */
export type CrewInviteRole = "admin" | "safety_manager" | "foreman";

/** POST /api/companies/in-house/:id/invite body. */
export interface InviteCrewMemberInput {
  crewId: string;
  email: string;
  role: CrewInviteRole;
}

/** A crew's open join link as a GC manager sees it (Phase 13f-join):
 *  `GET|POST /api/companies/in-house/:id/join-link`. */
export interface CrewJoinLink {
  joinUrl: string;
  expiresAt: string;
  /** Spots left before the link stops working. */
  usesLeft: number;
}

/** GET /api/companies/crew-join/:token — the public preview a foreman sees. */
export interface CrewJoinPreview {
  crewName: string;
  gcName: string | null;
}

/** One person in a crew: GET /api/companies/in-house/:id/members. */
export interface CrewMember {
  id: string;
  name: string;
  role: CrewInviteRole;
  email: string | null;
}
