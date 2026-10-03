import type { SelectOption } from "../ui_comps/select";

/** US/Canada zones the Monday SMS nudge can be scheduled in (the Toll-Free
 *  sender is US/Canada only). */
const COMMON_TIME_ZONES: SelectOption[] = [
  { value: "America/New_York", label: "Eastern" },
  { value: "America/Chicago", label: "Central" },
  { value: "America/Denver", label: "Mountain" },
  { value: "America/Phoenix", label: "Arizona (no DST)" },
  { value: "America/Los_Angeles", label: "Pacific" },
  { value: "America/Anchorage", label: "Alaska" },
  { value: "Pacific/Honolulu", label: "Hawaii" },
];

/** The browser's IANA zone, e.g. `America/Chicago`. */
export const detectTimeZone = (): string =>
  Intl.DateTimeFormat().resolvedOptions().timeZone;

/** The common zones, plus `extra` (a site's saved zone or the browser's) as
 *  its own entry when it is not one of them, so it is never silently lost. */
export const timeZoneOptions = (extra?: string | null): SelectOption[] =>
  extra && !COMMON_TIME_ZONES.some((zone) => zone.value === extra)
    ? [...COMMON_TIME_ZONES, { value: extra, label: extra }]
    : COMMON_TIME_ZONES;
