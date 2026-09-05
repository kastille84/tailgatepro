import type { CompanyType } from "../interfaces/company";

export interface CreateProfilePayload {
  name: string;
  companyName: string;
  companyType: CompanyType;
  /** The current Supabase session's access token, sent as a Bearer header —
   *  never part of the JSON body. */
  accessToken: string;
}

export interface CreateProfileResult {
  id: string;
  name: string;
  role: string;
  companyId: string;
}

/** POST a self-serve signup's profile (and its new company) to the Express API. */
export const createProfile = async (
  payload: CreateProfilePayload,
): Promise<CreateProfileResult> => {
  const { accessToken, ...body } = payload;

  const res = await fetch("/api/users/profile", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  const responseBody = await res.json().catch(() => null);

  if (!res.ok || !responseBody?.success) {
    throw new Error(
      responseBody?.error ?? "Could not finish setting up your account.",
    );
  }

  return responseBody.data as CreateProfileResult;
};
