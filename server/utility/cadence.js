// Pure, I/O-free: meeting-cadence rules (docs/gc-dashboard-design.md
// "Configurable cadence"). A jobsite has a GC-set default cadence and each
// accepted sub may set an override that can only *tighten* it, so a sub can't
// opt itself out of talks the GC requires. The effective cadence is therefore
// simply the strictest of the two -- which also means a GC tightening the
// default later automatically wins over an older, looser sub override.
const { dayWindow, weekWindow } = require("./dayWindow");

const CADENCES = ["daily", "weekly"];

// Higher = stricter (more frequent).
const STRICTNESS = { daily: 2, weekly: 1 };

const isStricterOrEqual = (candidate, baseline) =>
  STRICTNESS[candidate] >= STRICTNESS[baseline];

// `subCadence` is null/undefined when the sub has not set an override.
const effectiveCadence = (jobsiteCadence, subCadence) =>
  subCadence && isStricterOrEqual(subCadence, jobsiteCadence)
    ? subCadence
    : jobsiteCadence;

const windowFor = (cadence, { date, tzOffset, timeZone }) =>
  cadence === "weekly"
    ? weekWindow({ date, tzOffset, timeZone })
    : dayWindow({ date, tzOffset, timeZone });

module.exports = { CADENCES, isStricterOrEqual, effectiveCadence, windowFor };
