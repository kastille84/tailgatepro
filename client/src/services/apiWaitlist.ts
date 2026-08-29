export interface WaitlistPayload {
  name: string;
  email: string;
  company?: string;
}

export interface WaitlistResult {
  email: string;
  alreadyJoined: boolean;
}

/** POST a landing-page waitlist signup to the Express API. */
export const addToWaitlist = async (
  payload: WaitlistPayload,
): Promise<WaitlistResult> => {
  const res = await fetch("/api/waitlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const body = await res.json().catch(() => null);

  if (!res.ok || !body?.success) {
    throw new Error(body?.error ?? "Something went wrong. Please try again.");
  }

  return body.data as WaitlistResult;
};
