import { fetchWithTimeout } from "../utils/fetchWithTimeout";
import type { PdfFileCheck, PublicSealStatus } from "../interfaces/meetingLog";

const GENERIC_ERROR = "Something went wrong. Please try again.";

/** GET /api/public/meetings/:id/verify — unauthenticated; the target of the
 *  QR code printed on every report. Recomputes the meeting's seals server-side
 *  and answers pass/fail only. 404s for an unknown, in-progress or unsealed
 *  meeting. */
export const getPublicSealStatus = async (
  id: string,
): Promise<PublicSealStatus> => {
  const res = await fetchWithTimeout(`/api/public/meetings/${id}/verify`, {
    method: "GET",
  });

  const body = await res.json().catch(() => null);

  if (!res.ok || !body?.success) {
    throw new Error(body?.error ?? GENERIC_ERROR);
  }

  return body.data as PublicSealStatus;
};

/** POST /api/public/meetings/:id/verify-file — compares a PDF's SHA-256 (hashed
 *  in the browser; the file is never uploaded) to the one recorded when
 *  TailgatePro generated the report. */
export const checkPublicPdfHash = async (
  id: string,
  sha256: string,
): Promise<PdfFileCheck> => {
  const res = await fetchWithTimeout(`/api/public/meetings/${id}/verify-file`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sha256 }),
  });

  const body = await res.json().catch(() => null);

  if (!res.ok || !body?.success) {
    throw new Error(body?.error ?? GENERIC_ERROR);
  }

  return body.data as PdfFileCheck;
};
