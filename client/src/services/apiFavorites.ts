import type { FavoriteRow } from "../interfaces/favorite";

const GENERIC_ERROR = "Something went wrong. Please try again.";

const authHeaders = (accessToken: string) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${accessToken}`,
});

/** GET /api/favorites — the caller's favorited talk ids, newest first. */
export const listFavorites = async (
  accessToken: string,
): Promise<FavoriteRow[]> => {
  const res = await fetch("/api/favorites", {
    method: "GET",
    headers: authHeaders(accessToken),
  });

  const body = await res.json().catch(() => null);

  if (!res.ok || !body?.success) {
    throw new Error(body?.error ?? GENERIC_ERROR);
  }

  return body.data as FavoriteRow[];
};

/** POST /api/favorites — favorite a talk. Idempotent on the server. */
export const addFavorite = async (
  accessToken: string,
  talkId: string,
): Promise<FavoriteRow> => {
  const res = await fetch("/api/favorites", {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify({ talkId }),
  });

  const body = await res.json().catch(() => null);

  if (!res.ok || !body?.success) {
    throw new Error(body?.error ?? GENERIC_ERROR);
  }

  return body.data as FavoriteRow;
};

/** DELETE /api/favorites/:talkId — unfavorite a talk. Idempotent on the server. */
export const removeFavorite = async (
  accessToken: string,
  talkId: string,
): Promise<{ talkId: string }> => {
  const res = await fetch(`/api/favorites/${talkId}`, {
    method: "DELETE",
    headers: authHeaders(accessToken),
  });

  const body = await res.json().catch(() => null);

  if (!res.ok || !body?.success) {
    throw new Error(body?.error ?? GENERIC_ERROR);
  }

  return body.data as { talkId: string };
};
