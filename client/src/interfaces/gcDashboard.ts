/** Per-sub compliance status for one linked jobsite, for the day the overview
 *  was requested. Mirrors a `getOverview` jobsite entry
 *  (server/services/gcDashboard.js). */
export interface GcSubCompliance {
  companyId: string;
  companyName: string | null;
  /** The sub's earliest linked project id in this jobsite group — what a
   *  drill-in opens. */
  projectId: string;
  status: "logged" | "missing";
  lastLoggedAt: string | null;
  count: number;
}

/** A group of the GC's linked projects sharing a normalized name. Mirrors
 *  `getOverview`'s jobsite grouping (server/utility/jobsites.js). */
export interface GcJobsite {
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
