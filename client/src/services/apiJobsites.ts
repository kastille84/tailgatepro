import { fetchWithTimeout } from "../utils/fetchWithTimeout";
import { PlanLimitError } from "../utils/PlanLimitError";
import type {
  InviteSubcontractorResult,
  Jobsite,
  JobsiteInvitePreview,
  JobsiteJoinAcceptResult,
  JobsiteJoinLink,
  JobsiteJoinPreview,
  JobsiteMembership,
  JobsiteMembersResult,
  JobsitePatch,
  JobsiteSummary,
  MeetingCadence,
  MyCadenceResult,
} from "../interfaces/jobsite";
import type { Project } from "../interfaces/project";

const GENERIC_ERROR = "Something went wrong. Please try again.";

const authHeaders = (accessToken: string) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${accessToken}`,
});

/** Unwraps the server's `{ success, data }` envelope, throwing its message.
 *  A 403 `PLAN_LIMIT` (job site cap) throws a `PlanLimitError` so the UI can
 *  show an upgrade prompt instead of a toast. */
const unwrap = async <T>(res: Response): Promise<T> => {
  const body = await res.json().catch(() => null);

  if (!res.ok || !body?.success) {
    if (body?.data?.code === "PLAN_LIMIT") {
      throw new PlanLimitError(body.error ?? GENERIC_ERROR, body.data.limit ?? null);
    }
    throw new Error(body?.error ?? GENERIC_ERROR);
  }

  return body.data as T;
};

/** GET /api/jobsites — the GC's jobsites, each with its roster embedded. */
export const listJobsites = async (accessToken: string): Promise<Jobsite[]> => {
  const res = await fetchWithTimeout("/api/jobsites", {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return unwrap<Jobsite[]>(res);
};

/** POST /api/jobsites — admin/safety_manager only (server-enforced). */
export const createJobsite = async (
  accessToken: string,
  input: { name: string; crewIds?: string[] },
): Promise<JobsiteSummary> => {
  const res = await fetchWithTimeout("/api/jobsites", {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify(input),
  });
  return unwrap<JobsiteSummary>(res);
};

/** PATCH /api/jobsites/:id — rename, change status, or archive/restore. */
export const updateJobsite = async (
  accessToken: string,
  id: string,
  patch: JobsitePatch,
): Promise<JobsiteSummary> => {
  const res = await fetchWithTimeout(`/api/jobsites/${id}`, {
    method: "PATCH",
    headers: authHeaders(accessToken),
    body: JSON.stringify(patch),
  });
  return unwrap<JobsiteSummary>(res);
};

/** POST /api/jobsites/:id/invite — emails a subcontractor an invite link. */
export const inviteSubcontractor = async (
  accessToken: string,
  jobsiteId: string,
  email: string,
): Promise<InviteSubcontractorResult> => {
  const res = await fetchWithTimeout(`/api/jobsites/${jobsiteId}/invite`, {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify({ email }),
  });
  return unwrap<InviteSubcontractorResult>(res);
};

/** DELETE /api/jobsites/:id/subcontractors/:subId — removes a sub or cancels
 *  a pending invite. */
export const removeSubcontractor = async (
  accessToken: string,
  jobsiteId: string,
  subId: string,
): Promise<void> => {
  const res = await fetchWithTimeout(
    `/api/jobsites/${jobsiteId}/subcontractors/${subId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  await unwrap<unknown>(res);
};

/** GET /api/jobsites/:id/members — the company's superintendents, each
 *  flagged with whether they're assigned to this jobsite (Phase 9d-2). */
export const listJobsiteMembers = async (
  accessToken: string,
  jobsiteId: string,
): Promise<JobsiteMembersResult> => {
  const res = await fetchWithTimeout(`/api/jobsites/${jobsiteId}/members`, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return unwrap<JobsiteMembersResult>(res);
};

/** PUT /api/jobsites/:id/members — replaces the jobsite's assigned
 *  superintendents with `userIds`. GC Portfolio only; a 403 PLAN_LIMIT throws
 *  a `PlanLimitError`, same as create/update. */
export const setJobsiteMembers = async (
  accessToken: string,
  jobsiteId: string,
  userIds: string[],
): Promise<JobsiteMembersResult> => {
  const res = await fetchWithTimeout(`/api/jobsites/${jobsiteId}/members`, {
    method: "PUT",
    headers: authHeaders(accessToken),
    body: JSON.stringify({ userIds }),
  });
  return unwrap<JobsiteMembersResult>(res);
};

/**
 * GET /api/jobsites/invite/:token — public, unauthenticated preview shown
 * before the invitee has an account. Throws with the server's message on an
 * invalid/expired/unknown token.
 */
export const getJobsiteInvitePreview = async (
  token: string,
): Promise<JobsiteInvitePreview> => {
  const res = await fetchWithTimeout(`/api/jobsites/invite/${token}`, {
    method: "GET",
  });
  return unwrap<JobsiteInvitePreview>(res);
};

/**
 * POST /api/jobsites/invite/:token/accept — an already-registered
 * subcontractor admin/safety_manager accepts on behalf of their company. The
 * server creates the sub's project for the jobsite and returns it.
 */
export const acceptJobsiteInvite = async (
  accessToken: string,
  token: string,
): Promise<Project> => {
  const res = await fetchWithTimeout(`/api/jobsites/invite/${token}/accept`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return unwrap<Project>(res);
};

/**
 * GET /api/jobsites/:id/join-link (Phase 9e) — a GC manager/site-scoped
 * superintendent fetches this jobsite's standing QR/join URL, created on
 * first ask. Unlike the invite token, this one is meant to be shown/printed.
 */
export const getJobsiteJoinLink = async (
  accessToken: string,
  jobsiteId: string,
): Promise<JobsiteJoinLink> => {
  const res = await fetchWithTimeout(`/api/jobsites/${jobsiteId}/join-link`, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return unwrap<JobsiteJoinLink>(res);
};

/**
 * GET /api/jobsites/join/:token — public, unauthenticated preview shown
 * before the scanner has any account. Throws with the server's message on an
 * invalid token.
 */
export const getJobsiteJoinPreview = async (
  token: string,
): Promise<JobsiteJoinPreview> => {
  const res = await fetchWithTimeout(`/api/jobsites/join/${token}`, {
    method: "GET",
  });
  return unwrap<JobsiteJoinPreview>(res);
};

/**
 * POST /api/jobsites/join/:token/accept — a subcontractor admin/safety_manager
 * self-admits their company onto the jobsite. No email is checked (there is
 * none) — see docs/jobsite-qr-join-design.md.
 */
export const acceptJobsiteJoinLink = async (
  accessToken: string,
  token: string,
): Promise<JobsiteJoinAcceptResult> => {
  const res = await fetchWithTimeout(`/api/jobsites/join/${token}/accept`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return unwrap<JobsiteJoinAcceptResult>(res);
};

/** GET /api/jobsites/memberships (Phase 11f) — the caller's subcontractor
 *  company's own jobsites with their meeting cadence. */
export const listJobsiteMemberships = async (
  accessToken: string,
): Promise<JobsiteMembership[]> => {
  const res = await fetchWithTimeout("/api/jobsites/memberships", {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return unwrap<JobsiteMembership[]>(res);
};

/** PATCH /api/jobsites/:id/my-cadence (Phase 11f) — tighten (or, with `null`,
 *  clear) this company's own cadence on a jobsite. A value looser than the
 *  GC's default is rejected by the server. */
export const setMyJobsiteCadence = async (
  accessToken: string,
  jobsiteId: string,
  cadence: MeetingCadence | null,
): Promise<MyCadenceResult> => {
  const res = await fetchWithTimeout(`/api/jobsites/${jobsiteId}/my-cadence`, {
    method: "PATCH",
    headers: authHeaders(accessToken),
    body: JSON.stringify({ cadence }),
  });
  return unwrap<MyCadenceResult>(res);
};
