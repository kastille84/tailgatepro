import { fetchWithTimeout } from "../utils/fetchWithTimeout";
import { PlanLimitError } from "../utils/PlanLimitError";
import type {
  GcOverview,
  GcMeetingSummary,
  GcMeetingDetail,
} from "../interfaces/gcDashboard";
import type { SealVerification } from "../interfaces/meetingLog";
import type {
  GcSubScorecardSummary,
  GcSubScorecardDetail,
} from "../interfaces/gcSubcontractors";
import type {
  PolicyPushCompliance,
  PolicyPushState,
  PolicyPushTalkOption,
} from "../interfaces/policyPush";

const GENERIC_ERROR = "Something went wrong. Please try again.";
const DEFAULT_BUNDLE_FILENAME = "defense-bundle.zip";
// Longer than fetchWithTimeout's 10s default — assembling a ZIP means the
// server downloads and compresses one PDF per completed log before the first
// byte comes back, which can take a while on a site with many logs.
const BUNDLE_FETCH_TIMEOUT_MS = 60_000;

const authHeaders = (accessToken: string) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${accessToken}`,
});

/** Optional filters accepted by `GET /api/gc/meetings`. */
export interface GcMeetingsFilters {
  projectId?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

/** One page of `GET /api/gc/meetings` — `hasMore` tells the caller whether a
 *  further page exists past this one, so a "Load more" button knows when to
 *  disappear. */
export interface GcMeetingsPage {
  meetings: GcMeetingSummary[];
  hasMore: boolean;
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
 *  held-at range. Paginated: `limit`/`offset` select the page, and the
 *  response's `hasMore` says whether another page exists. */
export const getGcMeetings = async (
  accessToken: string,
  filters: GcMeetingsFilters = {},
): Promise<GcMeetingsPage> => {
  const params = new URLSearchParams();
  if (filters.projectId) params.set("projectId", filters.projectId);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.limit !== undefined) params.set("limit", String(filters.limit));
  if (filters.offset !== undefined) params.set("offset", String(filters.offset));
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

  return body.data as GcMeetingsPage;
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

/** GET /api/gc/meetings/:id/verify-seal — recomputes the meeting's
 *  tamper-evidence content seal from current server state and compares it to
 *  what was stored at completion (Phase 9e). 404s if the meeting isn't
 *  sealed yet. */
export const verifyGcMeetingSeal = async (
  accessToken: string,
  id: string,
): Promise<SealVerification> => {
  const res = await fetchWithTimeout(`/api/gc/meetings/${id}/verify-seal`, {
    method: "GET",
    headers: authHeaders(accessToken),
  });

  const body = await res.json().catch(() => null);

  if (!res.ok || !body?.success) {
    throw new Error(body?.error ?? GENERIC_ERROR);
  }

  return body.data as SealVerification;
};

/** GET /api/gc/subcontractors — every distinct sub across the caller's active
 *  portfolio jobsites with a rolling 30-day compliance score, worst-first
 *  (Phase 9e, docs/sub-scorecard-design.md). GC Portfolio only; a 403
 *  `PLAN_LIMIT` throws a `PlanLimitError` (defense in depth — the page should
 *  already gate on `useCurrentUser().plan` before calling this). */
export const getGcSubcontractorScorecards = async (
  accessToken: string,
  date: string,
  tzOffset: number,
): Promise<GcSubScorecardSummary[]> => {
  const res = await fetchWithTimeout(
    `/api/gc/subcontractors?date=${date}&tzOffset=${tzOffset}`,
    { method: "GET", headers: authHeaders(accessToken) },
  );

  const body = await res.json().catch(() => null);

  if (!res.ok || !body?.success) {
    if (body?.data?.code === "PLAN_LIMIT") {
      throw new PlanLimitError(body.error ?? GENERIC_ERROR, body.data.limit ?? null);
    }
    throw new Error(body?.error ?? GENERIC_ERROR);
  }

  return body.data as GcSubScorecardSummary[];
};

/** GET /api/gc/subcontractors/:companyId/scorecard — one sub's overall score
 *  plus its per-jobsite breakdown. 404s if the company isn't a current
 *  accepted roster member anywhere in the caller's portfolio. */
export const getGcSubcontractorScorecard = async (
  accessToken: string,
  companyId: string,
  date: string,
  tzOffset: number,
): Promise<GcSubScorecardDetail> => {
  const res = await fetchWithTimeout(
    `/api/gc/subcontractors/${companyId}/scorecard?date=${date}&tzOffset=${tzOffset}`,
    { method: "GET", headers: authHeaders(accessToken) },
  );

  const body = await res.json().catch(() => null);

  if (!res.ok || !body?.success) {
    if (body?.data?.code === "PLAN_LIMIT") {
      throw new PlanLimitError(body.error ?? GENERIC_ERROR, body.data.limit ?? null);
    }
    throw new Error(body?.error ?? GENERIC_ERROR);
  }

  return body.data as GcSubScorecardDetail;
};

/** GET /api/gc/policy-push — the caller's current top-down policy push plus,
 *  when one is active, a per-active-jobsite compliance rollup since it was
 *  pushed (Phase 9e, docs/policy-push-design.md). GC Portfolio only; a 403
 *  `PLAN_LIMIT` throws a `PlanLimitError` (defense in depth — the page should
 *  already gate on `useCurrentUser().plan` before calling this). */
export const getGcPolicyPush = async (
  accessToken: string,
  date: string,
  tzOffset: number,
): Promise<PolicyPushCompliance> => {
  const res = await fetchWithTimeout(
    `/api/gc/policy-push?date=${date}&tzOffset=${tzOffset}`,
    { method: "GET", headers: authHeaders(accessToken) },
  );

  const body = await res.json().catch(() => null);

  if (!res.ok || !body?.success) {
    if (body?.data?.code === "PLAN_LIMIT") {
      throw new PlanLimitError(body.error ?? GENERIC_ERROR, body.data.limit ?? null);
    }
    throw new Error(body?.error ?? GENERIC_ERROR);
  }

  return body.data as PolicyPushCompliance;
};

/** GET /api/gc/policy-push/talks — every global talk plus the GC's own
 *  company talks, for the push picker (docs/company-talks-design.md). */
export const getGcPolicyPushTalks = async (
  accessToken: string,
): Promise<PolicyPushTalkOption[]> => {
  const res = await fetchWithTimeout("/api/gc/policy-push/talks", {
    method: "GET",
    headers: authHeaders(accessToken),
  });

  const body = await res.json().catch(() => null);

  if (!res.ok || !body?.success) {
    if (body?.data?.code === "PLAN_LIMIT") {
      throw new PlanLimitError(body.error ?? GENERIC_ERROR, body.data.limit ?? null);
    }
    throw new Error(body?.error ?? GENERIC_ERROR);
  }

  return body.data as PolicyPushTalkOption[];
};

/** POST /api/gc/policy-push — pushes (or replaces) the caller's company's
 *  current required topic across every active jobsite. Manager-only
 *  (admin/safety_manager) — a 403 without `PLAN_LIMIT` data means the
 *  caller's role, not their plan. */
export const pushGcPolicyTopic = async (
  accessToken: string,
  talkId: string,
): Promise<PolicyPushState> => {
  const res = await fetchWithTimeout("/api/gc/policy-push", {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify({ talkId }),
  });

  const body = await res.json().catch(() => null);

  if (!res.ok || !body?.success) {
    if (body?.data?.code === "PLAN_LIMIT") {
      throw new PlanLimitError(body.error ?? GENERIC_ERROR, body.data.limit ?? null);
    }
    throw new Error(body?.error ?? GENERIC_ERROR);
  }

  return body.data as PolicyPushState;
};

/** DELETE /api/gc/policy-push — clears the caller's company's current
 *  required topic. Same manager-only gate as the push above. */
export const clearGcPolicyPush = async (accessToken: string): Promise<void> => {
  const res = await fetchWithTimeout("/api/gc/policy-push", {
    method: "DELETE",
    headers: authHeaders(accessToken),
  });

  const body = await res.json().catch(() => null);

  if (!res.ok || !body?.success) {
    if (body?.data?.code === "PLAN_LIMIT") {
      throw new PlanLimitError(body.error ?? GENERIC_ERROR, body.data.limit ?? null);
    }
    throw new Error(body?.error ?? GENERIC_ERROR);
  }
};

/** GET /api/gc/jobsites/:id/defense-bundle — a streamed ZIP body, not the
 *  usual `{ success, data }` JSON envelope (docs/osha-defense-bundle-design.md),
 *  so this can't reuse `unwrap`-style parsing on success. A 403 `PLAN_LIMIT`
 *  (the jobsite isn't on Site Pro) throws a `PlanLimitError`, same as
 *  `apiJobsites.ts`. The filename comes from the server's
 *  `Content-Disposition` header so the saved file matches what it named. */
export const getDefenseBundle = async (
  accessToken: string,
  jobsiteId: string,
): Promise<{ blob: Blob; filename: string }> => {
  const res = await fetchWithTimeout(
    `/api/gc/jobsites/${jobsiteId}/defense-bundle`,
    { method: "GET", headers: { Authorization: `Bearer ${accessToken}` } },
    BUNDLE_FETCH_TIMEOUT_MS,
  );

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    if (body?.data?.code === "PLAN_LIMIT") {
      throw new PlanLimitError(body.error ?? GENERIC_ERROR, body.data.limit ?? null);
    }
    throw new Error(body?.error ?? GENERIC_ERROR);
  }

  const disposition = res.headers.get("Content-Disposition") ?? "";
  const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? DEFAULT_BUNDLE_FILENAME;

  return { blob: await res.blob(), filename };
};
