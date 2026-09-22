import { fetchWithTimeout } from "../utils/fetchWithTimeout";
import type {
  GcOverview,
  GcMeetingSummary,
  GcMeetingDetail,
} from "../interfaces/gcDashboard";

const GENERIC_ERROR = "Something went wrong. Please try again.";

const authHeaders = (accessToken: string) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${accessToken}`,
});

/** Optional filters accepted by `GET /api/gc/meetings`. */
export interface GcMeetingsFilters {
  projectId?: string;
  from?: string;
  to?: string;
}

/** GET /api/gc/overview — per-sub compliance for the caller's linked jobsites
 *  on the given day. Both `date` (`YYYY-MM-DD`) and `tzOffset` (minutes, same
 *  sign as `Date#getTimezoneOffset()`) are required — the server never
 *  guesses a timezone. GC-only; a subcontractor token 403s. */
export const getGcOverview = async (
  accessToken: string,
  date: string,
  tzOffset: number,
): Promise<GcOverview> => {
  const res = await fetchWithTimeout(
    `/api/gc/overview?date=${date}&tzOffset=${tzOffset}`,
    {
      method: "GET",
      headers: authHeaders(accessToken),
    },
  );

  const body = await res.json().catch(() => null);

  if (!res.ok || !body?.success) {
    throw new Error(body?.error ?? GENERIC_ERROR);
  }

  return body.data as GcOverview;
};

/** GET /api/gc/meetings — completed logs for the caller's linked projects,
 *  newest held-at first, optionally narrowed to one project and/or a
 *  held-at range. */
export const getGcMeetings = async (
  accessToken: string,
  filters: GcMeetingsFilters = {},
): Promise<GcMeetingSummary[]> => {
  const params = new URLSearchParams();
  if (filters.projectId) params.set("projectId", filters.projectId);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  const query = params.toString();

  const res = await fetchWithTimeout(
    `/api/gc/meetings${query ? `?${query}` : ""}`,
    {
      method: "GET",
      headers: authHeaders(accessToken),
    },
  );

  const body = await res.json().catch(() => null);

  if (!res.ok || !body?.success) {
    throw new Error(body?.error ?? GENERIC_ERROR);
  }

  return body.data as GcMeetingSummary[];
};

/** GET /api/gc/meetings/:id — detail + signers for one completed meeting
 *  linked to the caller's GC company. A meeting that isn't linked (or isn't
 *  yet completed) 404s. */
export const getGcMeetingById = async (
  accessToken: string,
  id: string,
): Promise<GcMeetingDetail> => {
  const res = await fetchWithTimeout(`/api/gc/meetings/${id}`, {
    method: "GET",
    headers: authHeaders(accessToken),
  });

  const body = await res.json().catch(() => null);

  if (!res.ok || !body?.success) {
    throw new Error(body?.error ?? GENERIC_ERROR);
  }

  return body.data as GcMeetingDetail;
};

/** GET /api/gc/meetings/:id/pdf-url — a short-lived (5 minute) signed URL for
 *  the meeting's PDF. 404s if generation hasn't produced one yet — a real
 *  error to surface, not a silent `null`, since the caller should have
 *  already checked `pdfReady` before requesting this. */
export const getGcMeetingPdfUrl = async (
  accessToken: string,
  id: string,
): Promise<string> => {
  const res = await fetchWithTimeout(`/api/gc/meetings/${id}/pdf-url`, {
    method: "GET",
    headers: authHeaders(accessToken),
  });

  const body = await res.json().catch(() => null);

  if (!res.ok || !body?.success) {
    throw new Error(body?.error ?? GENERIC_ERROR);
  }

  return body.data.url as string;
};
