import type { NoWorkDay, NoWorkDayReason } from "../interfaces/noWorkDay";

const GENERIC_ERROR = "Something went wrong. Please try again.";

const authHeaders = (accessToken: string) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${accessToken}`,
});

/** The body of POST /api/no-work-days. `id` is client-generated. */
export interface CreateNoWorkDayInput {
  id: string;
  projectId: string;
  offDate: string;
  reason: NoWorkDayReason;
}

/** The server answers `{ ignored: true }` (nothing written) for a weekend or
 *  out-of-range date, so a replayed offline row can never be stranded. */
export type CreateNoWorkDayResult = NoWorkDay | { ignored: true };

/** GET /api/no-work-days — the caller's marks for a project's job site. */
export const listNoWorkDays = async (
  accessToken: string,
  projectId: string,
): Promise<NoWorkDay[]> => {
  const res = await fetch(
    `/api/no-work-days?projectId=${encodeURIComponent(projectId)}`,
    { method: "GET", headers: authHeaders(accessToken) },
  );

  const body = await res.json().catch(() => null);

  if (!res.ok || !body?.success) {
    throw new Error(body?.error ?? GENERIC_ERROR);
  }

  return body.data as NoWorkDay[];
};

/** POST /api/no-work-days — mark a weekday off. Idempotent on the server. */
export const createNoWorkDay = async (
  accessToken: string,
  input: CreateNoWorkDayInput,
): Promise<CreateNoWorkDayResult> => {
  const res = await fetch("/api/no-work-days", {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify(input),
  });

  const body = await res.json().catch(() => null);

  if (!res.ok || !body?.success) {
    throw new Error(body?.error ?? GENERIC_ERROR);
  }

  return body.data as CreateNoWorkDayResult;
};

/** DELETE /api/no-work-days/:id — idempotent on the server. */
export const deleteNoWorkDay = async (
  accessToken: string,
  id: string,
): Promise<{ id: string }> => {
  const res = await fetch(`/api/no-work-days/${id}`, {
    method: "DELETE",
    headers: authHeaders(accessToken),
  });

  const body = await res.json().catch(() => null);

  if (!res.ok || !body?.success) {
    throw new Error(body?.error ?? GENERIC_ERROR);
  }

  return body.data as { id: string };
};
