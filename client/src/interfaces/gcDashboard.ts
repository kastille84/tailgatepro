/** Per-sub compliance status for one linked jobsite, for the day the overview
 *  was requested. Mirrors a `getOverview` jobsite entry
 *  (server/services/gcDashboard.js). */
export interface GcSubCompliance {
  companyId: string;
  companyName: string | null;
  /** The sub's earliest active project id in this jobsite — what a drill-in
   *  opens. `null` when an accepted sub has no active project there yet. */
  projectId: string | null;
  status: "logged" | "missing";
  lastLoggedAt: string | null;
  count: number;
}

/** One of the GC's real jobsites (the `jobsites` table) with its accepted
 *  subs. Mirrors a `getOverview` jobsite entry. */
export interface GcJobsite {
  id: string;
  name: string;
  subs: GcSubCompliance[];
}

export interface GcOverviewTotals {
  subs: number;
  logged: number;
  missing: number;
}

/** `GET /api/gc/overview` response body. */
export interface GcOverview {
  jobsites: GcJobsite[];
  totals: GcOverviewTotals;
}

/** A completed meeting log row as the GC dashboard sees it. Mirrors
 *  `toMeetingSummary` (server/services/gcDashboard.js) — deliberately
 *  narrower than `MeetingLog`: no crew-photo or signature-image paths are
 *  ever exposed to a GC. */
export interface GcMeetingSummary {
  id: string;
  projectId: string;
  projectName: string | null;
  companyId: string;
  companyName: string | null;
  talkTitle: string | null;
  heldAt: string;
  completedAt: string;
  signerCount: number;
  pdfReady: boolean;
}

export interface GcMeetingSigner {
  workerName: string;
  quizPassed: boolean;
}

/** `GET /api/gc/meetings/:id` response body. */
export interface GcMeetingDetail extends GcMeetingSummary {
  signers: GcMeetingSigner[];
}
