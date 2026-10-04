import { fetchWithTimeout } from "../utils/fetchWithTimeout";
import type { Signature } from "../interfaces/signature";

const GENERIC_ERROR = "Something went wrong. Please try again.";

const authHeaders = (accessToken: string) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${accessToken}`,
});

/** One worker's submitted quiz answer, before server-side scoring. */
export interface SubmittedQuizAnswer {
  questionIndex: number;
  selectedIndex: number;
}

/** Fields accepted when creating a signature. `id` is a client-generated
 *  UUID, matching `apiMeetingLogs.ts`'s `CreateMeetingLogInput`. */
export interface CreateSignatureInput {
  id: string;
  workerName: string;
  quizAnswers?: SubmittedQuizAnswer[];
}

/**
 * POST /api/meetings/:meetingId/signatures — records one worker's signature
 * on a meeting. Same duplicate-id 409 behavior as `createMeetingLog` — see
 * `utils/db/outbox.ts`.
 */
export const createSignature = async (
  accessToken: string,
  meetingId: string,
  input: CreateSignatureInput,
): Promise<Signature> => {
  const res = await fetchWithTimeout(
    `/api/meetings/${meetingId}/signatures`,
    {
      method: "POST",
      headers: authHeaders(accessToken),
      body: JSON.stringify(input),
    },
  );

  const body = await res.json().catch(() => null);

  if (!res.ok || !body?.success) {
    throw new Error(body?.error ?? GENERIC_ERROR);
  }

  return body.data as Signature;
};

/**
 * PUT /api/meetings/:meetingId/signatures/:id/blob — uploads the captured
 * signature PNG as a raw binary body, not JSON (see `apiMeetingLogs.ts`'s
 * `uploadCrewPhoto`). Unlike the crew-photo upload, the server's
 * `express.raw` middleware here only accepts exactly `image/png` — the
 * signature pad always exports a PNG, so this is hardcoded rather than
 * read off the blob.
 */
export const uploadSignatureBlob = async (
  accessToken: string,
  meetingId: string,
  signatureId: string,
  blob: Blob,
): Promise<Signature> => {
  const res = await fetchWithTimeout(
    `/api/meetings/${meetingId}/signatures/${signatureId}/blob`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "image/png",
      },
      body: blob,
    },
  );

  const body = await res.json().catch(() => null);

  if (!res.ok || !body?.success) {
    throw new Error(body?.error ?? GENERIC_ERROR);
  }

  return body.data as Signature;
};
