/** Why a foreman marked a weekday off ("Mark day off", docs/no-work-days-design.md).
 *  Mirrors the `reason` CHECK on the server's `no_work_days` table. */
export type NoWorkDayReason = "holiday" | "weather" | "no_crew" | "other";

/** One marked day off, as the server's `toNoWorkDay` returns it. */
export interface NoWorkDay {
  id: string;
  jobsiteId: string;
  companyId: string;
  /** A local calendar date, `YYYY-MM-DD` (not a timestamp). */
  offDate: string;
  reason: NoWorkDayReason;
  createdBy: string | null;
  /** ISO timestamp the server received the mark. */
  createdAt: string;
}
