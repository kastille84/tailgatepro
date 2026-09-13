import type { Talk } from "../interfaces/talk";

const GENERIC_ERROR = "Something went wrong. Please try again.";

const authHeaders = (accessToken: string) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${accessToken}`,
});

/** Fields accepted when creating a custom talk. The `id` is generated inside
 *  `createTalk` (a client-side UUID, per the offline-sync rule), not supplied
 *  by the caller. `attribution` is never part of this shape — custom talks
 *  always get `attribution: null`, set server-side. */
export interface CreateTalkInput {
  title: string;
  tradeTag?: string | null;
  summary?: string | null;
  talkingPoints: string[];
  siteHazardsToCheck?: string[];
  discussionQuestions?: string[];
  oshaStandards?: string[];
  estimatedMinutes?: number | null;
}

/** GET /api/talks — every talk visible to the caller's company: the shared
 *  global library plus that company's own custom talks. Trade filtering
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

/**
 * POST /api/talks — create a company-scoped custom talk. The `id` is
 * generated here (not on the server), matching `createProject`'s
 * offline-sync convention.
 */
export const createTalk = async (
  accessToken: string,
  input: CreateTalkInput,
): Promise<Talk> => {
  const res = await fetch("/api/talks", {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify({ id: crypto.randomUUID(), ...input }),
  });

  const body = await res.json().catch(() => null);

  if (!res.ok || !body?.success) {
    throw new Error(body?.error ?? GENERIC_ERROR);
  }

  return body.data as Talk;
};

/**
 * PATCH /api/talks/:id — full-replace the editable fields of a custom talk
 * the caller's company owns. The server rejects this (409, surfaced as the
 * thrown message) once the talk has been used in a logged safety talk.
 */
export const updateTalk = async (
  accessToken: string,
  id: string,
  input: CreateTalkInput,
): Promise<Talk> => {
  const res = await fetch(`/api/talks/${id}`, {
    method: "PATCH",
    headers: authHeaders(accessToken),
    body: JSON.stringify(input),
  });

  const body = await res.json().catch(() => null);

  if (!res.ok || !body?.success) {
    throw new Error(body?.error ?? GENERIC_ERROR);
  }

  return body.data as Talk;
};

/**
 * DELETE /api/talks/:id — hard-delete a custom talk the caller's company owns.
 * The server rejects this (409, surfaced as the thrown message) once the talk
 * has been used in a logged safety talk.
 */
export const deleteTalk = async (
  accessToken: string,
  id: string,
): Promise<{ id: string }> => {
  const res = await fetch(`/api/talks/${id}`, {
    method: "DELETE",
    headers: authHeaders(accessToken),
  });

  const body = await res.json().catch(() => null);

  if (!res.ok || !body?.success) {
    throw new Error(body?.error ?? GENERIC_ERROR);
  }

  return body.data as { id: string };
};
