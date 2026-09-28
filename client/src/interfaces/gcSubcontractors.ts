/** One jobsite's contribution to a sub's rolling 30-day compliance score.
 *  Mirrors a `buildScorecard` jobsite entry (server/utility/subScorecard.js). */
export interface GcSubJobsiteBreakdown {
  jobsiteId: string;
  jobsiteName: string;
  /** Days in the rolling window the sub was an accepted roster member of this
   *  jobsite (prorated for a recent join — never the full 30 for one). */
  expectedDays: number;
  /** Of `expectedDays`, how many had a completed log. */
  loggedDays: number;
  /** 0-100, this jobsite's own rounded rate. */
  score: number;
}

/** One row of `GET /api/gc/subcontractors` — a sub's rolled-up score across
 *  every jobsite it has with the caller's GC, no breakdown. */
export interface GcSubScorecardSummary {
  companyId: string;
  companyName: string | null;
  /** 0-100, the average of each jobsite's *raw* rate, rounded once — not the
   *  average of the already-rounded per-jobsite scores (see
   *  docs/sub-scorecard-design.md "Scoring model" for the ±1 point this can
   *  differ from a naive re-average of the breakdown table's own numbers). */
  overallScore: number;
}

/** `GET /api/gc/subcontractors/:companyId/scorecard` response body. */
export interface GcSubScorecardDetail extends GcSubScorecardSummary {
  jobsites: GcSubJobsiteBreakdown[];
}
