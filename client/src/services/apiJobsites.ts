import { fetchWithTimeout } from "../utils/fetchWithTimeout";
import type {
  InviteSubcontractorResult,
  Jobsite,
  JobsitePatch,
  JobsiteSummary,
} from "../interfaces/jobsite";

const GENERIC_ERROR = "Something went wrong. Please try again.";

const authHeaders = (accessToken: string) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${accessToken}`,
});

/** Unwraps the server's `{ success, data }` envelope, throwing its message. */
const unwrap = async <T>(res: Response): Promise<T> => {
  const body = await res.json().catch(() => null);

  if (!res.ok || !body?.success) {
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
