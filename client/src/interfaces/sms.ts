/** A phone number that may receive the Monday 7:00 AM SMS nudge (Phase 9e,
 *  docs/sms-nudges-design.md). */
export interface SmsRecipient {
  id: string;
  subCompanyId: string;
  /** Set for a GC-entered number (one site); null for a foreman's own opt-in. */
  jobsiteId: string | null;
  /** E.164, e.g. `+15125550123`. */
  phone: string;
  /** `foreman` = opted in themself; `gc` = entered by a GC, which only counts
   *  once the recipient replies YES (`confirmedAt`). */
  source: "foreman" | "gc";
  consentedAt: string;
  confirmedAt: string | null;
  /** The recipient replied STOP. */
  optedOut: boolean;
  /** The sub company's name; only present on the GC's per-site list. */
  subCompanyName: string | null;
}
