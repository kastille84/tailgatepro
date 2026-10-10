import type { Project, ProjectStatus } from "./project";

/** How often subs must log a safety talk (Phase 11f). Weekly = Monday to
 *  Sunday in the viewer's timezone. */
export type MeetingCadence = "daily" | "weekly";

/** One row of a jobsite's roster: a pending invite or an accepted sub. The
 *  invite token is never part of this shape — it only leaves the server via
 *  the invite email. */
export interface JobsiteSubcontractor {
  id: string;
  /** Null when `locked` (hidden by the GC's plan). */
  email: string | null;
  status: "pending" | "accepted";
  /** Null until the invitee has accepted and named/joined a company, and
   *  always null when `locked`. */
  companyName: string | null;
  /** The crew's company id; only sent for an in-house crew (Phase 13), so the
   *  roster can tell which crews are already on the site. Null otherwise. */
  companyId: string | null;
  /** True for one of the GC's own in-house crews (Phase 13). */
  inHouse: boolean;
  /** True when the GC's plan (GC Free: 1 unlocked sub) hides this sub. */
  locked: boolean;
}

/** GET /api/jobsites row — a GC-owned jobsite with its roster embedded. */
export interface Jobsite {
  id: string;
  gcCompanyId: string;
  name: string;
  status: ProjectStatus;
  archivedAt: string | null;
  /** True when a subcontractor's join-code link created this jobsite. False
   *  for GC-created and for jobsites of unknown origin. */
  createdBySub: boolean;
  /** Per-jobsite GC plan (Phase 9b/9e) — `site_pro` unlocks the Defense
   *  Bundle ZIP export. Not blended with the GC company's own tier. */
  plan: "free" | "site_pro";
  /** Effective Site Pro access: the site's own `plan`, or its company being on
   *  GC Portfolio (which covers every site). Gate features on this, not `plan`;
   *  `plan` only says whether the site pays for itself. */
  sitePro: boolean;
  /** The GC's default cadence for this jobsite; a sub may tighten it for
   *  itself but never relax it. */
  meetingCadence: MeetingCadence;
  /** Phase 9e: the GC has switched on the Monday 7:00 AM SMS nudge for this
   *  site. Only ever true on a Site Pro site (server-enforced). */
  smsNudgesEnabled: boolean;
  /** IANA zone (e.g. `America/Chicago`) the Monday 7:00 AM send is evaluated
   *  in; null until the GC sets one, and nudges skip a site without one. */
  timezone: string | null;
  createdAt: string;
  subcontractors: JobsiteSubcontractor[];
}

/** POST/PATCH response � the jobsite row without its roster (only the list
 *  endpoint embeds it). */
export type JobsiteSummary = Omit<Jobsite, "subcontractors">;

/** PATCH /api/jobsites/:id body — every field optional. */
export interface JobsitePatch {
  name?: string;
  status?: ProjectStatus;
  archived?: boolean;
  meetingCadence?: MeetingCadence;
  smsNudgesEnabled?: boolean;
  timezone?: string;
}

/** POST /api/jobsites/:id/invite's response — email only, never the token. */
export interface InviteSubcontractorResult {
  email: string;
}

/** GET /api/jobsites/invite/:token's public preview — shown on the accept page
 *  before the invitee has any session. */
export interface JobsiteInvitePreview {
  gcCompanyName: string | null;
  jobsiteName: string | null;
  email: string;
}

/** GET /api/jobsites/:id/join-link's response (Phase 9e) — the jobsite's own
 *  standing QR/join URL, created on first ask. Unlike the invite token, this
 *  one is meant to be publicly displayed. */
export interface JobsiteJoinLink {
  joinUrl: string;
}

/** GET /api/jobsites/join/:token's public preview — shown on the join page
 *  before the scanner has any session. No email: nothing is invited, anyone
 *  with the link can join. */
export interface JobsiteJoinPreview {
  gcCompanyName: string | null;
  jobsiteName: string | null;
}

/** POST /api/jobsites/join/:token/accept's response — the sub's new (or, on a
 *  repeat scan, already-existing) project on the jobsite. `alreadyMember` is
 *  true only on a repeat scan, when no new project is created and the other
 *  project fields are absent. */
export type JobsiteJoinAcceptResult =
  | (Project & { alreadyMember: false })
  | { alreadyMember: true };

/** One row of GET/PUT /api/jobsites/:id/members (Phase 9d-2) — one of the
 *  company's superintendents, flagged with whether they're assigned to this
 *  jobsite. `userId` is the users.id row, not a company id. */
export interface JobsiteMember {
  userId: string;
  name: string;
  assigned: boolean;
}

export interface JobsiteMembersResult {
  members: JobsiteMember[];
}

/** One row of GET /api/jobsites/memberships (Phase 11f) — a jobsite the
 *  caller's subcontractor company belongs to, with its cadence settings. */
export interface JobsiteMembership {
  jobsiteId: string;
  jobsiteName: string;
  /** The GC's default. */
  jobsiteCadence: MeetingCadence;
  /** This company's own override; null = inherits the GC's default. */
  subCadence: MeetingCadence | null;
  /** The stricter of the two — what compliance is actually scored against. */
  effectiveCadence: MeetingCadence;
}

/** PATCH /api/jobsites/:id/my-cadence's response. */
export interface MyCadenceResult {
  jobsiteId: string;
  jobsiteCadence: MeetingCadence;
  subCadence: MeetingCadence | null;
  effectiveCadence: MeetingCadence;
}
