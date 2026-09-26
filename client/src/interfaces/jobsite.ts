import type { ProjectStatus } from "./project";

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
