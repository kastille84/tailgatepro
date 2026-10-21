import type { NoWorkDayReason } from "../interfaces/noWorkDay";

/** The one-tap reasons on the "Mark day off" sheet, in display order. */
export const NO_WORK_DAY_REASONS: { value: NoWorkDayReason; label: string }[] = [
  { value: "holiday", label: "Holiday" },
  { value: "weather", label: "Weather" },
  { value: "no_crew", label: "No crew scheduled" },
  { value: "other", label: "Other" },
];

/** Reader-friendly label for a reason (the GC dashboard reuses it). */
export const NO_WORK_DAY_REASON_LABELS: Record<NoWorkDayReason, string> = {
  holiday: "Holiday",
  weather: "Weather",
  no_crew: "No crew scheduled",
  other: "Other",
};

/** Label for a GC-dashboard `off` reason: a foreman's mark or the automatic
 *  "weekend". Falls back to null for a reason this client doesn't know. */
export const dayOffReasonLabel = (reason: string | null): string | null => {
  if (reason === "weekend") return "Weekend";
  return NO_WORK_DAY_REASON_LABELS[reason as NoWorkDayReason] ?? null;
};
