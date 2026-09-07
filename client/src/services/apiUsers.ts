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
