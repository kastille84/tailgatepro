import { fetchWithTimeout } from "../utils/fetchWithTimeout";

export interface CurrentUser {
  id: string;
  companyId: string | null;
  role: string;
  /** `companies.tier` — `null` only in the schema-allowed but
   *  never-in-practice case of a user with no company row yet. */
  tier: string | null;
}

/** GET /api/users/me — the caller's own resolved identity, including their
 *  company's subscription tier (used to gate tier-restricted features like
 *  multi-language talk translation). */
export const getCurrentUser = async (
  accessToken: string,
): Promise<CurrentUser> => {
  const res = await fetchWithTimeout("/api/users/me", {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const body = await res.json().catch(() => null);

  if (!res.ok || !body?.success) {
    throw new Error(body?.error ?? "Could not load your account.");
  }

  return body.data as CurrentUser;
};

export interface CreateProfilePayload {
  /** The current Supabase session's access token, sent as a Bearer header.
   *  The server reads the profile fields (name, company) from the verified
   *  token's `user_metadata`, so the request body is empty. */
  accessToken: string;
}

export interface CreateProfileResult {
  id: string;
  name: string;
  role: string;
  companyId: string;
}

/**
 * POST a self-serve signup's profile (and its new company) to the Express API.
 *
 * Resolves `null` on HTTP 409 — the profile already exists, which is the normal
 * outcome on every login after the first, so callers treat it as a no-op.
 */
export const createProfile = async (
  payload: CreateProfilePayload,
): Promise<CreateProfileResult | null> => {
  const { accessToken } = payload;

  const res = await fetch("/api/users/profile", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({}),
  });

  if (res.status === 409) {
    return null;
  }

  const responseBody = await res.json().catch(() => null);

  if (!res.ok || !responseBody?.success) {
    throw new Error(
      responseBody?.error ?? "Could not finish setting up your account.",
    );
  }

  return responseBody.data as CreateProfileResult;
};
