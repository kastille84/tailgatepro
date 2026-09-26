import { fetchWithTimeout } from "../utils/fetchWithTimeout";
import { PlanLimitError } from "../utils/PlanLimitError";
import type { Company } from "../interfaces/company";
import type {
  InvitePreview,
  InviteTeammateInput,
  InviteTeammateResult,
} from "../interfaces/companyInvite";

const GENERIC_ERROR = "Something went wrong. Please try again.";

/**
 * GET /api/companies/me — the caller's own company profile. Used to prefill
 * "my own company" fields (e.g. a GC's name/email on the project form)
 * without asking the user to retype data the app already has.
 */
export const getMyCompany = async (accessToken: string): Promise<Company> => {
  const res = await fetchWithTimeout("/api/companies/me", {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const body = await res.json().catch(() => null);

  if (!res.ok || !body?.success) {
    throw new Error(body?.error ?? GENERIC_ERROR);
  }

  return body.data as Company;
};

/**
 * GET /api/companies/logo-url — a short-lived signed URL for the caller's own
 * company logo. Resolves `null` on a 404 (no logo uploaded yet), which is a
 * normal, expected outcome rather than an error — mirrors `createProfile`'s
 * 409-resolves-null pattern in `apiUsers.ts`.
 */
export const getCompanyLogoUrl = async (
  accessToken: string,
): Promise<string | null> => {
  const res = await fetchWithTimeout("/api/companies/logo-url", {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (res.status === 404) {
    return null;
  }

  const body = await res.json().catch(() => null);

  if (!res.ok || !body?.success) {
    throw new Error(body?.error ?? GENERIC_ERROR);
  }

  return body.data.url as string;
};

/**
 * GET /api/companies/join-code — the GC's own join code, which subcontractors
 * enter to link a project to it. The server creates the code on first request
 * and 403s for a non-GC company.
 */
export const getJoinCode = async (accessToken: string): Promise<string> => {
  const res = await fetchWithTimeout("/api/companies/join-code", {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const body = await res.json().catch(() => null);

  if (!res.ok || !body?.success) {
    throw new Error(body?.error ?? GENERIC_ERROR);
  }

  return body.data.joinCode as string;
};

/**
 * PUT /api/companies/logo — uploads the caller's company logo as a raw binary
 * body (not JSON), so the `Content-Type` header carries the blob's actual
 * mime type — mirrors `apiMeetingLogs.ts`'s `uploadCrewPhoto`. The server
 * 403s if the caller's company isn't Trade Pro+.
 */
export const uploadCompanyLogo = async (
  accessToken: string,
  blob: Blob,
): Promise<Company> => {
  const res = await fetchWithTimeout("/api/companies/logo", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": blob.type || "image/png",
    },
    body: blob,
  });

  const body = await res.json().catch(() => null);

  if (!res.ok || !body?.success) {
    throw new Error(body?.error ?? GENERIC_ERROR);
  }

  return body.data as Company;
};

/**
 * GET /api/companies/invite/:token — public, unauthenticated preview shown
 * before the invitee has any account (Phase 8c). Throws with the server's
 * message on an invalid/expired/unknown token.
 */
export const getInvitePreview = async (token: string): Promise<InvitePreview> => {
  const res = await fetchWithTimeout(`/api/companies/invite/${token}`, {
    method: "GET",
  });

  const body = await res.json().catch(() => null);

  if (!res.ok || !body?.success) {
    throw new Error(body?.error ?? GENERIC_ERROR);
  }

  return body.data as InvitePreview;
};

/**
 * POST /api/companies/invite — admin/safety_manager only (server-enforced).
 * Sends an invite email to the given address and returns only `{email,
 * role}` — the invite token is never echoed back to the browser.
 */
export const inviteTeammate = async (
  accessToken: string,
  input: InviteTeammateInput,
): Promise<InviteTeammateResult> => {
  const res = await fetchWithTimeout("/api/companies/invite", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(input),
  });

  const body = await res.json().catch(() => null);

  if (!res.ok || !body?.success) {
    if (body?.data?.code === "PLAN_LIMIT") {
      throw new PlanLimitError(body.error ?? GENERIC_ERROR, body.data.limit ?? null);
    }
    throw new Error(body?.error ?? GENERIC_ERROR);
  }

  return body.data as InviteTeammateResult;
};
