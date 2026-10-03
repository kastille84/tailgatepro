import { fetchWithTimeout } from "../utils/fetchWithTimeout";
import { PlanLimitError } from "../utils/PlanLimitError";
import type { SmsRecipient } from "../interfaces/sms";

const GENERIC_ERROR = "Something went wrong. Please try again.";

const authHeaders = (accessToken: string) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${accessToken}`,
});

/** Unwraps the server's `{ success, data }` envelope, throwing its message.
 *  A 403 `PLAN_LIMIT` (the site is not on Site Pro) throws a `PlanLimitError`. */
const unwrap = async <T>(res: Response): Promise<T> => {
  const body = await res.json().catch(() => null);

  if (!res.ok || !body?.success) {
    if (body?.data?.code === "PLAN_LIMIT") {
      throw new PlanLimitError(body.error ?? GENERIC_ERROR);
    }
    throw new Error(body?.error ?? GENERIC_ERROR);
  }

  return body.data as T;
};

/** GET /api/sms/me — the caller's own SMS opt-in, or null. */
export const getMySmsOptIn = async (
  accessToken: string,
): Promise<SmsRecipient | null> => {
  const res = await fetchWithTimeout("/api/sms/me", {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return unwrap<SmsRecipient | null>(res);
};

/** PUT /api/sms/me — opts the caller in (or re-opts them in after a STOP). */
export const saveMySmsOptIn = async (
  accessToken: string,
  phone: string,
): Promise<SmsRecipient> => {
  const res = await fetchWithTimeout("/api/sms/me", {
    method: "PUT",
    headers: authHeaders(accessToken),
    body: JSON.stringify({ phone, consent: true }),
  });
  return unwrap<SmsRecipient>(res);
};

/** DELETE /api/sms/me — withdraws the caller's opt-in. */
export const clearMySmsOptIn = async (accessToken: string): Promise<void> => {
  const res = await fetchWithTimeout("/api/sms/me", {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  await unwrap<unknown>(res);
};

/** GET /api/sms/jobsites/:id/recipients — numbers a GC entered for one site. */
export const listJobsiteSmsRecipients = async (
  accessToken: string,
  jobsiteId: string,
): Promise<SmsRecipient[]> => {
  const res = await fetchWithTimeout(
    `/api/sms/jobsites/${jobsiteId}/recipients`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  return unwrap<SmsRecipient[]>(res);
};

/** POST /api/sms/jobsites/:id/recipients — adds a sub foreman's number; the
 *  server texts them a YES confirmation. `rosterId` is the roster row id. */
export const addJobsiteSmsRecipient = async (
  accessToken: string,
  jobsiteId: string,
  input: { rosterId: string; phone: string },
): Promise<SmsRecipient> => {
  const res = await fetchWithTimeout(
    `/api/sms/jobsites/${jobsiteId}/recipients`,
    {
      method: "POST",
      headers: authHeaders(accessToken),
      body: JSON.stringify(input),
    },
  );
  return unwrap<SmsRecipient>(res);
};

/** DELETE /api/sms/jobsites/:id/recipients/:recipientId */
export const removeJobsiteSmsRecipient = async (
  accessToken: string,
  jobsiteId: string,
  recipientId: string,
): Promise<void> => {
  const res = await fetchWithTimeout(
    `/api/sms/jobsites/${jobsiteId}/recipients/${recipientId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  await unwrap<unknown>(res);
};
