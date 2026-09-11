import type { Talk } from "../interfaces/talk";

const GENERIC_ERROR = "Something went wrong. Please try again.";

const authHeaders = (accessToken: string) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${accessToken}`,
});

/** GET /api/talks — every talk in the shared global library. Trade filtering
 *  and title search run client-side over this one fetch (see useTalks). */
export const listTalks = async (accessToken: string): Promise<Talk[]> => {
  const res = await fetch("/api/talks", {
    method: "GET",
    headers: authHeaders(accessToken),
  });

  const body = await res.json().catch(() => null);

  if (!res.ok || !body?.success) {
    throw new Error(body?.error ?? GENERIC_ERROR);
  }

  return body.data as Talk[];
};
