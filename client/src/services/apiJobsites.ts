import { fetchWithTimeout } from "../utils/fetchWithTimeout";
import { PlanLimitError } from "../utils/PlanLimitError";
import type {
  InviteSubcontractorResult,
  Jobsite,
  JobsiteInvitePreview,
  JobsitePatch,
  JobsiteSummary,
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
  input: { name: string },
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
