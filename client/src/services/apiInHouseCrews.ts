import { fetchWithTimeout } from "../utils/fetchWithTimeout";
import { PlanLimitError } from "../utils/PlanLimitError";
import type {
  CrewJoinLink,
  CrewJoinPreview,
  CrewMember,
  InHouseCrew,
  InHouseCrewPatch,
  InviteCrewMemberInput,
} from "../interfaces/inHouseCrew";
import type { InviteTeammateResult } from "../interfaces/companyInvite";

const GENERIC_ERROR = "Something went wrong. Please try again.";

const authHeaders = (accessToken: string) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${accessToken}`,
});

/** Unwraps the server's `{ success, data }` envelope, throwing its message.
 *  A 403 `PLAN_LIMIT` (the crew's seat cap) throws a `PlanLimitError` so the
 *  UI can show an upgrade prompt instead of a toast. */
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

/** GET /api/companies/in-house — the caller's GC's in-house crews. */
export const listInHouseCrews = async (accessToken: string): Promise<InHouseCrew[]> => {
  const res = await fetchWithTimeout("/api/companies/in-house", {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return unwrap<InHouseCrew[]>(res);
};

/** POST /api/companies/in-house — manager only; attaches the new crew to the
 *  `jobsiteIds` the GC picked (none when omitted). */
export const createInHouseCrew = async (
  accessToken: string,
  input: { name: string; jobsiteIds?: string[] },
): Promise<InHouseCrew> => {
  const res = await fetchWithTimeout("/api/companies/in-house", {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify(input),
  });
  return unwrap<InHouseCrew>(res);
};

/** PATCH /api/companies/in-house/:id — rename or archive/restore. */
export const updateInHouseCrew = async (
  accessToken: string,
  id: string,
  patch: InHouseCrewPatch,
): Promise<InHouseCrew> => {
  const res = await fetchWithTimeout(`/api/companies/in-house/${id}`, {
    method: "PATCH",
    headers: authHeaders(accessToken),
    body: JSON.stringify(patch),
  });
  return unwrap<InHouseCrew>(res);
};

/** DELETE /api/companies/in-house/:id — 409 once the crew has logs or users. */
export const deleteInHouseCrew = async (accessToken: string, id: string): Promise<void> => {
  const res = await fetchWithTimeout(`/api/companies/in-house/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  await unwrap<unknown>(res);
};

/** POST /api/companies/in-house/:id/invite — emails a crew teammate an invite. */
export const inviteCrewMember = async (
  accessToken: string,
  { crewId, email, role }: InviteCrewMemberInput,
): Promise<InviteTeammateResult> => {
  const res = await fetchWithTimeout(`/api/companies/in-house/${crewId}/invite`, {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify({ email, role }),
  });
  return unwrap<InviteTeammateResult>(res);
};

/** POST /api/jobsites/:id/in-house/:crewId — (re-)adds a crew to a job site. */
export const attachCrewToJobsite = async (
  accessToken: string,
  jobsiteId: string,
  crewId: string,
): Promise<void> => {
  const res = await fetchWithTimeout(`/api/jobsites/${jobsiteId}/in-house/${crewId}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  await unwrap<unknown>(res);
};

/** GET /api/companies/in-house/:id/join-link — the crew's link, or null if none. */
export const getCrewJoinLink = async (
  accessToken: string,
  crewId: string,
): Promise<CrewJoinLink | null> => {
  const res = await fetchWithTimeout(`/api/companies/in-house/${crewId}/join-link`, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return unwrap<CrewJoinLink | null>(res);
};

/** POST /api/companies/in-house/:id/join-link — creates the link, or replaces it
 *  (the old URL stops working). */
export const createCrewJoinLink = async (
  accessToken: string,
  crewId: string,
): Promise<CrewJoinLink> => {
  const res = await fetchWithTimeout(`/api/companies/in-house/${crewId}/join-link`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return unwrap<CrewJoinLink>(res);
};

/** DELETE /api/companies/in-house/:id/join-link — turns the link off. */
export const deleteCrewJoinLink = async (accessToken: string, crewId: string): Promise<void> => {
  const res = await fetchWithTimeout(`/api/companies/in-house/${crewId}/join-link`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  await unwrap<unknown>(res);
};

/** GET /api/companies/in-house/:id/members — the crew's people. */
export const listCrewMembers = async (
  accessToken: string,
  crewId: string,
): Promise<CrewMember[]> => {
  const res = await fetchWithTimeout(`/api/companies/in-house/${crewId}/members`, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return unwrap<CrewMember[]>(res);
};

/** DELETE /api/companies/in-house/:id/members/:userId — removes a person and
 *  their sign-in account. */
export const removeCrewMember = async (
  accessToken: string,
  crewId: string,
  userId: string,
): Promise<void> => {
  const res = await fetchWithTimeout(`/api/companies/in-house/${crewId}/members/${userId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  await unwrap<unknown>(res);
};

/** GET /api/companies/crew-join/:token — public (no session): who a foreman is
 *  about to join. Throws with the server's message on a bad or expired link. */
export const previewCrewJoin = async (token: string): Promise<CrewJoinPreview> => {
  const res = await fetchWithTimeout(`/api/companies/crew-join/${token}`, { method: "GET" });
  return unwrap<CrewJoinPreview>(res);
};
